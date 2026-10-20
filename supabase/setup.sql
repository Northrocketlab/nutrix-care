-- Nutrix Care v1. Run once in this project's SQL Editor as the project owner.
-- Re-running preserves data. No animal records are seeded.
begin;
create table if not exists public.care_members (
 email text primary key check (email = lower(email)),
 display_name text not null,
 role text not null default 'staff' check (role in ('admin','staff')),
 active boolean not null default true
);
insert into public.care_members(email,display_name,role)
values ('north2585456@gmail.com','North','admin') on conflict(email) do nothing;
create table if not exists public.care_revision (
 id integer primary key check(id=1), revision bigint not null default 0
);
insert into public.care_revision(id) values(1) on conflict do nothing;
create table if not exists public.care_kennels(code text primary key);
insert into public.care_kennels(code)
select 'D'||b||'-'||r||lpad(n::text,2,'0')
from (values(1,'A',14),(1,'B',14),(2,'A',16),(2,'B',14),(3,'A',14),(3,'B',14),(4,'A',14),(4,'B',15),(5,'A',10),(6,'A',13),(6,'B',13)) layout(b,r,total)
cross join lateral generate_series(1,total) n
on conflict do nothing;
create table if not exists public.care_animals (
 id text primary key, payload jsonb not null, updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create unique index if not exists care_animal_id_case_unique on public.care_animals(lower(id));
create table if not exists public.care_tasks (
 id text primary key, animal_id text not null references public.care_animals(id),
 payload jsonb not null, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.care_events (
 id text primary key, payload jsonb not null, recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default now()
);
create table if not exists public.care_audit (
 revision bigint primary key, actor uuid not null references auth.users(id),
 saved_at timestamptz not null default now(), snapshot jsonb not null
);
alter table public.care_members enable row level security;
alter table public.care_revision enable row level security;
alter table public.care_kennels enable row level security;
alter table public.care_animals enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_events enable row level security;
alter table public.care_audit enable row level security;
-- Clients have no direct table access, including membership administration.
revoke all on public.care_members,public.care_revision,public.care_kennels,public.care_animals,public.care_tasks,public.care_events,public.care_audit from anon,authenticated;

create or replace function public.care_identity() returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare m public.care_members%rowtype;
begin
 select cm.* into m from public.care_members cm join auth.users u on lower(u.email)=cm.email
 where u.id=auth.uid() and u.email_confirmed_at is not null and cm.active;
 if not found then raise exception 'CARE_FORBIDDEN' using errcode='42501'; end if;
 return jsonb_build_object('uid',auth.uid(),'email',m.email,'name',m.display_name,'role',m.role);
end;$$;

create or replace function public.care_read() returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare who jsonb;
begin
 who:=public.care_identity();
 return jsonb_build_object('revision',(select revision from public.care_revision where id=1),'member',who,
 'state',jsonb_build_object('version',1,'operator',who->>'name',
 'animals',coalesce((select jsonb_agg(payload order by id) from public.care_animals),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(payload order by id) from public.care_tasks),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(payload order by recorded_at desc,id) from public.care_events),'[]'::jsonb)));
end;$$;

create or replace function public.care_write(expected_revision bigint, new_state jsonb) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare who jsonb; current_revision bigint; item jsonb; prior jsonb; event_record jsonb;
begin
 who:=public.care_identity();
 select revision into current_revision from public.care_revision where id=1 for update;
 if current_revision is distinct from expected_revision then raise exception 'CARE_CONFLICT' using errcode='40001'; end if;
 if new_state->>'version' is distinct from '1' or jsonb_typeof(new_state->'animals') is distinct from 'array'
 or jsonb_typeof(new_state->'tasks') is distinct from 'array' or jsonb_typeof(new_state->'events') is distinct from 'array'
 or octet_length(new_state::text)>20000000 then raise exception 'CARE_INVALID_STATE'; end if;
 if jsonb_array_length(new_state->'animals') <> (select count(distinct lower(x->>'id')) from jsonb_array_elements(new_state->'animals') x)
 or jsonb_array_length(new_state->'tasks') <> (select count(distinct x->>'id') from jsonb_array_elements(new_state->'tasks') x)
 then raise exception 'CARE_DUPLICATE_ID'; end if;
 -- This version has no delete operation. Reject accidental truncation/import replacement.
 if exists(select 1 from public.care_animals a where not exists(select 1 from jsonb_array_elements(new_state->'animals') x where x->>'id'=a.id))
 or exists(select 1 from public.care_tasks a where not exists(select 1 from jsonb_array_elements(new_state->'tasks') x where x->>'id'=a.id))
 then raise exception 'CARE_DELETION_NOT_ALLOWED'; end if;
 for item in select value from jsonb_array_elements(new_state->'animals') loop
  select payload into prior from public.care_animals where id=item->>'id';
  if coalesce(length(trim(item->>'id')),0) not between 1 and 60 or coalesce(length(trim(item->>'name')),0) not between 1 and 100
  or jsonb_typeof(item->'medications') is distinct from 'array' or jsonb_typeof(item->'notes') is distinct from 'array'
  or jsonb_typeof(item->'checks') is distinct from 'array' then raise exception 'CARE_INVALID_ANIMAL'; end if;
  if not exists(select 1 from public.care_kennels where code=item->>'kennel')
  and (prior is null or prior->>'kennel' is distinct from item->>'kennel') then raise exception 'CARE_INVALID_KENNEL'; end if;
  insert into public.care_animals(id,payload,updated_by) values(item->>'id',item,auth.uid())
  on conflict(id) do update set payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now()
  where care_animals.payload is distinct from excluded.payload;
 end loop;
 for item in select value from jsonb_array_elements(new_state->'tasks') loop
  if coalesce(length(item->>'id'),0) not between 1 and 80 or coalesce(length(trim(item->>'title')),0) not between 1 and 300 then raise exception 'CARE_INVALID_TASK'; end if;
  insert into public.care_tasks(id,animal_id,payload,updated_by) values(item->>'id',item->>'animalId',item,auth.uid())
  on conflict(id) do update set payload=excluded.payload,animal_id=excluded.animal_id,updated_by=excluded.updated_by,updated_at=now()
  where care_tasks.payload is distinct from excluded.payload;
 end loop;
 for item in select value from jsonb_array_elements(new_state->'events') loop
  if coalesce(length(item->>'id'),0) not between 1 and 100 or coalesce(length(item->>'text'),0) not between 1 and 8000 then raise exception 'CARE_INVALID_EVENT'; end if;
  event_record:=item||jsonb_build_object('actorId',auth.uid(),'operator',who->>'name','recordedAt',now());
  insert into public.care_events(id,payload,recorded_by) values(item->>'id',event_record,auth.uid()) on conflict(id) do nothing;
 end loop;
 update public.care_revision set revision=revision+1 where id=1;
 insert into public.care_audit(revision,actor,snapshot) values(current_revision+1,auth.uid(),new_state);
 return public.care_read();
end;$$;
revoke all on function public.care_identity(),public.care_read(),public.care_write(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.care_read(),public.care_write(bigint,jsonb) to authenticated;
commit;
