-- Registro de qué migraciones se han aplicado ya.
create table if not exists _migraciones (
  nombre      text primary key,
  aplicada_en timestamptz not null default now()
);
