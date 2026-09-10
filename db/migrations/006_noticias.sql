create table if not exists noticias (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  titulo       text not null,
  excerpt      text not null,
  cuerpo       text not null default '',
  fecha        date not null,
  -- URL completa en el almacén, no una ruta del repositorio: las fotos ya no
  -- viven en git.
  image_url    text,
  image_alt    text,
  -- Medidas de la foto. Sin ellas, `<Image>` tendría que descargarla en cada
  -- petición solo para saber cuánto mide.
  image_width  integer,
  image_height integer,
  tags         text[] not null default '{}',
  publicada    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists noticias_publicadas on noticias (fecha desc) where publicada;
