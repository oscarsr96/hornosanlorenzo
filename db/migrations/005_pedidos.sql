-- Un pedido nace 'iniciado' cuando alguien pulsa pagar y pasa a 'pagado'
-- cuando lo confirma el webhook de Stripe, nunca la vuelta del navegador.
-- Los 'iniciado' que se quedan por el camino son carritos abandonados: no se
-- borran, cuentan cuánta gente se cae en el pago.
create table if not exists pedidos (
  id                uuid primary key default gen_random_uuid(),
  -- Opcional a propósito: el invitado también compra. `set null` para que
  -- borrar una cuenta no borre el pedido.
  user_id           text references "user"(id) on delete set null,
  stripe_session_id text unique,
  mode              text not null check (mode in ('domicilio', 'recogida')),
  fecha_entrega     date not null,
  slot              text check (slot in ('morning', 'afternoon')),
  store_id          text,
  address           text,
  postal_code       char(5),
  email             text not null,
  telefono          text not null,
  nombre            text,
  notas             text,
  subtotal_cents    integer not null check (subtotal_cents >= 0),
  envio_cents       integer not null check (envio_cents >= 0),
  total_cents       integer not null check (total_cents >= 0),
  estado            text not null default 'iniciado' check (estado in ('iniciado', 'pagado')),
  -- Cuándo salió el aviso al obrador. Nulo = todavía no ha salido, así que
  -- un reintento de Stripe debe volver a intentarlo.
  notificado_en     timestamptz,
  -- Un pedido reconstruido desde Stripe porque la base de datos falló al
  -- cobrar: se marca para que en el panel no parezca igual de completo.
  reconstruido      boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists pedidos_recientes on pedidos (created_at desc);
create index if not exists pedidos_por_usuario on pedidos (user_id);

create table if not exists lineas_pedido (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references pedidos(id) on delete cascade,
  -- Nulo solo en pedidos reconstruidos: Stripe devuelve la descripción de la
  -- línea, no nuestro slug.
  slug             text,
  nombre           text not null,
  variante_label   text,
  qty              integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  orden            integer not null default 0
);

create index if not exists lineas_por_pedido on lineas_pedido (pedido_id);
