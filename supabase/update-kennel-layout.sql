-- Update cage configuration only; animal records and history remain unchanged.
begin;
-- Serialize with care_write while changing available destinations.
select revision from public.care_revision where id=1 for update;
insert into public.care_kennels(code) values('D2-A16') on conflict do nothing;
delete from public.care_kennels where code in ('D2-B15','D4-A15','D6-A14','D6-A15','D6-B14','D6-B15');
commit;
