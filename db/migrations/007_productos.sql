-- db/migrations/007_productos.sql
create table if not exists productos (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  category          text not null,
  seccion           text,
  price_cents       integer check (price_cents > 0),
  consultar         boolean not null default false,
  unit              text,
  short_description text not null,
  cuerpo            text not null default '',
  allergens         text[] not null default '{}',
  destacado         boolean not null default false,
  temporada         boolean not null default false,
  orden             integer not null default 100,
  image_url         text,
  image_alt         text,
  image_width       integer,
  image_height      integer,
  -- Desactivado: no se ve en la web. Agotado: se ve pero no se puede comprar.
  activo            boolean not null default true,
  agotado           boolean not null default false,
  updated_at        timestamptz not null default now(),
  -- La misma regla que ya impone zod en `src/content.config.ts`: o tiene
  -- precio, o está marcado como «consultar». Aquí también, porque el
  -- formulario no es el único camino por el que se puede escribir una fila.
  constraint precio_o_consultar check (consultar or price_cents is not null)
);

create index if not exists productos_catalogo on productos (orden) where activo;
create index if not exists productos_por_seccion on productos (seccion);

create table if not exists variantes (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  -- El identificador corto que viaja en el carrito y en el pedido
  -- («grande», «6-raciones»): no cambia aunque cambie la etiqueta.
  variant_id  text not null,
  label       text not null,
  price_cents integer not null check (price_cents > 0),
  orden       integer not null default 0,
  unique (producto_id, variant_id)
);

create index if not exists variantes_por_producto on variantes (producto_id);
