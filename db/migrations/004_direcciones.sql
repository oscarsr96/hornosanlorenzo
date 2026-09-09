create table if not exists direcciones (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references "user"(id) on delete cascade,
  alias          text not null,
  calle          text not null,
  postal_code    char(5) not null,
  predeterminada boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists direcciones_por_usuario on direcciones (user_id);

-- Como mucho una predeterminada por persona. Se impone en la base de datos:
-- confiar en que el código lo respete siempre es cómo aparecen los duplicados.
create unique index if not exists direcciones_una_predeterminada
  on direcciones (user_id) where predeterminada;
