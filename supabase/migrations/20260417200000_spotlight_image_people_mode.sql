-- Preferência "pessoas na foto" para template Spotlight (hero futurista) — default em novos projetos.
alter table public.profiles
  add column if not exists spotlight_image_people_mode text default 'auto';

alter table public.profiles
  drop constraint if exists profiles_spotlight_image_people_mode_check;

alter table public.profiles
  add constraint profiles_spotlight_image_people_mode_check
  check (
    spotlight_image_people_mode is null
    or spotlight_image_people_mode in ('auto', 'with_people', 'no_people')
  );

comment on column public.profiles.spotlight_image_people_mode is
  'Default ImagePeopleMode for Spotlight template: auto | with_people | no_people';
