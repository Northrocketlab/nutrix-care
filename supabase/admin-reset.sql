-- Installs the owner-only reset capability; does not reset any data.
create table if not exists public.care_reset_log (
 id uuid primary key default gen_random_uuid(),
 actor uuid not null references auth.users(id),
 reset_at timestamptz not null default now(),
 previous_revision bigint not null,
 new_revision bigint not null,
 deleted_counts jsonb not null
);
alter table public.care_reset_log enable row level security;
revoke all on public.care_reset_log from public,anon,authenticated;
grant select,insert on public.care_reset_log to service_role;
create or replace function public.care_admin_reset(actor_uid uuid,expected_revision bigint,confirmation text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare current_revision bigint; member_name text; counts jsonb;
begin
 if current_user <> 'service_role' then raise exception 'CARE_FORBIDDEN' using errcode='42501'; end if;
 if confirmation is distinct from 'ล้างข้อมูลทั้งหมด' then raise exception 'CARE_CONFIRMATION_REQUIRED'; end if;
 -- The server has verified actor_uid with Auth.getUser and a fresh password login.
 -- service_role must not read the protected auth.users table directly.
 select m.display_name into member_name from public.care_members m
 where actor_uid is not null and m.email='north2585456@gmail.com' and m.role='admin' and m.active;
 if not found then raise exception 'CARE_FORBIDDEN' using errcode='42501'; end if;
 select revision into current_revision from public.care_revision where id=1 for update;
 if current_revision is distinct from expected_revision then raise exception 'CARE_CONFLICT' using errcode='40001'; end if;
 counts:=jsonb_build_object('animals',(select count(*) from public.care_animals),'tasks',(select count(*) from public.care_tasks),'events',(select count(*) from public.care_events),'auditSnapshots',(select count(*) from public.care_audit));
 delete from public.care_tasks where id in (select id from public.care_tasks);
 delete from public.care_animals where id in (select id from public.care_animals);
 delete from public.care_events where id in (select id from public.care_events);
 delete from public.care_audit where revision <= current_revision;
 update public.care_revision set revision=current_revision+1 where id=1;
 insert into public.care_reset_log(actor,previous_revision,new_revision,deleted_counts) values(actor_uid,current_revision,current_revision+1,counts);
 return jsonb_build_object('revision',current_revision+1,'member',jsonb_build_object('uid',actor_uid,'email','north2585456@gmail.com','name',member_name,'role','admin'),'state',jsonb_build_object('version',1,'operator',member_name,'animals','[]'::jsonb,'tasks','[]'::jsonb,'events','[]'::jsonb));
end;$$;
revoke all on function public.care_admin_reset(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.care_admin_reset(uuid,bigint,text) to service_role;
