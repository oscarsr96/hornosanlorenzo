# Pedidos, panel de administración y catálogo en base de datos — plan de implementación

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans` para implementarlo tarea a tarea. Los pasos van
> con casilla (`- [ ]`) para poder marcarlos.

**Objetivo:** que cada pedido pagado quede escrito en la base de datos y que una persona sin
conocimientos técnicos entre en `/admin` con su correo y su contraseña y vea los pedidos y los
clientes, y edite noticias y fichas de producto —precio, foto, alérgenos, agotado— viéndolo en la
web al momento, sin desplegar.

**Arquitectura:** Postgres a secas (el que ya existe en Neon) con SQL versionado en
`db/migrations/`; un repositorio por tabla en `src/lib/db/`, único sitio que sabe nombres de
columna; el navegador nunca habla con la base de datos, siempre por `/api`. El sitio pasa de
`output: "static"` a `output: "server"` con ISR de Vercel: las páginas públicas se cachean y el
panel las invalida al guardar. Las fotos van a Vercel Blob detrás de `src/lib/storage/*`.

**Stack:** Astro 5 · `@astrojs/vercel` 9 · Better Auth 1.7 · `pg` 8 · Vercel Blob · sharp ·
`@astrojs/markdown-remark` · Zod 3 · Vitest 5 · Tailwind 4 · pnpm.

**Spec:** `docs/superpowers/specs/2026-09-09-registro-usuarios-y-panel-admin-design.md`
(léela entera antes de empezar: este plan discute contra ella).

---

## Aviso de alcance

La spec §11 dice que el trabajo grueso no es el panel, es reescribir la capa de catálogo, y que es
«el cambio más grande que ha tenido el proyecto». Son las 98 fichas de la carta las que están en
juego. Por eso el plan va en **tres partes que se despliegan por separado**:

| Parte | Qué deja funcionando | Se puede parar aquí |
| ----- | -------------------- | ------------------- |
| **A** (tareas 1–7) | El pedido pagado queda escrito; `/admin` con pedidos y clientes | Sí: la web pública no cambia |
| **B** (tareas 8–13) | Noticias en base de datos, editables desde el panel, con foto | Sí: el catálogo sigue en Markdown |
| **C** (tareas 14–20) | Productos y catálogo en base de datos, editables desde el panel | Fin |

Cada parte acaba con la web entera y funcionando. Si hay que parar a mitad, se para entre partes,
no dentro de una.

---

## Restricciones globales

Se aplican a **todas** las tareas. Cada tarea las hereda sin repetirlas.

- **El precio se calcula en servidor.** `priceOrder` (`src/lib/pedido.ts`) es la única autoridad.
  El navegador manda referencias y cantidades, nunca importes. Ninguna tarea puede aflojar esto.
- **Postgres a secas.** Nada de API REST del proveedor ni extensiones propias. SQL versionado en
  `db/migrations/NNN_nombre.sql`, aplicado con `pnpm db:migrar`. Las migraciones son
  **acumulativas y no se editan una vez aplicadas**: si algo cambia, se añade otra.
- **Solo `src/lib/db/pool.ts` importa `pg`.** Los repositorios importan `pool` de ahí. Es lo que
  hace que mudarse a Cloud SQL sea cambiar `DATABASE_URL`.
- **Los nombres de columna no salen del repositorio.** Hacia fuera todo va en camelCase, como en
  `src/lib/db/direcciones.ts`. Nadie fuera de `src/lib/db/` debe ver `postal_code`.
- **`rol` lleva `input: false`** en `src/lib/auth/campos.ts`. No se toca. `campos.test.ts` lo
  cubre: si alguien lo quita, falla una prueba.
- **Las pruebas que necesitan Postgres van bajo `describeSiHayBD`**, con
  `const URL_PRUEBAS = process.env.DATABASE_URL_TEST` y `describe.skip` si no está. Y **no se
  importa el repositorio de forma estática**: `import()` dinámico dentro del `beforeAll`, después
  de redirigir `process.env.DATABASE_URL`. El motivo está explicado arriba del todo en
  `src/lib/db/direcciones.test.ts` — leerlo antes de escribir la primera prueba de base de datos.
- **Textos en español**, con el tono de la marca. El manual prohíbe promesas de salud. El panel usa
  los tokens de la marca: `--color-leche`, `--color-latte`, `--color-avellana`, `--color-ink`,
  `--color-ink-muted`, `--color-moka`, `--color-line`, las clases `numeracion` y `filete` — y
  **sin radios ni sombras** (spec §8).
- **Comentarios en español y explicando el porqué**, no el qué. Es el estilo del repositorio.
- **Nada de datos inventados.** Si falta un dato del obrador (alérgenos, horarios, rangos de CP),
  se deja como está y se anota en `tasks/todo.md`. No se rellena a ojo.
- **El checkout de invitado sigue funcionando** sin sesión, en todas las tareas.
- **Cada tarea acaba con `pnpm test` y `pnpm check` en verde** antes del commit.
- Mensajes de commit en español, en minúscula, con prefijo (`feat:`, `fix:`, `docs:`, `refactor:`).

### Variables de entorno nuevas

Se añaden a `.env.example` en la tarea que las estrena, y **hay que ponerlas en Vercel tanto en el
entorno de ejecución como en el de construcción**. La lección ya está pagada:
`import.meta.env.PUBLIC_SITE_URL` se resuelve en construcción, y una variable que solo está en
ejecución llega `undefined` (ver `tasks/todo.md`, sección «Bloquea encender los cobros»).

| Variable | Para qué | Tarea |
| -------- | -------- | ----- |
| `VERCEL_BYPASS_TOKEN` | Invalidar la caché ISR desde el panel | 8 |
| `BLOB_READ_WRITE_TOKEN` | Subir y borrar fotos en Vercel Blob | 9 |

---

## Estructura de ficheros

**Nuevos**

| Fichero | Responsabilidad |
| ------- | --------------- |
| `db/migrations/005_pedidos.sql` | Tablas `pedidos` y `lineas_pedido` |
| `db/migrations/006_noticias.sql` | Tabla `noticias` |
| `db/migrations/007_productos.sql` | Tablas `productos` y `variantes` |
| `src/lib/db/pedidos.ts` | Escribir y leer pedidos. Único sitio con SQL de pedidos |
| `src/lib/db/clientes.ts` | Listado de clientes para el panel |
| `src/lib/db/noticias.ts` | CRUD de noticias |
| `src/lib/db/productos.ts` | CRUD de productos y variantes, y lectura para el catálogo |
| `src/lib/auth/guardia.ts` | `esAdmin` y la guardia de `/admin`. Sin `pg`, para poder probarla |
| `src/lib/storage/index.ts` | La interfaz del almacén: lo único que ve el resto del código |
| `src/lib/storage/blob.ts` | La implementación con Vercel Blob. El módulo que se muda |
| `src/lib/storage/imagen.ts` | Validar y normalizar la imagen con sharp. Sin proveedor |
| `src/lib/cache.ts` | Invalidar la caché ISR de unas rutas |
| `src/lib/markdown.ts` | Convertir a HTML el cuerpo que ahora vive en la base de datos |
| `src/layouts/AdminLayout.astro` | Marco del panel: navegación, guardia, sin caché |
| `src/pages/admin/index.astro` | Portada del panel |
| `src/pages/admin/pedidos.astro` | Pantalla de pedidos (solo lectura) |
| `src/pages/admin/clientes.astro` | Pantalla de clientes |
| `src/pages/admin/noticias.astro` | Pantalla de noticias |
| `src/pages/admin/productos.astro` | Pantalla de productos |
| `src/pages/api/admin/noticias.ts` | Alta, edición y borrado de noticias |
| `src/pages/api/admin/productos.ts` | Alta y edición de productos y variantes |
| `src/pages/api/admin/imagen.ts` | Subida de fotos |
| `src/islands/AdminNoticias.tsx` | Editor de noticias |
| `src/islands/AdminProductos.tsx` | Editor de productos |
| `scripts/hacer-admin.mjs` | Convertir en admin una cuenta existente |
| `scripts/migrar-contenido.mjs` | Volcar los Markdown y las fotos a la base de datos |
| `scripts/verificar-migracion.mjs` | Comparar ficha a ficha antes de retirar nada |

**Modificados**

| Fichero | Cambio |
| ------- | ------ |
| `src/middleware.ts` | Cierra `/admin` y `/api/admin` con la guardia (tarea 4) |
| `src/pages/api/checkout.ts` | Anota el pedido antes de mandar a Stripe |
| `src/pages/api/webhook.ts` | Marca el pedido pagado y no repite el aviso |
| `src/lib/pedido.ts` | `priceOrder` lee el producto de la base de datos |
| `astro.config.mjs` | `output: "server"`, ISR con `bypassToken` y `exclude`, `image.remotePatterns` |
| `src/env.d.ts` | Variables nuevas |
| `src/components/CatalogoGrid.astro`, `ProductCard.astro`, `NewsCard.astro`, `NewsCarousel.astro` | Leen de la base de datos, no de la colección |
| `src/pages/catalogo/*`, `src/pages/noticias/*`, `src/pages/index.astro` | Sin `getStaticPaths`, desde la base de datos |
| `src/content.config.ts` | Se retiran las colecciones al final de cada parte |
| `package.json`, `.env.example`, `tasks/todo.md` | Dependencias, variables y pendientes |

---

# PARTE A — El pedido deja rastro

Al acabar la parte A: cada pedido pagado está escrito en Postgres, `/admin` existe y está cerrado
a quien no sea admin, y el obrador puede ver pedidos y clientes sin abrir el correo. La web pública
no cambia ni una línea.

---

### Tarea 1: Tablas y repositorio de pedidos

**Ficheros:**
- Crear: `db/migrations/005_pedidos.sql`
- Crear: `src/lib/db/pedidos.ts`
- Crear: `src/lib/db/pedidos.test.ts`

**Interfaces:**
- Consume: `pool` de `~/lib/db/pool`; el tipo `PricedOrder` de `~/lib/pedido`.
- Produce:
  - `crearPedidoIniciado(order: PricedOrder): Promise<string>` — devuelve el id del pedido.
  - `anotarSesionStripe(pedidoId: string, sessionId: string): Promise<void>`
  - `marcarPagado(ref: { pedidoId?: string | null; sessionId: string }): Promise<PedidoAnotado | null>`
  - `crearPedidoReconstruido(datos: PedidoReconstruido): Promise<PedidoAnotado>`
  - `marcarAvisado(pedidoId: string): Promise<void>`
  - `listarPedidos(limite?: number): Promise<PedidoConLineas[]>`
  - Tipos `PedidoAnotado`, `PedidoReconstruido`, `PedidoConLineas`, `LineaPedido`.

**Decisiones del modelo que hay que respetar** (spec §6, y una añadida):

1. Las líneas **guardan el precio cobrado**, no una referencia al producto. Un pedido es un
   documento histórico: si mañana sube el precio, el pedido viejo sigue diciendo lo que costó.
2. `user_id` es **opcional** y va con `on delete set null`: el checkout de invitado también se
   guarda, y el día que exista el borrado de cuenta que pide el RGPD (`tasks/todo.md`), borrar a
   la persona no puede borrar la contabilidad.
3. **`estado` y `notificado_en` son dos cosas distintas.** «Pagado» y «el obrador ya lo sabe» no
   ocurren a la vez y pueden fallar por separado. Con una sola columna, un fallo de correo o se
   traga el aviso o lo repite en cada reintento de Stripe. Con dos, el reintento vuelve a intentar
   el aviso exactamente mientras haga falta.

- [ ] **Paso 1: Escribir la migración**

```sql
-- db/migrations/005_pedidos.sql
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
```

- [ ] **Paso 2: Aplicar la migración contra la base de pruebas y comprobar que entra**

```bash
DATABASE_URL="$DATABASE_URL_TEST" pnpm db:migrar
```

Esperado: `✓ 005_pedidos.sql`. Si dice «Nada que aplicar», la base ya la tenía: comprueba con
`select * from _migraciones`.

- [ ] **Paso 3: Escribir las pruebas que fallan**

```ts
// src/lib/db/pedidos.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";

// Igual que en `direcciones.test.ts`: nada de importar el repositorio aquí
// arriba. `~/lib/db/pedidos` arrastra `~/lib/db/pool`, que crea el pool en
// cuanto se carga el módulo — y lo crearía contra el DATABASE_URL normal,
// antes de que el beforeAll lo redirija a la base de pruebas.
const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de pedidos", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/pedidos");

  const pedidoDePrueba = () => ({
    lines: [
      {
        slug: "tarta-de-queso",
        name: "Tarta de queso",
        qty: 2,
        unitPriceCents: 1850,
        totalCents: 3700,
      },
      {
        slug: "croissant",
        name: "Croissant",
        variantLabel: "Grande",
        qty: 3,
        unitPriceCents: 190,
        totalCents: 570,
      },
    ],
    subtotalCents: 4270,
    shippingCents: 0,
    totalCents: 4270,
    payload: {
      items: [],
      mode: "recogida" as const,
      dateISO: "2026-09-20",
      slot: "morning" as const,
      storeId: "alcobendas",
      email: "cliente@example.com",
      phone: "666123456",
      name: "Ana",
      notes: "Sin azúcar por encima",
    },
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS, max: 2 });
    repo = await import("~/lib/db/pedidos");
    await pool.query("delete from pedidos");
  });

  afterAll(async () => {
    await pool.query("delete from pedidos");
    await pool.end();
  });

  it("guarda el pedido con sus líneas y el precio cobrado", async () => {
    const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never);

    const [pedido] = (await repo.listarPedidos(10)).filter((p) => p.id === id);
    // Todavía está 'iniciado', así que no sale en el listado del panel.
    expect(pedido).toBeUndefined();

    const { rows } = await pool.query(
      "select estado, total_cents, telefono from pedidos where id = $1",
      [id],
    );
    expect(rows[0].estado).toBe("iniciado");
    expect(rows[0].total_cents).toBe(4270);

    const lineas = await pool.query(
      "select slug, unit_price_cents, variante_label from lineas_pedido where pedido_id = $1 order by orden",
      [id],
    );
    expect(lineas.rows).toHaveLength(2);
    expect(lineas.rows[0].unit_price_cents).toBe(1850);
    expect(lineas.rows[1].variante_label).toBe("Grande");
  });

  it("marcarPagado es idempotente: dos avisos de Stripe no duplican nada", async () => {
    const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
    await repo.anotarSesionStripe(id, "cs_test_idem");

    const primera = await repo.marcarPagado({ sessionId: "cs_test_idem" });
    expect(primera?.id).toBe(id);
    expect(primera?.notificadoEn).toBeNull();

    await repo.marcarAvisado(id);

    const segunda = await repo.marcarPagado({ sessionId: "cs_test_idem" });
    // Sigue pagado, pero ahora consta que ya se avisó: quien llame sabrá
    // que no tiene que volver a mandar el correo.
    expect(segunda?.id).toBe(id);
    expect(segunda?.notificadoEn).toBeInstanceOf(Date);

    const { rows } = await pool.query("select count(*)::int as n from pedidos where id = $1", [id]);
    expect(rows[0].n).toBe(1);
  });

  it("devuelve null si el aviso de Stripe no corresponde a ningún pedido nuestro", async () => {
    expect(await repo.marcarPagado({ sessionId: "cs_test_desconocida" })).toBeNull();
  });

  it("listarPedidos devuelve solo los pagados, del más reciente al más antiguo", async () => {
    const viejo = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
    await repo.marcarPagado({ pedidoId: viejo, sessionId: "cs_test_viejo" });
    const nuevo = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
    await repo.marcarPagado({ pedidoId: nuevo, sessionId: "cs_test_nuevo" });
    await repo.crearPedidoIniciado(pedidoDePrueba() as never); // se queda iniciado

    const lista = await repo.listarPedidos(50);
    const ids = lista.map((p) => p.id);
    expect(ids).toContain(nuevo);
    expect(ids).toContain(viejo);
    expect(ids.indexOf(nuevo)).toBeLessThan(ids.indexOf(viejo));
    expect(lista.every((p) => p.lineas.length > 0)).toBe(true);
  });
});
```

- [ ] **Paso 4: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/lib/db/pedidos.test.ts`
Esperado: FALLA con «Failed to load url ~/lib/db/pedidos» (el módulo no existe).
Si en vez de eso dice `skipped`, es que falta `DATABASE_URL_TEST` en `.env`: sin base de pruebas
esta tarea no se puede dar por hecha.

- [ ] **Paso 5: Escribir el repositorio**

```ts
// src/lib/db/pedidos.ts
import { pool } from "~/lib/db/pool";
import type { PricedOrder } from "~/lib/pedido";

/**
 * Pedidos. Único sitio del proyecto con SQL de pedidos: hacia fuera todo va
 * en camelCase y nadie ve un nombre de columna.
 */

export type LineaPedido = {
  slug: string | null;
  nombre: string;
  varianteLabel: string | null;
  qty: number;
  unitPriceCents: number;
};

export type PedidoConLineas = {
  id: string;
  userId: string | null;
  stripeSessionId: string | null;
  mode: "domicilio" | "recogida";
  fechaEntrega: string;
  slot: "morning" | "afternoon" | null;
  storeId: string | null;
  address: string | null;
  postalCode: string | null;
  email: string;
  telefono: string;
  nombre: string | null;
  notas: string | null;
  subtotalCents: number;
  envioCents: number;
  totalCents: number;
  reconstruido: boolean;
  createdAt: Date;
  lineas: LineaPedido[];
};

/** Lo mínimo que necesita saber quien confirma un cobro. */
export type PedidoAnotado = { id: string; notificadoEn: Date | null };

export type PedidoReconstruido = {
  stripeSessionId: string;
  email: string;
  telefono: string;
  nombre: string | null;
  notas: string | null;
  totalCents: number;
  lineas: { nombre: string; qty: number; unitPriceCents: number }[];
};

/**
 * Anota el pedido antes de mandar a nadie a pagar. Nace 'iniciado': si el
 * cobro no llega a completarse, se queda así y no ensucia el panel.
 *
 * Va en una transacción porque un pedido sin sus líneas no es un pedido: es
 * un importe sin explicación.
 */
export async function crearPedidoIniciado(order: PricedOrder): Promise<string> {
  const p = order.payload;
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ id: string }>(
      `insert into pedidos (
         user_id, mode, fecha_entrega, slot, store_id, address, postal_code,
         email, telefono, nombre, notas,
         subtotal_cents, envio_cents, total_cents
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id`,
      [
        order.userId ?? null,
        p.mode,
        p.dateISO,
        p.slot ?? null,
        p.storeId ?? null,
        p.address ?? null,
        p.postalCode ?? null,
        p.email,
        p.phone,
        p.name ?? null,
        p.notes ?? null,
        order.subtotalCents,
        order.shippingCents,
        order.totalCents,
      ],
    );
    const id = rows[0].id;

    for (const [i, linea] of order.lines.entries()) {
      await cliente.query(
        `insert into lineas_pedido
           (pedido_id, slug, nombre, variante_label, qty, unit_price_cents, orden)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          linea.slug,
          linea.name,
          linea.variantLabel ?? null,
          linea.qty,
          linea.unitPriceCents,
          i,
        ],
      );
    }

    await cliente.query("commit");
    return id;
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}

/** La referencia de Stripe se conoce después de crear la sesión de pago. */
export async function anotarSesionStripe(
  pedidoId: string,
  sessionId: string,
): Promise<void> {
  await pool.query(
    `update pedidos set stripe_session_id = $2 where id = $1`,
    [pedidoId, sessionId],
  );
}

/**
 * Da el pedido por pagado. Idempotente a propósito: Stripe reintenta el
 * mismo aviso si nuestra respuesta falla, y esos reintentos no pueden
 * duplicar el pedido ni volver a poner en marcha nada.
 *
 * Devuelve también `notificadoEn`, que es lo que permite a quien llama saber
 * si el correo al obrador ya salió o si este reintento todavía tiene que
 * mandarlo. Devuelve null si el pago no corresponde a ningún pedido nuestro
 * (por ejemplo, si la base de datos estaba caída al cobrar).
 */
export async function marcarPagado(
  ref: { pedidoId?: string | null; sessionId: string },
): Promise<PedidoAnotado | null> {
  const { rows } = await pool.query<PedidoAnotado>(
    `update pedidos
        set estado = 'pagado',
            stripe_session_id = coalesce(stripe_session_id, $2)
      where (id = $1::uuid or stripe_session_id = $2)
      returning id, notificado_en as "notificadoEn"`,
    [ref.pedidoId ?? null, ref.sessionId],
  );
  return rows[0] ?? null;
}

/**
 * Último recurso: el cobro salió bien pero el pedido no llegó a anotarse
 * (Postgres caído en ese momento). Se reconstruye con lo que da Stripe, que
 * es menos —no hay slugs ni desglose de envío— y por eso queda marcado.
 * Es preferible a que el pedido no aparezca en el panel.
 */
export async function crearPedidoReconstruido(
  datos: PedidoReconstruido,
): Promise<PedidoAnotado> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<PedidoAnotado>(
      `insert into pedidos (
         stripe_session_id, mode, fecha_entrega, email, telefono, nombre, notas,
         subtotal_cents, envio_cents, total_cents, estado, reconstruido
       ) values ($1, 'recogida', current_date, $2, $3, $4, $5, $6, 0, $6, 'pagado', true)
       on conflict (stripe_session_id) do update set estado = 'pagado'
       returning id, notificado_en as "notificadoEn"`,
      [
        datos.stripeSessionId,
        datos.email,
        datos.telefono,
        datos.nombre,
        datos.notas,
        datos.totalCents,
      ],
    );
    const id = rows[0].id;

    for (const [i, linea] of datos.lineas.entries()) {
      await cliente.query(
        `insert into lineas_pedido (pedido_id, nombre, qty, unit_price_cents, orden)
         values ($1,$2,$3,$4,$5)`,
        [id, linea.nombre, linea.qty, linea.unitPriceCents, i],
      );
    }

    await cliente.query("commit");
    return rows[0];
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}

/** El aviso al obrador ya salió: un reintento de Stripe no debe repetirlo. */
export async function marcarAvisado(pedidoId: string): Promise<void> {
  await pool.query(
    `update pedidos set notificado_en = now() where id = $1 and notificado_en is null`,
    [pedidoId],
  );
}

/**
 * Lo que ve el panel: solo pagados, del más reciente al más antiguo, con sus
 * líneas. Una sola consulta con agregación en vez de N+1: son pocos pedidos,
 * pero el patrón importa más que el volumen de hoy.
 */
export async function listarPedidos(limite = 100): Promise<PedidoConLineas[]> {
  const { rows } = await pool.query<PedidoConLineas>(
    `select p.id,
            p.user_id           as "userId",
            p.stripe_session_id as "stripeSessionId",
            p.mode,
            to_char(p.fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
            p.slot,
            p.store_id     as "storeId",
            p.address,
            p.postal_code  as "postalCode",
            p.email,
            p.telefono,
            p.nombre,
            p.notas,
            p.subtotal_cents as "subtotalCents",
            p.envio_cents    as "envioCents",
            p.total_cents    as "totalCents",
            p.reconstruido,
            p.created_at     as "createdAt",
            coalesce(
              (select json_agg(json_build_object(
                        'slug', l.slug,
                        'nombre', l.nombre,
                        'varianteLabel', l.variante_label,
                        'qty', l.qty,
                        'unitPriceCents', l.unit_price_cents)
                      order by l.orden)
                 from lineas_pedido l
                where l.pedido_id = p.id),
              '[]'::json
            ) as lineas
       from pedidos p
      where p.estado = 'pagado'
      order by p.created_at desc
      limit $1`,
    [limite],
  );
  return rows;
}
```

- [ ] **Paso 6: Ejecutar las pruebas hasta verlas pasar**

Ejecutar: `pnpm test src/lib/db/pedidos.test.ts`
Esperado: PASA, 4 pruebas.

- [ ] **Paso 7: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add db/migrations/005_pedidos.sql src/lib/db/pedidos.ts src/lib/db/pedidos.test.ts
git commit -m "feat(pedidos): tabla y repositorio de pedidos"
```

---

### Tarea 2: El checkout anota el pedido antes de mandar a pagar

**Ficheros:**
- Modificar: `src/pages/api/checkout.ts`
- Crear: `src/tests/api-checkout.test.ts`

**Interfaces:**
- Consume: `crearPedidoIniciado`, `anotarSesionStripe` (tarea 1).
- Produce: el metadato `pedidoId` en la sesión de Stripe, que lee el webhook (tarea 3).

**Por qué antes y no después.** El webhook solo recibe los metadatos de Stripe, y ahí no caben ni
los slugs ni el desglose: cada valor son 500 caracteres y un pedido de 40 líneas no entra. Lo que
sí cabe es el identificador del pedido que ya hemos escrito nosotros. Así el pedido que se guarda
es el que valoró `priceOrder`, con sus precios y su desglose, y no una reconstrucción.

**Un fallo de Postgres aquí no puede impedir vender.** Es el mismo criterio que el middleware y que
`cuenta.astro`: se degrada, no se bloquea. Si no se puede anotar, se cobra igual y el webhook lo
reconstruye desde Stripe (tarea 3).

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// src/tests/api-checkout.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const crearPedidoIniciado = vi.fn();
const anotarSesionStripe = vi.fn();
vi.mock("~/lib/db/pedidos", () => ({ crearPedidoIniciado, anotarSesionStripe }));

const priceOrder = vi.fn();
vi.mock("~/lib/pedido", async (original) => ({
  ...(await original<typeof import("~/lib/pedido")>()),
  priceOrder,
}));

const sessionsCreate = vi.fn();
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: sessionsCreate } };
  },
}));

const PEDIDO_VALORADO = {
  lines: [{ slug: "croissant", name: "Croissant", qty: 1, unitPriceCents: 190, totalCents: 190 }],
  subtotalCents: 190,
  shippingCents: 0,
  totalCents: 190,
  payload: {
    items: [{ slug: "croissant", qty: 1 }],
    mode: "recogida",
    dateISO: "2026-09-20",
    slot: "morning",
    storeId: "alcobendas",
    email: "cliente@example.com",
    phone: "666123456",
  },
};

const peticion = () =>
  new Request("https://ejemplo.test/api/checkout", {
    method: "POST",
    body: JSON.stringify(PEDIDO_VALORADO.payload),
  });

const contexto = () => ({
  request: peticion(),
  url: new URL("https://ejemplo.test/api/checkout"),
  locals: { usuario: null },
});

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  crearPedidoIniciado.mockReset().mockResolvedValue("pedido-1");
  anotarSesionStripe.mockReset().mockResolvedValue(undefined);
  priceOrder.mockReset().mockResolvedValue(PEDIDO_VALORADO);
  sessionsCreate.mockReset().mockResolvedValue({ id: "cs_test_1", url: "https://stripe.test/pagar" });
});

describe("POST /api/checkout", () => {
  it("anota el pedido y manda su id en los metadatos de Stripe", async () => {
    const { POST } = await import("~/pages/api/checkout");
    const respuesta = await POST(contexto() as never);

    expect(respuesta.status).toBe(200);
    expect(crearPedidoIniciado).toHaveBeenCalledOnce();
    expect(sessionsCreate.mock.calls[0][0].metadata.pedidoId).toBe("pedido-1");
    expect(anotarSesionStripe).toHaveBeenCalledWith("pedido-1", "cs_test_1");
  });

  it("si Postgres falla, se cobra igual: no se puede perder una venta por eso", async () => {
    crearPedidoIniciado.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("~/pages/api/checkout");
    const respuesta = await POST(contexto() as never);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ url: "https://stripe.test/pagar" });
    // Sin pedido anotado, el metadato va vacío y el webhook lo reconstruirá.
    expect(sessionsCreate.mock.calls[0][0].metadata.pedidoId).toBe("");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/tests/api-checkout.test.ts`
Esperado: FALLA — `metadata.pedidoId` es `undefined` y `crearPedidoIniciado` no se llama.

- [ ] **Paso 3: Modificar el endpoint**

En `src/pages/api/checkout.ts`, añadir el import:

```ts
import { crearPedidoIniciado, anotarSesionStripe } from "~/lib/db/pedidos";
```

Justo después del bloque `try/catch` de `priceOrder` y antes de construir `lineItems`:

```ts
  // El pedido se anota AQUÍ, con el desglose que acaba de calcular
  // `priceOrder`, y no en el webhook: en los metadatos de Stripe no caben ni
  // los slugs ni las líneas (500 caracteres por valor), solo esta referencia.
  //
  // Un fallo de Postgres no puede impedir una venta: se registra y se sigue.
  // El webhook reconstruirá el pedido con lo que dé Stripe, que es menos,
  // pero mejor eso que un cobro que no aparece en ningún sitio.
  let pedidoId: string | null = null;
  try {
    pedidoId = await crearPedidoIniciado(order);
  } catch (err) {
    console.error(
      "[checkout] no se pudo anotar el pedido, se cobra igual:",
      err instanceof Error ? err.message : err,
    );
  }
```

En el objeto `metadata` de `sessions.create`, añadir una línea más:

```ts
        pedidoId: pedidoId ?? "",
```

Y después de comprobar `session.url`, antes del `return`:

```ts
    // La referencia de Stripe solo se conoce ahora. Si esto falla, el webhook
    // todavía puede encontrar el pedido por `metadata.pedidoId`.
    if (pedidoId) {
      try {
        await anotarSesionStripe(pedidoId, session.id);
      } catch (err) {
        console.error(
          "[checkout] no se pudo anotar la referencia de Stripe:",
          err instanceof Error ? err.message : err,
        );
      }
    }
```

- [ ] **Paso 4: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/tests/api-checkout.test.ts`
Esperado: PASA, 2 pruebas.

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add src/pages/api/checkout.ts src/tests/api-checkout.test.ts
git commit -m "feat(pedidos): el checkout anota el pedido antes de cobrar"
```

---

### Tarea 3: El webhook marca el pedido pagado y no repite el aviso

**Ficheros:**
- Modificar: `src/pages/api/webhook.ts`
- Modificar: `src/tests/api-webhook.test.ts`

**Interfaces:**
- Consume: `marcarPagado`, `marcarAvisado`, `crearPedidoReconstruido` (tarea 1); `metadata.pedidoId`
  (tarea 2).
- Produce: `notify` pasa a devolver `Promise<boolean>` — `true` solo si el aviso al obrador salió
  de verdad. Nada más cambia de su comportamiento.

**El orden importa y no es arbitrario:**

1. Marcar pagado. Es lo que no puede perderse y es idempotente.
2. Si ya constaba avisado, responder 200 y no mandar nada. Ahí acaban los reintentos.
3. Si no, avisar. Si el aviso sale, marcarlo. Si falla, responder 500 para que Stripe reintente —
   y como `notificado_en` sigue nulo, el reintento volverá a intentar el correo.

Al revés (avisar y luego marcar) un fallo al escribir dejaría el correo mandado y el pedido sin
constancia, y el reintento lo mandaría otra vez.

- [ ] **Paso 1: Añadir las pruebas nuevas al fichero existente**

Añadir al final de `src/tests/api-webhook.test.ts`. Añadir además, arriba del todo junto a los
demás `vi.mock`, los dobles del repositorio:

```ts
const marcarPagado = vi.fn();
const marcarAvisado = vi.fn();
const crearPedidoReconstruido = vi.fn();
vi.mock("~/lib/db/pedidos", () => ({
  marcarPagado,
  marcarAvisado,
  crearPedidoReconstruido,
}));
```

y en el `beforeEach` existente:

```ts
  marcarPagado.mockReset().mockResolvedValue({ id: "pedido-1", notificadoEn: null });
  marcarAvisado.mockReset().mockResolvedValue(undefined);
  crearPedidoReconstruido.mockReset().mockResolvedValue({ id: "pedido-2", notificadoEn: null });
```

Y las pruebas:

```ts
describe("anotarPago — el pedido queda escrito", () => {
  it("marca pagado por la referencia del pedido, no solo por la de Stripe", async () => {
    const { anotarPago } = await import("~/pages/api/webhook");
    const sesion = sesionPagada();
    sesion.metadata = { ...sesion.metadata, pedidoId: "pedido-1" };

    const anotado = await anotarPago(stripeConLineItems([]), sesion);

    expect(marcarPagado).toHaveBeenCalledWith({
      pedidoId: "pedido-1",
      sessionId: "cs_test_123",
    });
    expect(crearPedidoReconstruido).not.toHaveBeenCalled();
    expect(anotado).toEqual({ id: "pedido-1", notificadoEn: null });
  });

  it("si el pedido no está en la base de datos, lo reconstruye desde Stripe", async () => {
    marcarPagado.mockResolvedValue(null);
    const { anotarPago } = await import("~/pages/api/webhook");

    const anotado = await anotarPago(
      stripeConLineItems([{ quantity: 2, description: "Croissant", amount_total: 380 }]),
      sesionPagada(),
    );

    expect(crearPedidoReconstruido).toHaveBeenCalledOnce();
    const datos = crearPedidoReconstruido.mock.calls[0][0];
    expect(datos.stripeSessionId).toBe("cs_test_123");
    expect(datos.lineas).toEqual([
      { nombre: "Croissant", qty: 2, unitPriceCents: 190 },
    ]);
    expect(anotado.id).toBe("pedido-2");
  });

  it("un fallo de Postgres no tumba el aviso: devuelve null y sigue", async () => {
    marcarPagado.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { anotarPago } = await import("~/pages/api/webhook");

    expect(await anotarPago(stripeConLineItems([]), sesionPagada())).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("POST /api/webhook — reintentos de Stripe", () => {
  it("si el pedido ya constaba avisado, no vuelve a mandar el correo", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ORDER_NOTIFICATION_EMAIL", "pedidos@example.com");
    vi.stubEnv("ORDER_FROM_EMAIL", "web@example.com");
    marcarPagado.mockResolvedValue({ id: "pedido-1", notificadoEn: new Date() });

    const { yaAvisado } = await import("~/pages/api/webhook");

    // La decisión vive en una función pura para poder fijarla sin montar
    // toda la petición firmada de Stripe.
    expect(yaAvisado({ id: "pedido-1", notificadoEn: new Date() })).toBe(true);
    expect(yaAvisado({ id: "pedido-1", notificadoEn: null })).toBe(false);
    expect(yaAvisado(null)).toBe(false);
    expect(enviarCorreoMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/tests/api-webhook.test.ts`
Esperado: FALLA — `anotarPago` y `yaAvisado` no están exportados.

- [ ] **Paso 3: Modificar el webhook**

Añadir los imports:

```ts
import {
  marcarPagado,
  marcarAvisado,
  crearPedidoReconstruido,
  type PedidoAnotado,
} from "~/lib/db/pedidos";
```

Añadir estas dos funciones exportadas (antes de `notify`):

```ts
/**
 * Deja constancia del cobro. Se hace ANTES de avisar a nadie: el aviso puede
 * fallar y reintentarse, pero un cobro sin rastro no se recupera.
 *
 * Devuelve null si no se pudo escribir nada. Que Postgres esté caído no puede
 * impedir que el obrador se entere de un pedido pagado: en ese caso se sigue
 * adelante con el correo, que es lo que hace el sitio desde el primer día.
 */
export async function anotarPago(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<PedidoAnotado | null> {
  const pedidoId = session.metadata?.pedidoId || null;

  try {
    const anotado = await marcarPagado({ pedidoId, sessionId: session.id });
    if (anotado) return anotado;

    // No estaba: el checkout no pudo escribirlo. Se reconstruye con lo que
    // da Stripe —sin slugs y sin desglose de envío— y queda marcado como
    // reconstruido para que en el panel no parezca un pedido completo.
    const items = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 50,
    });
    const m = session.metadata ?? {};
    return await crearPedidoReconstruido({
      stripeSessionId: session.id,
      email: session.customer_details?.email ?? "",
      telefono: m.telefono ?? "",
      nombre: m.nombre || null,
      notas: m.notas || null,
      totalCents: session.amount_total ?? 0,
      lineas: items.data.map((i) => ({
        nombre: i.description ?? "",
        qty: i.quantity ?? 1,
        // Stripe da el importe de la línea; el unitario es lo que guardamos.
        unitPriceCents: Math.round((i.amount_total ?? 0) / (i.quantity || 1)),
      })),
    });
  } catch (err) {
    console.error(
      "[webhook] no se pudo anotar el pedido en la base de datos:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Si ya consta avisado, este aviso de Stripe es un reintento de uno que salió
 * bien: no hay que volver a mandar el correo. Función aparte y pura para
 * poder fijarla en una prueba sin montar la petición firmada entera.
 */
export function yaAvisado(anotado: PedidoAnotado | null): boolean {
  return Boolean(anotado?.notificadoEn);
}
```

Sustituir el bloque `try { await notify(...) }` del `POST` por:

```ts
  const anotado = await anotarPago(stripe, session);

  if (yaAvisado(anotado)) {
    // Reintento de un aviso que ya salió. El pedido está pagado y anotado:
    // responder 200 corta la cadena de reintentos.
    return new Response("ya avisado", { status: 200 });
  }

  try {
    const avisado = await notify(stripe, session);
    if (avisado && anotado) await marcarAvisado(anotado.id);
  } catch (err) {
    // Devolver 500 hace que Stripe reintente, que es lo que queremos si el
    // correo falla: el cobro ya está hecho y el obrador tiene que enterarse.
    // Como `notificado_en` sigue nulo, el reintento volverá a intentarlo.
    console.error("[webhook] no se pudo avisar del pedido", err);
    return new Response("notification failed", { status: 500 });
  }
```

Y hacer que `notify` devuelva si avisó de verdad: cambiar su firma a
`export async function notify(...): Promise<boolean>`, devolver `false` en los dos `return`
tempranos (falta de configuración y `!obrador.ok`) y `true` al final. **No se toca nada más de
`notify`**: la regla de todo o nada del correo al cliente se queda como está y sus pruebas siguen
valiendo.

- [ ] **Paso 4: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/tests/api-webhook.test.ts`
Esperado: PASA, incluidas las que ya había.

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add src/pages/api/webhook.ts src/tests/api-webhook.test.ts
git commit -m "feat(pedidos): el webhook marca el pedido pagado sin repetir el aviso"
```

---

### Tarea 4: La guardia de /admin

**Ficheros:**
- Crear: `src/lib/auth/guardia.ts`
- Crear: `src/lib/auth/guardia.test.ts`
- Modificar: `src/middleware.ts`
- Crear: `src/layouts/AdminLayout.astro`
- Crear: `src/pages/admin/index.astro`

**Interfaces:**
- Consume: `App.Locals["usuario"]` que rellena `src/middleware.ts`.
- Produce:
  - `ROL_ADMIN = "admin"`
  - `esAdmin(usuario): boolean`
  - `guardiaAdmin({ usuario, pathname }): Response | null` — la respuesta con la que cortar, o
    `null` si se puede pasar.
  - `AdminLayout.astro` con props `{ titulo: string }`.

**Lo que dice la spec §7 y hay que cumplir al pie de la letra:** sin sesión, redirección a la
pantalla de acceso; **con sesión de cliente, un 404 honesto** — no confirmar que la ruta existe.
Un 403 le dice a cualquier cliente registrado que hay un panel ahí detrás.

`rol` se lee de `locals.usuario`, que el middleware saca de `auth.api.getSession` en cada petición,
y eso lee la fila de `user` en Postgres. Es «comprobar el papel en la base de datos» de la spec, sin
una consulta extra por página.

**La guardia va en el middleware, no en el layout.** Dos motivos, y el primero es que **no
funcionaría de otra forma**: un componente `.astro` (un layout) no puede cortar una petición
devolviendo una `Response` —eso solo lo pueden hacer las páginas y los endpoints—, así que un
`return` dentro de `AdminLayout` no pararía nada y pintaría el panel igual. El segundo es que
ponerla en el middleware significa que **no se puede olvidar en una página nueva**: cualquier ruta
que empiece por `/admin` queda cubierta el día que se cree. Los endpoints de `/api/admin/*` repiten
la comprobación con `esAdmin` (tareas 13 y 19): dos cinturones, porque el que se escribe una vez es
el que se cae.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// src/lib/auth/guardia.test.ts
import { describe, expect, it } from "vitest";
import { esAdmin, guardiaAdmin, ROL_ADMIN } from "~/lib/auth/guardia";

const cliente = { id: "u1", email: "a@b.c", name: "Ana", rol: "cliente" };
const admin = { id: "u2", email: "c@d.e", name: "Carmen", rol: ROL_ADMIN };

describe("esAdmin", () => {
  it("solo es admin quien tiene el papel exacto", () => {
    expect(esAdmin(admin)).toBe(true);
    expect(esAdmin(cliente)).toBe(false);
    expect(esAdmin(null)).toBe(false);
    expect(esAdmin({ ...cliente, rol: null })).toBe(false);
    // Ni parecidos ni mayúsculas: la comparación es exacta a propósito.
    expect(esAdmin({ ...cliente, rol: "Admin" })).toBe(false);
    expect(esAdmin({ ...cliente, rol: "administrador" })).toBe(false);
  });
});

describe("guardiaAdmin", () => {
  it("deja pasar todo lo que no sea del panel, incluso sin sesión", () => {
    expect(guardiaAdmin({ usuario: null, pathname: "/catalogo" })).toBeNull();
    expect(guardiaAdmin({ usuario: null, pathname: "/" })).toBeNull();
    // Una ruta que solo EMPIECE por las mismas letras no es el panel.
    expect(guardiaAdmin({ usuario: null, pathname: "/administracion" })).toBeNull();
  });

  it("sin sesión, manda a /acceso", () => {
    const respuesta = guardiaAdmin({ usuario: null, pathname: "/admin/pedidos" })!;
    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.get("location")).toBe("/acceso");
  });

  it("con sesión de cliente, 404: el panel no se confirma a quien no entra", () => {
    const respuesta = guardiaAdmin({ usuario: cliente, pathname: "/admin/pedidos" })!;
    expect(respuesta.status).toBe(404);
    // Ni una palabra sobre permisos: eso ya diría que la ruta existe.
    expect(respuesta.headers.get("location")).toBeNull();
  });

  it("cubre también los endpoints del panel", () => {
    expect(guardiaAdmin({ usuario: cliente, pathname: "/api/admin/noticias" })!.status).toBe(404);
  });

  it("con sesión de admin, deja pasar", () => {
    expect(guardiaAdmin({ usuario: admin, pathname: "/admin/pedidos" })).toBeNull();
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Ejecutar: `pnpm test src/lib/auth/guardia.test.ts`
Esperado: FALLA con «Failed to load url ~/lib/auth/guardia».

- [ ] **Paso 3: Escribir la guardia**

```ts
// src/lib/auth/guardia.ts
/**
 * Quién entra en el panel. Sin `pg` ni `astro:*` a propósito: así se puede
 * probar sin levantar nada, igual que `~/lib/auth/campos`.
 */

export const ROL_ADMIN = "admin";

type Usuario = App.Locals["usuario"];

/**
 * Comparación exacta contra la constante. Nada de `includes` ni de pasar a
 * minúsculas: el papel lo escribe `scripts/hacer-admin.mjs` con este valor y
 * ninguna variante debe colar.
 */
export function esAdmin(usuario: Usuario): boolean {
  return usuario?.rol === ROL_ADMIN;
}

/** Todo lo que hay debajo de estas rutas está cerrado. */
const RUTAS_PANEL = ["/admin", "/api/admin"];

/** `/administracion` no es `/admin`: o es exacta, o cuelga con una barra. */
const esRutaDelPanel = (pathname: string): boolean =>
  RUTAS_PANEL.some((base) => pathname === base || pathname.startsWith(`${base}/`));

/**
 * Devuelve la respuesta con la que hay que cortar, o null si se puede pasar.
 *
 * Sin sesión: a la pantalla de acceso. Con sesión pero sin ser admin: 404
 * pelado. Es lo que pide la spec §7 y el motivo es concreto — un 403 le
 * confirmaría a cualquier cliente registrado que ahí detrás hay un panel de
 * administración que puede ponerse a probar.
 */
export function guardiaAdmin(contexto: {
  usuario: Usuario;
  pathname: string;
}): Response | null {
  if (!esRutaDelPanel(contexto.pathname)) return null;

  if (!contexto.usuario) {
    return new Response(null, { status: 302, headers: { location: "/acceso" } });
  }
  if (!esAdmin(contexto.usuario)) {
    return new Response("No encontrado", { status: 404 });
  }
  return null;
}
```

- [ ] **Paso 4: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/lib/auth/guardia.test.ts`
Esperado: PASA, 6 pruebas.

- [ ] **Paso 5: Enchufar la guardia en el middleware**

En `src/middleware.ts`, justo **después** del `try/catch` que resuelve la sesión y **antes** del
`return next()` final:

```ts
  // El panel se cierra aquí y no en cada página: un componente `.astro` no
  // puede cortar una petición devolviendo una Response, y una comprobación
  // repetida en cada fichero es una comprobación que algún día falta en el
  // fichero nuevo. Si `getSession` falló arriba, `usuario` es null y esto
  // manda a /acceso, que es el fallo seguro.
  const corte = guardiaAdmin({
    usuario: context.locals.usuario,
    pathname: context.url.pathname,
  });
  if (corte) return corte;
```

con su import arriba:

```ts
import { guardiaAdmin } from "~/lib/auth/guardia";
```

**Ojo con el corte de arriba del middleware:** las páginas prerenderizadas salen antes con
`context.locals.usuario = null; return next();`. Eso está bien —una página del panel nunca se
prerenderiza, porque todas llevan `export const prerender = false`—, pero es la razón por la que
**esa línea de cada página del panel no es opcional**: sin ella, la página se generaría en
construcción, el middleware saldría por el atajo y la guardia no llegaría a correr.

- [ ] **Paso 6: Escribir el marco del panel**

```astro
---
// src/layouts/AdminLayout.astro
import BaseLayout from "~/layouts/BaseLayout.astro";

interface Props {
  titulo: string;
}
const { titulo } = Astro.props;

// Aquí NO se comprueba la sesión: eso lo hace el middleware, que es quien
// puede cortar la petición de verdad. Este layout solo pinta.
//
// Datos de clientes y pedidos: ni caché compartida ni disco del navegador.
Astro.response.headers.set("Cache-Control", "private, no-store");

const secciones = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/clientes", label: "Clientes" },
];
const actual = Astro.url.pathname;
---
<BaseLayout title={`${titulo} — Panel`} description="Panel de administración" noindex>
  <div class="mx-auto max-w-6xl px-4 sm:px-6 py-10">
    <header class="filete pb-4">
      <p class="numeracion">Panel</p>
      <h1 class="font-[family-name:var(--font-display)] text-3xl sm:text-4xl mt-1">{titulo}</h1>
    </header>

    <nav class="mt-6 flex flex-wrap gap-px bg-[color:var(--color-avellana)] border border-[color:var(--color-avellana)]">
      {secciones.map((s) => (
        <a
          href={s.href}
          class:list={[
            "px-4 py-2 text-sm font-semibold bg-[color:var(--color-leche)] hover:bg-[color:var(--color-latte)] transition-colors",
            actual === s.href && "bg-[color:var(--color-latte)] text-[color:var(--color-moka)]",
          ]}
          aria-current={actual === s.href ? "page" : undefined}
        >
          {s.label}
        </a>
      ))}
    </nav>

    <div class="mt-8">
      <slot />
    </div>
  </div>
</BaseLayout>
```

**Antes de escribirlo, comprobar `src/layouts/BaseLayout.astro`:** si no acepta una prop `noindex`,
añadirla ahí (una etiqueta `<meta name="robots" content="noindex" />` cuando sea cierta) o, si el
layout no lo pone fácil, poner esa `<meta>` directamente en `AdminLayout`. El panel **no** puede
indexarse.

- [ ] **Paso 7: Escribir la portada del panel**

```astro
---
// src/pages/admin/index.astro
import AdminLayout from "~/layouts/AdminLayout.astro";

// Obligatorio en TODAS las páginas del panel: sin esto se generaría en
// construcción, el middleware saldría por su atajo de prerenderizado y la
// guardia no llegaría a correr.
export const prerender = false;
---
<AdminLayout titulo="Panel">
  <p class="text-[color:var(--color-ink-muted)] max-w-xl">
    Desde aquí se ven los pedidos que han entrado y los clientes registrados.
  </p>
  <ul class="mt-8 grid gap-px bg-[color:var(--color-avellana)] sm:grid-cols-2 border border-[color:var(--color-avellana)]">
    <li class="bg-[color:var(--color-leche)]">
      <a href="/admin/pedidos" class="flex h-full flex-col p-5 hover:bg-[color:var(--color-latte)] transition-colors">
        <span class="font-[family-name:var(--font-display)] text-xl">Pedidos</span>
        <span class="mt-2 text-sm text-[color:var(--color-ink-muted)]">Lo que ha entrado por la web, del más reciente al más antiguo.</span>
      </a>
    </li>
    <li class="bg-[color:var(--color-leche)]">
      <a href="/admin/clientes" class="flex h-full flex-col p-5 hover:bg-[color:var(--color-latte)] transition-colors">
        <span class="font-[family-name:var(--font-display)] text-xl">Clientes</span>
        <span class="mt-2 text-sm text-[color:var(--color-ink-muted)]">Quién se ha registrado, con su correo y su teléfono.</span>
      </a>
    </li>
  </ul>
</AdminLayout>
```

- [ ] **Paso 8: Comprobar a mano las tres puertas, y que el resto del sitio sigue abierto**

```bash
pnpm dev
```

Con el navegador, en este orden:
1. Sin haber entrado: `http://localhost:4321/admin` → lleva a `/acceso`.
2. Con una cuenta normal recién registrada: `/admin` → **404**, no un mensaje de permisos.
3. La tercera puerta (ser admin) se prueba en la tarea 7, que es la que crea el primer admin.
4. **Sin sesión**, comprobar que el catálogo, la home, `/carrito` y `/contacto` siguen entrando
   con normalidad: la guardia está en el middleware, que corre en todas las peticiones, y un
   error en la comprobación de ruta cerraría el sitio entero.

- [ ] **Paso 9: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add src/lib/auth/guardia.ts src/lib/auth/guardia.test.ts src/middleware.ts src/layouts/AdminLayout.astro src/pages/admin/index.astro src/layouts/BaseLayout.astro
git commit -m "feat(admin): guardia de /admin y marco del panel"
```

---

### Tarea 5: Pantalla de pedidos

**Ficheros:**
- Crear: `src/pages/admin/pedidos.astro`

**Interfaces:**
- Consume: `listarPedidos` (tarea 1), `AdminLayout` (tarea 4), `formatPriceCents` y `formatDateISO`
  de `~/lib/format`, `MODE_COPY` de `~/lib/entrega`, `stores` de `~/data/stores`.
- Produce: nada que consuman otras tareas.

**Solo lectura**, decidido con el cliente el 10 de septiembre de 2026: día, modalidad, destino,
teléfono, líneas e importe. Los estados de preparación se añadirán cuando el obrador diga qué
nombres usa, no antes.

- [ ] **Paso 1: Escribir la página**

```astro
---
// src/pages/admin/pedidos.astro
import AdminLayout from "~/layouts/AdminLayout.astro";
import { listarPedidos, type PedidoConLineas } from "~/lib/db/pedidos";
import { formatPriceCents, formatDateISO } from "~/lib/format";
import { MODE_COPY, ENTREGA_DOMICILIO_COPY } from "~/lib/entrega";
import { stores } from "~/data/stores";

export const prerender = false;

// Igual que en `cuenta.astro`: un fallo de Postgres no puede dejar el panel
// en un 500. Se enseña el aviso y el resto del panel sigue navegable.
let pedidos: PedidoConLineas[] = [];
let fallo = false;
try {
  pedidos = await listarPedidos(100);
} catch (error) {
  fallo = true;
  console.error(
    "No se pudieron cargar los pedidos:",
    error instanceof Error ? error.message : error,
  );
}

const SLOT_LABEL = { morning: "mañana", afternoon: "tarde" } as const;

function destino(p: PedidoConLineas): string {
  if (p.mode === "domicilio") {
    return [p.address, p.postalCode].filter(Boolean).join(" · ");
  }
  const tienda = stores.find((s) => s.id === p.storeId);
  return tienda ? `${tienda.shortName} — ${tienda.address}` : "Recogida";
}
---
<AdminLayout titulo="Pedidos">
  {fallo && (
    <p class="border-l-2 border-[color:var(--color-caramelo)] pl-3 py-2 text-sm">
      Ahora mismo no se pueden leer los pedidos. Vuelve a intentarlo en un
      momento; los cobros siguen estando en el panel de Stripe.
    </p>
  )}

  {!fallo && pedidos.length === 0 && (
    <p class="text-[color:var(--color-ink-muted)]">
      Todavía no ha entrado ningún pedido por la web.
    </p>
  )}

  <ul class="flex flex-col gap-px bg-[color:var(--color-avellana)]">
    {pedidos.map((p) => (
      <li class="bg-[color:var(--color-leche)] p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p class="numeracion">
            {formatDateISO(p.fechaEntrega)} ·
            {" "}{MODE_COPY[p.mode].label}
            {p.mode === "recogida" && p.slot ? ` (${SLOT_LABEL[p.slot]})` : ` (${ENTREGA_DOMICILIO_COPY})`}
          </p>
          <p class="font-[family-name:var(--font-display)] text-xl font-semibold">
            {formatPriceCents(p.totalCents)}
          </p>
        </div>

        <p class="mt-2 text-sm">
          {p.nombre ?? "Sin nombre"} ·
          {" "}<a href={`tel:${p.telefono}`} class="underline font-semibold whitespace-nowrap">{p.telefono}</a> ·
          {" "}<a href={`mailto:${p.email}`} class="underline">{p.email}</a>
        </p>
        <p class="text-sm text-[color:var(--color-ink-muted)]">{destino(p)}</p>

        <ul class="mt-3 text-sm">
          {p.lineas.map((l) => (
            <li>
              {l.qty}× {l.nombre}{l.varianteLabel ? ` — ${l.varianteLabel}` : ""}
              <span class="text-[color:var(--color-ink-muted)]"> · {formatPriceCents(l.unitPriceCents)}/ud</span>
            </li>
          ))}
        </ul>

        {p.notas && (
          <p class="mt-3 text-sm border-l-2 border-[color:var(--color-caramelo)] pl-3">
            {p.notas}
          </p>
        )}

        {p.envioCents > 0 && (
          <p class="mt-2 text-sm text-[color:var(--color-ink-muted)]">
            Reparto: {formatPriceCents(p.envioCents)}
          </p>
        )}

        {p.reconstruido && (
          <p class="mt-3 text-xs text-[color:var(--color-ink-muted)]">
            Reconstruido desde Stripe: puede faltarle detalle. Referencia
            {" "}{p.stripeSessionId}
          </p>
        )}
      </li>
    ))}
  </ul>
</AdminLayout>
```

- [ ] **Paso 2: Comprobar con datos de verdad**

Con la base de pruebas apuntada en `.env`, insertar dos pedidos pagados a mano:

```bash
node --env-file=.env -e "
import('pg').then(async ({default: pg}) => {
  const c = new pg.Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  const { rows } = await c.query(\`insert into pedidos (mode, fecha_entrega, slot, store_id, email, telefono, nombre, notas, subtotal_cents, envio_cents, total_cents, estado) values ('recogida', current_date + 2, 'morning', 'alcobendas', 'ana@example.com', '666123456', 'Ana', 'Sin azúcar por encima', 3700, 0, 3700, 'pagado') returning id\`);
  await c.query('insert into lineas_pedido (pedido_id, slug, nombre, qty, unit_price_cents) values (\$1, \$2, \$3, \$4, \$5)', [rows[0].id, 'tarta-de-queso', 'Tarta de queso', 2, 1850]);
  await c.end();
});
"
pnpm dev
```

Entrar en `/admin/pedidos` (hace falta ser admin: si aún no lo eres, haz antes la tarea 7 y vuelve).
Comprobar: se ve el día, la modalidad, la tienda, el teléfono como enlace `tel:`, las dos unidades
y el total en euros con coma decimal.

- [ ] **Paso 3: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add src/pages/admin/pedidos.astro
git commit -m "feat(admin): pantalla de pedidos"
```

---

### Tarea 6: Pantalla de clientes

**Ficheros:**
- Crear: `src/lib/db/clientes.ts`
- Crear: `src/lib/db/clientes.test.ts`
- Crear: `src/pages/admin/clientes.astro`
- Modificar: `src/layouts/AdminLayout.astro` (nada: la entrada de navegación ya está)

**Interfaces:**
- Produce: `listarClientes(limite?: number): Promise<Cliente[]>` con
  `Cliente = { id, nombre, email, telefono, rol, creadoEn, pedidos }`.

**Qué NO sale por aquí:** ni contraseñas, ni tokens, ni nada de las tablas `account`, `session` o
`verification`. La consulta nombra las columnas una a una, sin `select *`, precisamente para que
añadir una columna sensible a `user` el día de mañana no la publique sola en el panel.

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
// src/lib/db/clientes.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de clientes", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/clientes");

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS, max: 2 });
    repo = await import("~/lib/db/clientes");

    await pool.query(`delete from "user" where email like '%@prueba.test'`);
    await pool.query(
      `insert into "user" (id, name, email, "emailVerified", "updatedAt", telefono, rol)
       values ('cli-1', 'Ana', 'ana@prueba.test', false, now(), '666123456', 'cliente')`,
    );
    await pool.query(
      `insert into account (id, "accountId", "providerId", "userId", password, "updatedAt")
       values ('acc-1', 'ana@prueba.test', 'credential', 'cli-1', 'hash-secretísimo', now())`,
    );
  });

  afterAll(async () => {
    await pool.query(`delete from "user" where email like '%@prueba.test'`);
    await pool.end();
  });

  it("devuelve nombre, correo y teléfono, y nunca la contraseña", async () => {
    const clientes = await repo.listarClientes();
    const ana = clientes.find((c) => c.email === "ana@prueba.test")!;

    expect(ana.nombre).toBe("Ana");
    expect(ana.telefono).toBe("666123456");
    expect(ana.pedidos).toBe(0);
    // Ni el campo, ni el valor, por si alguien mete un `select *`.
    expect(Object.keys(ana)).not.toContain("password");
    expect(JSON.stringify(ana)).not.toContain("hash-secretísimo");
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Ejecutar: `pnpm test src/lib/db/clientes.test.ts`
Esperado: FALLA — el módulo no existe.

- [ ] **Paso 3: Escribir el repositorio**

```ts
// src/lib/db/clientes.ts
import { pool } from "~/lib/db/pool";

/**
 * Los clientes, para el panel. La spec §8 lo dice tal cual: «nombre, correo
 * y teléfono, para conocerlos y poder llamar». Nada más.
 */
export type Cliente = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: string | null;
  creadoEn: Date;
  /** Cuántos pedidos pagados lleva. Es la única cifra que pide el panel. */
  pedidos: number;
};

/**
 * Las columnas van nombradas una a una y jamás `select *`: la tabla `user`
 * es de Better Auth y puede crecer con campos que no deben salir de ahí.
 * La contraseña vive en `account`, y esta consulta no la toca.
 */
export async function listarClientes(limite = 500): Promise<Cliente[]> {
  const { rows } = await pool.query<Cliente>(
    `select u.id,
            u.name          as nombre,
            u.email,
            u.telefono,
            u.rol,
            u."createdAt"   as "creadoEn",
            (select count(*)::int
               from pedidos p
              where p.user_id = u.id and p.estado = 'pagado') as pedidos
       from "user" u
      order by u."createdAt" desc
      limit $1`,
    [limite],
  );
  return rows;
}
```

- [ ] **Paso 4: Ejecutar la prueba y verla pasar**

Ejecutar: `pnpm test src/lib/db/clientes.test.ts`
Esperado: PASA.

- [ ] **Paso 5: Escribir la página**

```astro
---
// src/pages/admin/clientes.astro
import AdminLayout from "~/layouts/AdminLayout.astro";
import { listarClientes, type Cliente } from "~/lib/db/clientes";
import { formatDate } from "~/lib/format";
import { ROL_ADMIN } from "~/lib/auth/guardia";

export const prerender = false;

let clientes: Cliente[] = [];
let fallo = false;
try {
  clientes = await listarClientes();
} catch (error) {
  fallo = true;
  console.error(
    "No se pudieron cargar los clientes:",
    error instanceof Error ? error.message : error,
  );
}
---
<AdminLayout titulo="Clientes">
  {fallo && (
    <p class="border-l-2 border-[color:var(--color-caramelo)] pl-3 py-2 text-sm">
      Ahora mismo no se pueden leer los clientes. Vuelve a intentarlo en un momento.
    </p>
  )}

  {!fallo && clientes.length === 0 && (
    <p class="text-[color:var(--color-ink-muted)]">Todavía no se ha registrado nadie.</p>
  )}

  {clientes.length > 0 && (
    <div class="overflow-x-auto border border-[color:var(--color-avellana)]">
      <table class="w-full text-sm">
        <thead class="bg-[color:var(--color-latte)] text-left">
          <tr>
            <th class="p-3 font-semibold">Nombre</th>
            <th class="p-3 font-semibold">Correo</th>
            <th class="p-3 font-semibold">Teléfono</th>
            <th class="p-3 font-semibold">Pedidos</th>
            <th class="p-3 font-semibold">Alta</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr class="border-t border-[color:var(--color-line)]">
              <td class="p-3">
                {c.nombre}
                {c.rol === ROL_ADMIN && (
                  <span class="numeracion ml-2">Admin</span>
                )}
              </td>
              <td class="p-3"><a href={`mailto:${c.email}`} class="underline">{c.email}</a></td>
              <td class="p-3">
                {c.telefono
                  ? <a href={`tel:${c.telefono}`} class="underline whitespace-nowrap">{c.telefono}</a>
                  : <span class="text-[color:var(--color-ink-muted)]">—</span>}
              </td>
              <td class="p-3">{c.pedidos}</td>
              <td class="p-3 text-[color:var(--color-ink-muted)] whitespace-nowrap">{formatDate(c.creadoEn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</AdminLayout>
```

- [ ] **Paso 6: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add src/lib/db/clientes.ts src/lib/db/clientes.test.ts src/pages/admin/clientes.astro
git commit -m "feat(admin): pantalla de clientes"
```

---

### Tarea 7: El primer admin

**Ficheros:**
- Crear: `scripts/hacer-admin.mjs`
- Modificar: `package.json` (script `admin`)
- Modificar: `tasks/todo.md`

**Interfaces:**
- Consume: la tabla `user` y la constante `"admin"` de `~/lib/auth/guardia`.
- Produce: `pnpm admin correo@ejemplo.com`.

**Por qué un script y no una pantalla.** La spec §7 lo cierra: «No hay registro público de admins».
El primero se hace a mano contra la base de datos; el resto se hará desde el panel cuando exista esa
pantalla. Este script es esa mano, pero comprobada: que la cuenta exista, que se diga en voz alta a
quién se está dando la llave, y nada de SQL escrito al vuelo en una terminal a las tantas.

- [ ] **Paso 1: Escribir el script**

```js
// scripts/hacer-admin.mjs
/**
 * Da el papel de admin a una cuenta que YA existe.
 *
 * Es la única forma de crear el primer admin: la spec cierra que no hay
 * registro público de administradores y que `rol` no se puede pedir al darse
 * de alta (`input: false` en `src/lib/auth/campos.ts`).
 *
 *   pnpm admin correo@ejemplo.com
 *
 * La persona tiene que haberse registrado antes por `/acceso` con su
 * contraseña: aquí no se crean cuentas ni se tocan contraseñas.
 */
import pg from "pg";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Uso: pnpm admin correo@ejemplo.com");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

const { rows } = await cliente.query(
  `update "user" set rol = 'admin' where lower(email) = $1 returning id, name, email, rol`,
  [email],
);

if (rows.length === 0) {
  console.error(
    `No hay ninguna cuenta con el correo ${email}.\n` +
      `Regístrala primero en /acceso y vuelve a ejecutar esto.`,
  );
  await cliente.end();
  process.exit(1);
}

// En voz alta y con nombre: dar esta llave permite cambiar precios.
console.log(`✓ ${rows[0].name} (${rows[0].email}) es ahora admin.`);
await cliente.end();
```

- [ ] **Paso 2: Añadir el script a `package.json`**

En `"scripts"`, junto a `db:migrar`:

```json
    "admin": "node --env-file=.env scripts/hacer-admin.mjs",
```

- [ ] **Paso 3: Probarlo de verdad, las dos ramas**

```bash
# Rama de error: una cuenta que no existe
pnpm admin nadie@example.com
# Esperado: «No hay ninguna cuenta con el correo nadie@example.com», salida 1

# Rama buena: regístrate en /acceso con tu correo y luego
pnpm admin tu-correo@example.com
# Esperado: «✓ Tu Nombre (tu-correo@example.com) es ahora admin.»
```

- [ ] **Paso 4: Cerrar la comprobación manual de la tarea 4**

Con la sesión de esa cuenta (**cerrar sesión y volver a entrar**, para que la sesión traiga el papel
nuevo), abrir `/admin`, `/admin/pedidos` y `/admin/clientes`: se ven las tres. Es la tercera puerta
que quedó pendiente en la tarea 4.

- [ ] **Paso 5: Anotar lo que esto deja abierto**

En `tasks/todo.md`, en «Coherencia y deuda»:

```markdown
- [ ] **Pantalla para dar de alta a otro admin.** Hoy el papel se da con
      `pnpm admin correo@ejemplo.com` contra la base de datos. La spec §7 dice
      que un admin debería poder dar de alta a otro desde el panel; mientras no
      exista, cada alta pasa por alguien con acceso a `DATABASE_URL`
- [ ] **Cerrar y volver a abrir sesión después de `pnpm admin`.** El papel viaja
      en la sesión que resuelve el middleware: quien ya estuviera dentro sigue
      viendo la web como cliente hasta que vuelve a entrar
```

- [ ] **Paso 6: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add scripts/hacer-admin.mjs package.json tasks/todo.md
git commit -m "feat(admin): script para dar el papel de admin al primer usuario"
```

---

**Fin de la parte A.** Antes de seguir: desplegar y comprobar en producción que `/admin` da 404 a
una cuenta de cliente y que el panel se ve con la cuenta de admin. La web pública no ha cambiado.

---

# PARTE B — Las noticias se escriben desde el panel

Al acabar la parte B: las noticias viven en Postgres, se escriben y se publican desde `/admin`,
con foto subida desde el navegador, y se ven en la web al momento. El catálogo sigue en Markdown y
no se toca.

---

### Tarea 8: Caché con invalidación bajo demanda

**Ficheros:**
- Modificar: `astro.config.mjs`
- Crear: `src/lib/cache.ts`
- Crear: `src/lib/cache.test.ts`
- Modificar: `src/env.d.ts`, `.env.example`

**Interfaces:**
- Produce:
  - `invalidar(rutas: string[]): Promise<void>` — nunca lanza.
  - `RUTAS_NOTICIAS`, `RUTAS_CATALOGO` (constantes con las rutas que hay que refrescar).

**La decisión de renderizado, y por qué no es la obvia.** La spec §5.2 pide catálogo, fichas,
noticias y home «en servidor, con caché e invalidación bajo demanda». Eso **no** obliga a poner
`output: "server"`. Se consigue dejando `output: "static"` y marcando `prerender = false`
únicamente en las páginas que leen de la base de datos: esas pasan a ser función y el ISR de
Vercel las cachea; el resto del sitio —tiendas, servicios, legal, tradición— sigue siendo HTML
generado en construcción, que es más rápido y más barato que cualquier caché. Cambiar el sitio
entero a servidor movería 20 páginas que no lo necesitan y no aporta nada.

**El `exclude` no es una optimización, es la seguridad.** Con ISR activado, una página bajo demanda
se cachea y se sirve tal cual a la siguiente persona. Si `/cuenta` o `/admin` entraran en esa caché,
alguien vería los datos de otro. Van excluidas, y hay un paso de comprobación en producción para
demostrarlo. Además, con ISR el middleware corre **dentro** de la función cacheada: solo se ejecuta
cuando hay fallo de caché, otra razón para que ninguna página con sesión pase por ahí.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// src/lib/cache.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("invalidar", () => {
  it("pide cada ruta con la cabecera de invalidación de Vercel", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "token-secreto");
    vi.stubEnv("PUBLIC_SITE_URL", "https://ejemplo.test");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invalidar } = await import("~/lib/cache");
    await invalidar(["/", "/noticias"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://ejemplo.test/");
    expect(opciones.method).toBe("HEAD");
    expect(opciones.headers["x-prerender-revalidate"]).toBe("token-secreto");
  });

  it("sin token configurado no llama a nadie y no lanza", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { invalidar } = await import("~/lib/cache");
    await expect(invalidar(["/noticias"])).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("si la invalidación falla, no lanza: el guardado ya se hizo", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "token-secreto");
    vi.stubEnv("PUBLIC_SITE_URL", "https://ejemplo.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { invalidar } = await import("~/lib/cache");
    await expect(invalidar(["/noticias"])).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/lib/cache.test.ts`
Esperado: FALLA — el módulo no existe.

- [ ] **Paso 3: Escribir el módulo**

```ts
// src/lib/cache.ts
/**
 * Invalidación de la caché de Vercel (ISR).
 *
 * Las páginas públicas que leen de la base de datos se cachean; cuando el
 * panel guarda un cambio, hay que decirle a Vercel que las vuelva a generar.
 * Se hace pidiendo la propia página con la cabecera `x-prerender-revalidate`
 * y el token que va configurado en `astro.config.mjs` como `bypassToken`.
 *
 * NADA de esto puede lanzar hacia arriba. Si la invalidación falla, el cambio
 * ya está guardado y lo que ocurre es que se ve unos minutos más tarde. Tirar
 * el guardado por eso sería cambiar un problema pequeño por uno grande.
 */

/** Lo que hay que refrescar cuando cambia una noticia. */
export const RUTAS_NOTICIAS = ["/", "/noticias"];

/** Lo que hay que refrescar cuando cambia un producto. */
export const RUTAS_CATALOGO = [
  "/",
  "/catalogo",
  "/catalogo/dulce",
  "/catalogo/salado",
  "/catalogo/top-ventas",
];

export async function invalidar(rutas: string[]): Promise<void> {
  const token = import.meta.env.VERCEL_BYPASS_TOKEN;
  const base = import.meta.env.PUBLIC_SITE_URL;

  if (!token || !base) {
    // En local no hay ISR: el aviso deja constancia sin ensuciar producción.
    console.warn(
      "[cache] sin VERCEL_BYPASS_TOKEN o PUBLIC_SITE_URL: no se invalida nada",
    );
    return;
  }

  await Promise.all(
    rutas.map(async (ruta) => {
      try {
        await fetch(new URL(ruta, base), {
          method: "HEAD",
          headers: { "x-prerender-revalidate": token },
        });
      } catch (err) {
        console.error(
          `[cache] no se pudo invalidar ${ruta}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }),
  );
}
```

- [ ] **Paso 4: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/lib/cache.test.ts`
Esperado: PASA, 3 pruebas.

- [ ] **Paso 5: Configurar el ISR en el adaptador**

En `astro.config.mjs`, sustituir `adapter: vercel(),` por:

```js
  adapter: vercel({
    // Las páginas que leen de la base de datos van con `prerender = false`:
    // el ISR las cachea igual que si fueran estáticas y el panel las
    // invalida al guardar (`src/lib/cache.ts`).
    isr: {
      // El mismo valor tiene que estar en el entorno de CONSTRUCCIÓN y en el
      // de ejecución en Vercel: aquí se lee al construir, y `src/lib/cache.ts`
      // al invalidar. Si no coinciden, la invalidación se ignora en silencio.
      bypassToken: process.env.VERCEL_BYPASS_TOKEN,
      // Ninguna página con sesión puede entrar en una caché compartida: lo
      // que se guardara ahí se le serviría a la siguiente persona. Esta lista
      // es una medida de seguridad, no de rendimiento.
      exclude: [
        "/admin",
        "/admin/[...ruta]",
        "/cuenta",
        "/carrito",
        "/acceso",
        "/acceso/[...ruta]",
        "/api/[...ruta]",
      ],
    },
  }),
```

**Comprobar que los patrones de `exclude` coinciden con las rutas reales del proyecto** (`ls
src/pages/admin src/pages/acceso src/pages/api`). Un patrón que no case deja la página dentro de la
caché sin avisar de nada.

- [ ] **Paso 6: Declarar la variable**

En `src/env.d.ts`, dentro de `ImportMetaEnv`:

```ts
  readonly VERCEL_BYPASS_TOKEN: string;
```

En `.env.example`:

```bash
# Invalidar la caché de Vercel cuando el panel publica un cambio.
# Genera uno con: openssl rand -hex 16
# TIENE que estar también en el entorno de CONSTRUCCIÓN de Vercel, no solo en
# el de ejecución: `astro.config.mjs` lo lee al construir.
VERCEL_BYPASS_TOKEN=
```

- [ ] **Paso 7: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add astro.config.mjs src/lib/cache.ts src/lib/cache.test.ts src/env.d.ts .env.example
git commit -m "feat(cache): isr en vercel con invalidación bajo demanda"
```

- [ ] **Paso 8: Comprobar en un despliegue de verdad que la caché no se traga la sesión**

Poner `VERCEL_BYPASS_TOKEN` en Vercel (producción y previsualización, en **ejecución y
construcción**), desplegar y comprobar con dos navegadores distintos, cada uno con una cuenta:

1. `/cuenta` enseña los datos de cada cual, nunca los del otro.
2. En las herramientas de red, la respuesta de `/cuenta` **no** trae `x-vercel-cache: HIT`.
3. `/admin` con una cuenta de cliente sigue dando 404.

Si algo de esto falla, el `exclude` no está casando: arreglarlo antes de seguir con la tarea 9.

---

### Tarea 9: El almacén de fotos

**Ficheros:**
- Crear: `src/lib/storage/imagen.ts`
- Crear: `src/lib/storage/imagen.test.ts`
- Crear: `src/lib/storage/blob.ts`
- Crear: `src/lib/storage/index.ts`
- Modificar: `package.json` (`@vercel/blob`), `astro.config.mjs` (`image.remotePatterns`),
  `src/env.d.ts`, `.env.example`

**Interfaces:**
- Produce:
  - `guardarImagen(fichero: File, carpeta: "productos" | "noticias"): Promise<ImagenGuardada>`
  - `borrarImagen(url: string): Promise<void>`
  - `ImagenGuardada = { url: string; ancho: number; alto: number }`
  - `ImagenError` (mensaje presentable, `status`)

**Por qué Vercel Blob y no Supabase Storage.** La spec §5.4 escribió «Supabase Storage» cuando aún
no se había decidido el proveedor de base de datos; al final la base de datos es Neon. Traer
Supabase solo para los ficheros sería una cuenta más, otro juego de credenciales y otra pieza que
mudar. Vercel Blob ya viene con la cuenta que hay, se sirve por CDN y cuesta una variable de
entorno. **Lo que la spec exige de verdad (§5.3) se cumple igual**: el proveedor solo lo conoce
`src/lib/storage/blob.ts`; el resto del código ve `guardarImagen` y `borrarImagen`. Mudarse a Cloud
Storage es reescribir ese fichero, unas treinta líneas.

**Por qué se guardan el ancho y el alto.** `<Image>` con una URL remota exige `width` y `height`, o
se pone a descargar la imagen para medirla en cada petición. Como ya la estamos procesando con
sharp al subirla, las medidas salen gratis: se guardan en la base de datos y las páginas no vuelven
a tocar el fichero.

- [ ] **Paso 1: Instalar la dependencia**

```bash
pnpm add @vercel/blob
```

- [ ] **Paso 2: Escribir las pruebas que fallan**

```ts
// src/lib/storage/imagen.test.ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  compruebaFichero,
  normaliza,
  ImagenError,
  ANCHO_MAXIMO,
  MAX_BYTES,
} from "~/lib/storage/imagen";

describe("compruebaFichero", () => {
  it("acepta jpeg, png y webp", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
      expect(() => compruebaFichero(tipo, 1000)).not.toThrow();
    }
  });

  it("rechaza cualquier otra cosa con un mensaje que se le puede enseñar a alguien", () => {
    try {
      compruebaFichero("application/pdf", 1000);
      throw new Error("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ImagenError);
      expect((err as ImagenError).message).toMatch(/jpg, png o webp/i);
      // Ni rastro del tipo MIME crudo: el mensaje es para una persona.
      expect((err as ImagenError).message).not.toContain("application/pdf");
    }
  });

  it("rechaza lo que pase del tamaño máximo", () => {
    expect(() => compruebaFichero("image/jpeg", MAX_BYTES + 1)).toThrow(ImagenError);
  });
});

describe("normaliza", () => {
  it("reduce una foto enorme al ancho máximo y devuelve sus medidas", async () => {
    const original = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .toBuffer();

    const salida = await normaliza(original);

    expect(salida.ancho).toBe(ANCHO_MAXIMO);
    expect(salida.alto).toBe(Math.round((ANCHO_MAXIMO * 3000) / 4000));
    expect(salida.tipo).toBe("image/webp");
    // Una foto de móvil sin tocar son varios megas: esto tiene que pesar menos.
    expect(salida.datos.byteLength).toBeLessThan(original.byteLength);
  });

  it("no agranda una foto que ya es pequeña", async () => {
    const original = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .toBuffer();

    const salida = await normaliza(original);
    expect(salida.ancho).toBe(400);
    expect(salida.alto).toBe(300);
  });

  it("rechaza un fichero que no es una imagen aunque diga que lo es", async () => {
    await expect(normaliza(Buffer.from("esto no es una foto"))).rejects.toBeInstanceOf(
      ImagenError,
    );
  });
});
```

- [ ] **Paso 3: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/lib/storage/imagen.test.ts`
Esperado: FALLA — el módulo no existe.

- [ ] **Paso 4: Escribir el procesado de imagen**

```ts
// src/lib/storage/imagen.ts
import sharp from "sharp";

/**
 * Validar y normalizar la foto antes de guardarla. Aquí no se sabe quién es
 * el proveedor de almacenamiento: eso es cosa de `blob.ts`. Este fichero se
 * queda igual el día de la mudanza a Google Cloud.
 */

export class ImagenError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ImagenError";
  }
}

export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BYTES = 8 * 1024 * 1024;
/** Más de esto no lo aprovecha ninguna pantalla del sitio. */
export const ANCHO_MAXIMO = 1600;

/**
 * El mensaje va en cristiano y sin devolver el tipo que mandaron: quien sube
 * la foto es el panadero, no un programador leyendo un log.
 */
export function compruebaFichero(tipo: string, bytes: number): void {
  if (!TIPOS_PERMITIDOS.includes(tipo as (typeof TIPOS_PERMITIDOS)[number])) {
    throw new ImagenError("La foto tiene que ser un jpg, png o webp.");
  }
  if (bytes > MAX_BYTES) {
    throw new ImagenError(
      `La foto pesa demasiado. El máximo son ${MAX_BYTES / 1024 / 1024} MB.`,
    );
  }
}

export type ImagenNormalizada = {
  datos: Buffer;
  ancho: number;
  alto: number;
  tipo: "image/webp";
};

/**
 * Reduce la foto al ancho máximo (nunca la agranda) y la pasa a webp. Las
 * medidas se devuelven porque se guardan en la base de datos: `<Image>` con
 * una URL remota las necesita, y si no las tuviera se pondría a descargar la
 * foto para medirla en cada petición.
 */
export async function normaliza(datos: Buffer): Promise<ImagenNormalizada> {
  try {
    const salida = await sharp(datos)
      .rotate() // respeta la orientación EXIF de las fotos de móvil
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return {
      datos: salida.data,
      ancho: salida.info.width,
      alto: salida.info.height,
      tipo: "image/webp",
    };
  } catch {
    // sharp lanza con detalles del formato: no salen de aquí.
    throw new ImagenError("No hemos podido leer esa foto. Prueba con otra.");
  }
}
```

- [ ] **Paso 5: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/lib/storage/imagen.test.ts`
Esperado: PASA, 6 pruebas.

- [ ] **Paso 6: Escribir el proveedor y la interfaz**

```ts
// src/lib/storage/blob.ts
import { put, del } from "@vercel/blob";

/**
 * El ÚNICO fichero del proyecto que sabe que los ficheros están en Vercel
 * Blob. La spec §5.3 lo pide así: mudarse a Cloud Storage es reescribir esto
 * y nada más. Si algún día aparece un `import` de `@vercel/blob` en otro
 * sitio, esa promesa se ha roto.
 */

export async function sube(
  ruta: string,
  datos: Buffer,
  tipo: string,
): Promise<string> {
  const { url } = await put(ruta, datos, {
    access: "public",
    contentType: tipo,
    // El nombre lo componemos nosotros con un sufijo propio (ver index.ts):
    // no hace falta que el proveedor añada el suyo, y así la URL es legible.
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}

export async function borra(url: string): Promise<void> {
  await del(url);
}
```

```ts
// src/lib/storage/index.ts
import { compruebaFichero, normaliza } from "~/lib/storage/imagen";
import { sube, borra } from "~/lib/storage/blob";

export { ImagenError } from "~/lib/storage/imagen";

export type ImagenGuardada = { url: string; ancho: number; alto: number };

export type Carpeta = "productos" | "noticias";

/** Sin acentos, sin espacios y sin sorpresas: esto acaba en una URL. */
function nombreSeguro(nombre: string): string {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "foto"
  );
}

/**
 * Guarda una foto y devuelve su URL y sus medidas. El sufijo con la fecha
 * evita que subir una foto nueva con el mismo nombre pise a la anterior, que
 * puede seguir usada por otra ficha.
 */
export async function guardarImagen(
  fichero: File,
  carpeta: Carpeta,
): Promise<ImagenGuardada> {
  compruebaFichero(fichero.type, fichero.size);

  const original = Buffer.from(await fichero.arrayBuffer());
  const { datos, ancho, alto, tipo } = await normaliza(original);

  const ruta = `${carpeta}/${nombreSeguro(fichero.name)}-${Date.now()}.webp`;
  const url = await sube(ruta, datos, tipo);

  return { url, ancho, alto };
}

/**
 * Borra una foto. Que falle no puede tumbar el guardado de la ficha: una foto
 * huérfana en el almacén cuesta céntimos; una ficha que no se deja guardar
 * cuesta una llamada del cliente.
 */
export async function borrarImagen(url: string): Promise<void> {
  try {
    await borra(url);
  } catch (err) {
    console.error(
      "[storage] no se pudo borrar la foto:",
      err instanceof Error ? err.message : err,
    );
  }
}
```

- [ ] **Paso 7: Autorizar el dominio de las fotos y declarar la variable**

En `astro.config.mjs`, al nivel de `output` y `adapter`:

```js
  // Las fotos del panel viven en Vercel Blob: sin esto, `<Image>` no las
  // optimiza (y ni siquiera las sirve, según el caso).
  image: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
```

**Comprobar el dominio real** después de la primera subida: la URL que devuelve `put` tiene la
forma `https://<id>.public.blob.vercel-storage.com/...`. Si no coincide con el patrón, ajustarlo.

En `src/env.d.ts`: `readonly BLOB_READ_WRITE_TOKEN: string;`

En `.env.example`:

```bash
# Vercel Blob — fotos de productos y noticias.
# Panel de Vercel > Storage > Blob > crear almacén y copiar el token.
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Paso 8: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add src/lib/storage package.json pnpm-lock.yaml astro.config.mjs src/env.d.ts .env.example
git commit -m "feat(storage): almacén de fotos detrás de una interfaz propia"
```

---

### Tarea 10: Tabla y repositorio de noticias

**Ficheros:**
- Crear: `db/migrations/006_noticias.sql`
- Crear: `src/lib/db/noticias.ts`
- Crear: `src/lib/db/noticias.test.ts`
- Crear: `src/lib/slug.ts`, `src/lib/slug.test.ts`
- Crear: `src/lib/markdown.ts`
- Modificar: `package.json` (`@astrojs/markdown-remark`)

**Interfaces:**
- Produce:
  - `slugify(texto: string): string` (en `~/lib/slug`)
  - `aHtml(markdown: string): Promise<string>` (en `~/lib/markdown`)
  - `listarNoticias({ soloPublicadas }): Promise<Noticia[]>`
  - `obtenerNoticia(slug: string, opts?: { soloPublicada?: boolean }): Promise<Noticia | null>`
  - `crearNoticia(datos: DatosNoticia): Promise<Noticia>`
  - `actualizarNoticia(id: string, datos: DatosNoticia): Promise<Noticia | null>`
  - `borrarNoticia(id: string): Promise<number>`
  - `NoticiaError` con `status`
  - Tipos `Noticia`, `DatosNoticia`

**Por qué `@astrojs/markdown-remark` y no otra librería.** El cuerpo de las noticias sigue siendo
Markdown, pero ahora sale de una columna, no de un fichero, así que `<Content />` ya no vale. Este
paquete es el que usa Astro por dentro para los Markdown del proyecto: el resultado sale idéntico al
de ahora, con la misma configuración, en vez de parecido.

**Aviso de seguridad que hay que dejar escrito:** el Markdown de Astro permite HTML en crudo. Aquí
solo escribe un admin, y un admin ya puede cambiar precios, así que no añade un riesgo nuevo — pero
si algún día se abre a más gente, hay que sanear la salida.

- [ ] **Paso 1: Instalar la dependencia**

```bash
pnpm add @astrojs/markdown-remark
```

- [ ] **Paso 2: Escribir la migración**

```sql
-- db/migrations/006_noticias.sql
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
```

- [ ] **Paso 3: Aplicar la migración a la base de pruebas**

```bash
DATABASE_URL="$DATABASE_URL_TEST" pnpm db:migrar
```

Esperado: `✓ 006_noticias.sql`.

- [ ] **Paso 4: Escribir las pruebas que fallan**

```ts
// src/lib/slug.test.ts
import { describe, expect, it } from "vitest";
import { slugify } from "~/lib/slug";

describe("slugify", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(slugify("Roscón de Reyes 2026 — ¡reservas abiertas!")).toBe(
      "roscon-de-reyes-2026-reservas-abiertas",
    );
  });

  it("no deja guiones sueltos ni al principio ni al final", () => {
    expect(slugify("  ¿Y esto?  ")).toBe("y-esto");
  });

  it("nunca devuelve vacío: un slug vacío rompería la URL", () => {
    expect(slugify("💥")).toBe("noticia");
  });
});
```

```ts
// src/lib/db/noticias.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de noticias", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/noticias");

  const datos = (extra: Record<string, unknown> = {}) => ({
    titulo: "Roscón de Reyes 2026",
    excerpt: "Reservas abiertas hasta el 3 de enero.",
    cuerpo: "El roscón es el postre de la casa.\n\n**Reservas:** en tienda.",
    fecha: "2025-12-15",
    imageUrl: "https://x.public.blob.vercel-storage.com/noticias/roscon.webp",
    imageAlt: "Roscón de Reyes con nata",
    imageWidth: 1600,
    imageHeight: 1000,
    tags: ["temporada", "navidad"],
    publicada: true,
    ...extra,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS, max: 2 });
    repo = await import("~/lib/db/noticias");
    await pool.query("delete from noticias");
  });

  afterAll(async () => {
    await pool.query("delete from noticias");
    await pool.end();
  });

  it("crea una noticia y le saca el slug del título", async () => {
    const noticia = await repo.crearNoticia(datos());
    expect(noticia.slug).toBe("roscon-de-reyes-2026");
    expect(noticia.tags).toEqual(["temporada", "navidad"]);
    expect(noticia.imageWidth).toBe(1600);
  });

  it("no deja dos noticias con el mismo slug: lo dice en cristiano", async () => {
    await expect(repo.crearNoticia(datos())).rejects.toMatchObject({
      name: "NoticiaError",
      status: 409,
    });
    // El mensaje no puede escupir el nombre del índice de Postgres.
    await expect(repo.crearNoticia(datos())).rejects.toThrow(/ya hay una noticia/i);
  });

  it("una noticia sin publicar no sale en la web pero sí en el panel", async () => {
    await repo.crearNoticia(datos({ titulo: "Borrador de San Valentín", publicada: false }));

    const publicas = await repo.listarNoticias({ soloPublicadas: true });
    expect(publicas.map((n) => n.titulo)).not.toContain("Borrador de San Valentín");

    const todas = await repo.listarNoticias({ soloPublicadas: false });
    expect(todas.map((n) => n.titulo)).toContain("Borrador de San Valentín");

    // Y tampoco se puede llegar a ella por su URL adivinando el slug.
    expect(
      await repo.obtenerNoticia("borrador-de-san-valentin", { soloPublicada: true }),
    ).toBeNull();
    expect(await repo.obtenerNoticia("borrador-de-san-valentin")).not.toBeNull();
  });

  it("actualiza y borra", async () => {
    const noticia = await repo.crearNoticia(datos({ titulo: "Torrijas 2026" }));
    const cambiada = await repo.actualizarNoticia(noticia.id, {
      ...datos({ titulo: "Torrijas 2026" }),
      excerpt: "Solo en Semana Santa.",
    });
    expect(cambiada?.excerpt).toBe("Solo en Semana Santa.");
    expect(await repo.borrarNoticia(noticia.id)).toBe(1);
    expect(await repo.borrarNoticia(noticia.id)).toBe(0);
  });

  it("las publicadas salen de la más reciente a la más antigua", async () => {
    await pool.query("delete from noticias");
    await repo.crearNoticia(datos({ titulo: "Vieja", fecha: "2025-01-01" }));
    await repo.crearNoticia(datos({ titulo: "Nueva", fecha: "2026-01-01" }));
    const lista = await repo.listarNoticias({ soloPublicadas: true });
    expect(lista.map((n) => n.titulo)).toEqual(["Nueva", "Vieja"]);
  });
});
```

- [ ] **Paso 5: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/lib/slug.test.ts src/lib/db/noticias.test.ts`
Esperado: FALLAN — los módulos no existen.

- [ ] **Paso 6: Escribir los tres módulos**

```ts
// src/lib/slug.ts
/**
 * Slug para una URL a partir de un título. Vive aparte de los repositorios
 * porque lo usan las noticias y los productos, y porque es lógica pura que se
 * prueba sin base de datos.
 */
export function slugify(texto: string): string {
  const limpio = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  // Un slug vacío rompería la URL: mejor uno feo que una página en /noticias/.
  return limpio || "noticia";
}
```

```ts
// src/lib/markdown.ts
import { createMarkdownProcessor } from "@astrojs/markdown-remark";

/**
 * El cuerpo de noticias y fichas ahora sale de una columna, no de un fichero,
 * así que `<Content />` de `astro:content` ya no sirve. Este es el mismo
 * procesador que usa Astro por dentro: el HTML sale idéntico al de los
 * Markdown de antes, no parecido.
 *
 * OJO: el Markdown de Astro deja pasar HTML en crudo. Hoy solo escribe aquí
 * un admin —que ya puede cambiar precios—, así que no añade riesgo nuevo. Si
 * algún día escribe más gente, hay que sanear la salida.
 *
 * El procesador se crea una sola vez por instancia: montarlo cuesta y se
 * reaprovecha entre peticiones de la misma función.
 */
let procesador: ReturnType<typeof createMarkdownProcessor> | null = null;

export async function aHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) return "";
  procesador ??= createMarkdownProcessor();
  const { code } = await (await procesador).render(markdown);
  return code;
}
```

```ts
// src/lib/db/noticias.ts
import { pool } from "~/lib/db/pool";
import { slugify } from "~/lib/slug";

/**
 * Noticias. Único sitio con SQL de noticias; hacia fuera, camelCase.
 */

export class NoticiaError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "NoticiaError";
  }
}

export type Noticia = {
  id: string;
  slug: string;
  titulo: string;
  excerpt: string;
  cuerpo: string;
  fecha: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  tags: string[];
  publicada: boolean;
};

export type DatosNoticia = {
  titulo: string;
  excerpt: string;
  cuerpo: string;
  fecha: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  tags: string[];
  publicada: boolean;
  /** Solo lo usa el volcado inicial, para conservar las URLs de siempre. */
  slug?: string;
};

const CAMPOS = `
  id, slug, titulo, excerpt, cuerpo,
  to_char(fecha, 'YYYY-MM-DD') as fecha,
  image_url    as "imageUrl",
  image_alt    as "imageAlt",
  image_width  as "imageWidth",
  image_height as "imageHeight",
  tags, publicada
`;

/**
 * Traduce los errores de Postgres a algo que se le puede enseñar a quien está
 * escribiendo la noticia. Mismo criterio que `direccionesErrores.ts`: el texto
 * de un índice único no sale nunca a la pantalla.
 */
function traduce(err: unknown): never {
  if (err instanceof NoticiaError) throw err;
  if (typeof err === "object" && err && "code" in err && err.code === "23505") {
    throw new NoticiaError(
      "Ya hay una noticia con ese título. Cámbialo un poco.",
      409,
    );
  }
  throw err;
}

export async function listarNoticias(
  { soloPublicadas }: { soloPublicadas: boolean },
): Promise<Noticia[]> {
  const { rows } = await pool.query<Noticia>(
    `select ${CAMPOS} from noticias
      ${soloPublicadas ? "where publicada" : ""}
      order by fecha desc, created_at desc`,
  );
  return rows;
}

export async function obtenerNoticia(
  slug: string,
  { soloPublicada = false }: { soloPublicada?: boolean } = {},
): Promise<Noticia | null> {
  const { rows } = await pool.query<Noticia>(
    `select ${CAMPOS} from noticias
      where slug = $1 ${soloPublicada ? "and publicada" : ""}`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function crearNoticia(datos: DatosNoticia): Promise<Noticia> {
  try {
    const { rows } = await pool.query<Noticia>(
      `insert into noticias
         (slug, titulo, excerpt, cuerpo, fecha, image_url, image_alt,
          image_width, image_height, tags, publicada)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning ${CAMPOS}`,
      [
        datos.slug ?? slugify(datos.titulo),
        datos.titulo,
        datos.excerpt,
        datos.cuerpo,
        datos.fecha,
        datos.imageUrl,
        datos.imageAlt,
        datos.imageWidth,
        datos.imageHeight,
        datos.tags,
        datos.publicada,
      ],
    );
    return rows[0];
  } catch (err) {
    traduce(err);
  }
}

/**
 * El slug NO se recalcula al editar: si alguien corrige una errata del título,
 * la URL que ya está compartida por ahí fuera tiene que seguir funcionando.
 */
export async function actualizarNoticia(
  id: string,
  datos: DatosNoticia,
): Promise<Noticia | null> {
  try {
    const { rows } = await pool.query<Noticia>(
      `update noticias set
         titulo = $2, excerpt = $3, cuerpo = $4, fecha = $5,
         image_url = $6, image_alt = $7, image_width = $8, image_height = $9,
         tags = $10, publicada = $11, updated_at = now()
       where id = $1
       returning ${CAMPOS}`,
      [
        id,
        datos.titulo,
        datos.excerpt,
        datos.cuerpo,
        datos.fecha,
        datos.imageUrl,
        datos.imageAlt,
        datos.imageWidth,
        datos.imageHeight,
        datos.tags,
        datos.publicada,
      ],
    );
    return rows[0] ?? null;
  } catch (err) {
    traduce(err);
  }
}

export async function borrarNoticia(id: string): Promise<number> {
  const { rowCount } = await pool.query("delete from noticias where id = $1", [id]);
  return rowCount ?? 0;
}
```

- [ ] **Paso 7: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/lib/slug.test.ts src/lib/db/noticias.test.ts`
Esperado: PASAN, 8 pruebas.

- [ ] **Paso 8: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add db/migrations/006_noticias.sql src/lib/db/noticias.ts src/lib/db/noticias.test.ts src/lib/slug.ts src/lib/slug.test.ts src/lib/markdown.ts package.json pnpm-lock.yaml
git commit -m "feat(noticias): tabla, repositorio y renderizado de markdown"
```

---

### Tarea 11: Volcar las noticias que ya existen

**Ficheros:**
- Crear: `scripts/migrar-noticias.mjs`
- Modificar: `package.json` (`gray-matter` como dependencia de desarrollo, script `migrar:noticias`)

**Interfaces:**
- Consume: los 5 Markdown de `src/content/noticias/`, las fotos de `public/images/noticias/`,
  `@vercel/blob` y la tabla `noticias`.
- Produce: `pnpm migrar:noticias` y `pnpm migrar:noticias --verificar`.

**El paso 4 de la spec §10 no es burocracia.** Antes de retirar nada hay que comprobar ficha a ficha
que lo que hay en la base de datos es lo que había en los ficheros. Aquí son 5 noticias y parece
tontería; en la tarea 15 son 98 fichas y es la diferencia entre migrar y perder la carta. El
mecanismo se estrena aquí, donde es barato equivocarse.

**Idempotente a propósito:** volver a ejecutarlo no duplica nada. Se va a ejecutar más de una vez
(en pruebas, en producción, después de un fallo a medias).

- [ ] **Paso 1: Instalar la dependencia de desarrollo**

```bash
pnpm add -D gray-matter
```

Es el lector de *frontmatter* de siempre. Solo lo usan los scripts de migración: no entra en el
sitio.

- [ ] **Paso 2: Escribir el script**

```js
// scripts/migrar-noticias.mjs
/**
 * Vuelca las noticias de `src/content/noticias/*.md` a la tabla `noticias`,
 * subiendo sus fotos al almacén.
 *
 *   pnpm migrar:noticias              vuelca (y sube fotos)
 *   pnpm migrar:noticias --verificar  no escribe: solo compara y avisa
 *
 * Se puede ejecutar las veces que haga falta: cada noticia se identifica por
 * su slug —el nombre del fichero, para que las URLs de siempre no cambien— y
 * se actualiza en vez de duplicarse.
 *
 * Importa `@vercel/blob` directamente en vez de pasar por `src/lib/storage`
 * porque esto es un script de Node suelto, fuera del build de Astro, y no
 * resuelve el alias `~`. Es una migración que se ejecuta una vez, no parte
 * de la aplicación.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";
import pg from "pg";
import { put } from "@vercel/blob";
import sharp from "sharp";

const DIR = "src/content/noticias";
const soloVerificar = process.argv.includes("--verificar");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
if (!soloVerificar && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN: sin él no se pueden subir las fotos");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

/** La ruta del frontmatter es relativa al .md: `../../../public/...`. */
function rutaFoto(valor) {
  return valor.replace(/^(\.\.\/)+/, "");
}

async function subeFoto(ruta) {
  const original = await readFile(ruta);
  const salida = await sharp(original)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const nombre = basename(ruta).replace(/\.[a-z0-9]+$/i, "");
  const { url } = await put(`noticias/${nombre}.webp`, salida.data, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url, ancho: salida.info.width, alto: salida.info.height };
}

const ficheros = (await readdir(DIR)).filter((f) => f.endsWith(".md")).sort();
let escritas = 0;
let problemas = 0;

for (const fichero of ficheros) {
  const slug = basename(fichero, ".md");
  const { data, content } = matter(await readFile(join(DIR, fichero), "utf8"));

  const fecha =
    data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date).slice(0, 10);

  if (soloVerificar) {
    const { rows } = await cliente.query(
      `select titulo, excerpt, cuerpo, to_char(fecha,'YYYY-MM-DD') as fecha,
              image_url, image_alt, tags, publicada
         from noticias where slug = $1`,
      [slug],
    );
    if (rows.length === 0) {
      console.error(`✗ ${slug}: no está en la base de datos`);
      problemas++;
      continue;
    }
    const fila = rows[0];
    const diferencias = [];
    if (fila.titulo !== data.title) diferencias.push(`título: «${fila.titulo}» ≠ «${data.title}»`);
    if (fila.excerpt !== data.excerpt) diferencias.push("excerpt distinto");
    if (fila.cuerpo.trim() !== content.trim()) diferencias.push("cuerpo distinto");
    if (fila.fecha !== fecha) diferencias.push(`fecha: ${fila.fecha} ≠ ${fecha}`);
    if (fila.image_alt !== data.imageAlt) diferencias.push("texto alternativo distinto");
    if (!fila.image_url) diferencias.push("sin foto");
    if (fila.publicada === Boolean(data.draft)) diferencias.push("publicada al revés");
    if (JSON.stringify(fila.tags) !== JSON.stringify(data.tags ?? []))
      diferencias.push("etiquetas distintas");

    if (diferencias.length) {
      console.error(`✗ ${slug}: ${diferencias.join("; ")}`);
      problemas++;
    } else {
      console.log(`✓ ${slug}`);
    }
    continue;
  }

  const foto = data.image ? await subeFoto(rutaFoto(data.image)) : null;

  await cliente.query(
    `insert into noticias
       (slug, titulo, excerpt, cuerpo, fecha, image_url, image_alt,
        image_width, image_height, tags, publicada)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (slug) do update set
       titulo = excluded.titulo, excerpt = excluded.excerpt,
       cuerpo = excluded.cuerpo, fecha = excluded.fecha,
       image_url = excluded.image_url, image_alt = excluded.image_alt,
       image_width = excluded.image_width, image_height = excluded.image_height,
       tags = excluded.tags, publicada = excluded.publicada,
       updated_at = now()`,
    [
      slug,
      data.title,
      data.excerpt,
      content.trim(),
      fecha,
      foto?.url ?? null,
      data.imageAlt ?? null,
      foto?.ancho ?? null,
      foto?.alto ?? null,
      data.tags ?? [],
      !data.draft,
    ],
  );
  console.log(`✓ ${slug}`);
  escritas++;
}

await cliente.end();

if (soloVerificar) {
  console.log(
    problemas === 0
      ? `\nTodo cuadra: ${ficheros.length} noticias.`
      : `\n${problemas} noticia(s) NO cuadran. No retires nada todavía.`,
  );
  process.exit(problemas === 0 ? 0 : 1);
}
console.log(`\n${escritas} noticia(s) volcadas. Ahora: pnpm migrar:noticias --verificar`);
```

- [ ] **Paso 3: Añadir el script a `package.json`**

```json
    "migrar:noticias": "node --env-file=.env scripts/migrar-noticias.mjs",
```

- [ ] **Paso 4: Ejecutarlo contra la base de pruebas y verificar**

```bash
pnpm migrar:noticias
pnpm migrar:noticias --verificar
```

Esperado: 5 ✓ al volcar y `Todo cuadra: 5 noticias.` al verificar, con salida 0.

- [ ] **Paso 5: Romperlo a propósito, para saber que la verificación verifica**

Cambiar a mano el título de una noticia en la base de pruebas (con `psql`, con el editor de tablas
de Neon o con un `node --env-file=.env -e` de una línea):

```sql
update noticias set titulo = 'Título cambiado' where slug = 'roscon-reyes-2026';
```

Y volver a verificar:

```bash
pnpm migrar:noticias --verificar
```

Esperado: `✗ roscon-reyes-2026: título: «Título cambiado» ≠ «Roscón de Reyes 2026 — reservas
abiertas»` y salida 1. **Si esto pasa en verde, la verificación no verifica y hay que arreglarla
antes de seguir** (es exactamente la lección de `tasks/lessons.md`). Después, volver a ejecutar
`pnpm migrar:noticias` para dejarlo bien.

- [ ] **Paso 6: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add scripts/migrar-noticias.mjs package.json pnpm-lock.yaml
git commit -m "feat(noticias): volcado y verificación de las noticias en markdown"
```

---

### Tarea 12: Las noticias públicas salen de la base de datos

**Ficheros:**
- Modificar: `src/pages/noticias/index.astro`, `src/pages/noticias/[slug].astro`
- Modificar: `src/components/NewsCard.astro`, `src/components/NewsCarousel.astro`
- Modificar: `src/pages/index.astro` (si enseña noticias)
- Crear: `src/pages/sitemap-contenido.xml.ts`
- Modificar: `public/robots.txt`

**Interfaces:**
- Consume: `listarNoticias`, `obtenerNoticia` (tarea 10), `aHtml` (tarea 10).
- Produce: `NewsCard` acepta `imagen: { url, alt, ancho, alto } | null` en vez de `ImageMetadata`.

**El sitemap se rompe si no se hace algo.** `@astrojs/sitemap` solo recoge páginas prerenderizadas.
En cuanto `/noticias/[slug]` pasa a bajo demanda, esas URLs desaparecen del sitemap. Se arregla con
un sitemap propio para el contenido que vive en la base de datos, declarado en `robots.txt` junto al
que ya hay. Es un fichero pequeño y evita una pérdida de indexación silenciosa.

- [ ] **Paso 1: Adaptar la tarjeta a las fotos remotas**

En `src/components/NewsCard.astro`, cambiar las props y la imagen:

```astro
---
import { Image } from "astro:assets";
import { formatDate } from "~/lib/format";

interface Props {
  slug: string;
  title: string;
  excerpt: string;
  date: Date;
  /**
   * La foto ya no es un fichero del repositorio sino una URL del almacén, y
   * `<Image>` con URL remota necesita las medidas: vienen de la base de datos,
   * guardadas al subirla, para no descargar la foto solo para medirla.
   */
  imagen: { url: string; alt: string; ancho: number; alto: number } | null;
}
const { slug, title, excerpt, date, imagen } = Astro.props;
---
<article class="group bg-[color:var(--color-paper)] border border-[color:var(--color-line)] rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
  <a href={`/noticias/${slug}`} class="block">
    <div class="aspect-[16/10] overflow-hidden">
      {imagen ? (
        <Image
          src={imagen.url}
          alt={imagen.alt}
          width={imagen.ancho}
          height={imagen.alto}
          widths={[400, 800]}
          sizes="(min-width:768px) 400px, 100vw"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div class="w-full h-full flex items-center justify-center bg-[color:var(--color-latte)]" aria-hidden="true">
          <span class="numeracion">Foto pendiente</span>
        </div>
      )}
    </div>
  </a>
  <!-- el resto de la tarjeta, igual que estaba -->
```

Ajustar `NewsCarousel.astro` para que pase `imagen` en vez de `image`/`imageAlt`, y su prop `items`
al tipo `Noticia[]` de `~/lib/db/noticias`.

- [ ] **Paso 2: Reescribir el listado**

```astro
---
// src/pages/noticias/index.astro
import MarketingLayout from "~/layouts/MarketingLayout.astro";
import NewsCarousel from "~/components/NewsCarousel.astro";
import { listarNoticias, type Noticia } from "~/lib/db/noticias";

// Lee de la base de datos: bajo demanda, con la caché ISR delante
// (`astro.config.mjs`) y el panel invalidándola al publicar.
export const prerender = false;

let items: Noticia[] = [];
try {
  items = await listarNoticias({ soloPublicadas: true });
} catch (error) {
  // Que la base de datos falle no puede tumbar una página pública: se enseña
  // la sección vacía, que es feo pero navegable.
  console.error(
    "No se pudieron cargar las noticias:",
    error instanceof Error ? error.message : error,
  );
}
---
<MarketingLayout
  title="Noticias y promociones"
  description="Roscón de Reyes, San Valentín, Día del Padre, fiestas patronales y más."
>
  <section class="mx-auto max-w-6xl px-4 sm:px-6 py-12">
    <p class="numeracion">Noticias</p>
    <h1 class="text-4xl sm:text-5xl mt-2">Lo que tenemos esta temporada.</h1>
    <div class="mt-10">
      {items.length > 0 ? (
        <NewsCarousel items={items} />
      ) : (
        <p class="text-[color:var(--color-ink-muted)]">
          Ahora mismo no hay nada publicado. Vuelve en unos días.
        </p>
      )}
    </div>
  </section>
</MarketingLayout>
```

- [ ] **Paso 3: Reescribir la ficha**

En `src/pages/noticias/[slug].astro`: quitar `getStaticPaths` entero y sustituir la cabecera por:

```astro
---
import { Image } from "astro:assets";
import MarketingLayout from "~/layouts/MarketingLayout.astro";
import { formatDate } from "~/lib/format";
import { site } from "~/data/site";
import { obtenerNoticia } from "~/lib/db/noticias";
import { aHtml } from "~/lib/markdown";

export const prerender = false;

const { slug } = Astro.params;
// `soloPublicada`: un borrador no se ve escribiendo su URL a mano.
const item = slug ? await obtenerNoticia(slug, { soloPublicada: true }) : null;
if (!item) return new Response("No encontrado", { status: 404 });

const cuerpo = await aHtml(item.cuerpo);
const fecha = new Date(`${item.fecha}T00:00:00`);
---
```

En el cuerpo de la página: `item.data.title` → `item.titulo`, `item.data.excerpt` → `item.excerpt`,
`formatDate(item.data.date)` → `formatDate(fecha)`, el `<Image>` pasa a
`src={item.imageUrl} width={item.imageWidth} height={item.imageHeight}` dentro de su
`{item.imageUrl ? ... : ...}`, y `<Content />` se sustituye por:

```astro
      <div class="prose prose-stone mt-8 max-w-none [&_p]:my-4 text-[color:var(--color-ink)]" set:html={cuerpo} />
```

En el `jsonLd`: `datePublished: fecha.toISOString()` y `image: item.imageUrl ?? undefined` (la URL
del almacén ya es absoluta: no hay que envolverla en `new URL(..., Astro.site)`).

- [ ] **Paso 4: El sitemap del contenido**

```ts
// src/pages/sitemap-contenido.xml.ts
import type { APIRoute } from "astro";
import { listarNoticias } from "~/lib/db/noticias";

/**
 * `@astrojs/sitemap` solo recoge las páginas que se generan en construcción.
 * Las noticias (y en la parte C, las fichas de producto) ya no lo son, así que
 * sin esto desaparecerían del sitemap sin que nadie se enterase hasta perder
 * el posicionamiento. Va declarado en `public/robots.txt` junto al otro.
 */
export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("https://hornosanlorenzo-demo.vercel.app");

  let urls: { loc: string }[] = [];
  try {
    const noticias = await listarNoticias({ soloPublicadas: true });
    urls = noticias.map((n) => ({ loc: new URL(`/noticias/${n.slug}`, base).toString() }));
  } catch (error) {
    // Un sitemap vacío es mejor que un 500: los buscadores reintentan.
    console.error(
      "No se pudo construir el sitemap de contenido:",
      error instanceof Error ? error.message : error,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
```

Y en `public/robots.txt`, añadir una línea:

```
Sitemap: https://hornosanlorenzo-demo.vercel.app/sitemap-contenido.xml
```

- [ ] **Paso 5: Comprobar a mano**

```bash
pnpm dev
```

1. `/noticias` enseña las 5.
2. `/noticias/roscon-reyes-2026` se ve igual que antes: foto, fecha, cuerpo con la negrita puesta.
3. Despublicar una a mano
   (`update noticias set publicada = false where slug = 'navidad-2025'`): desaparece del listado y
   su URL da 404.
4. `/sitemap-contenido.xml` lista las publicadas.
5. Una URL que no existe (`/noticias/inventada`) da 404, no un error.

- [ ] **Paso 6: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add src/pages/noticias src/components/NewsCard.astro src/components/NewsCarousel.astro src/pages/sitemap-contenido.xml.ts public/robots.txt src/pages/index.astro
git commit -m "feat(noticias): las noticias públicas salen de la base de datos"
```

---

### Tarea 13: Escribir noticias desde el panel

**Ficheros:**
- Crear: `src/pages/api/admin/imagen.ts`
- Crear: `src/pages/api/admin/noticias.ts`
- Crear: `src/tests/api-admin.test.ts`
- Crear: `src/islands/AdminNoticias.tsx`
- Crear: `src/pages/admin/noticias.astro`
- Modificar: `src/layouts/AdminLayout.astro` (entrada de navegación)
- Modificar: `src/content.config.ts` (se retira la colección `noticias`)
- Retirar: `src/content/noticias/`, `public/images/noticias/`

**Interfaces:**
- Consume: todo lo anterior de la parte B.
- Produce: `POST /api/admin/imagen` → `{ url, ancho, alto }`;
  `GET|POST|PUT|DELETE /api/admin/noticias`.

**La guardia se repite en cada endpoint, no solo en la página.** La página protege lo que se ve; el
endpoint protege lo que se escribe. Quien llame a `/api/admin/noticias` con `curl` no pasa por
ninguna página.

- [ ] **Paso 1: Escribir la prueba de la guardia de los endpoints**

```ts
// src/tests/api-admin.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/lib/db/noticias", () => ({
  listarNoticias: vi.fn().mockResolvedValue([]),
  crearNoticia: vi.fn(),
  actualizarNoticia: vi.fn(),
  borrarNoticia: vi.fn(),
  NoticiaError: class extends Error {},
}));
vi.mock("~/lib/cache", () => ({ invalidar: vi.fn(), RUTAS_NOTICIAS: ["/"] }));
vi.mock("~/lib/storage", () => ({
  guardarImagen: vi.fn(),
  ImagenError: class extends Error {},
}));

const cliente = { id: "u1", email: "a@b.c", name: "Ana", rol: "cliente" };
const admin = { id: "u2", email: "c@d.e", name: "Carmen", rol: "admin" };

const peticion = (body: unknown) =>
  new Request("https://x.test/api/admin/noticias", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => vi.resetModules());

describe("guardia de los endpoints del panel", () => {
  it("sin sesión, 404: ni siquiera se admite que el endpoint existe", async () => {
    const { POST } = await import("~/pages/api/admin/noticias");
    const r = await POST({ request: peticion({}), locals: { usuario: null } } as never);
    expect(r.status).toBe(404);
  });

  it("con sesión de cliente, 404", async () => {
    const { POST } = await import("~/pages/api/admin/noticias");
    const r = await POST({ request: peticion({}), locals: { usuario: cliente } } as never);
    expect(r.status).toBe(404);
  });

  it("con sesión de admin, entra en la validación (400 por datos, no 404)", async () => {
    const { POST } = await import("~/pages/api/admin/noticias");
    const r = await POST({ request: peticion({}), locals: { usuario: admin } } as never);
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

Ejecutar: `pnpm test src/tests/api-admin.test.ts`
Esperado: FALLA — el endpoint no existe.

- [ ] **Paso 3: Escribir el endpoint de noticias**

```ts
// src/pages/api/admin/noticias.ts
import type { APIRoute } from "astro";
import { z } from "zod";
import {
  listarNoticias,
  crearNoticia,
  actualizarNoticia,
  borrarNoticia,
  NoticiaError,
} from "~/lib/db/noticias";
import { invalidar, RUTAS_NOTICIAS } from "~/lib/cache";
import { esAdmin } from "~/lib/auth/guardia";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * 404, no 401 ni 403: mismo criterio que las páginas del panel (spec §7). Un
 * 403 le confirma a cualquiera que ahí detrás hay algo que atacar.
 */
const noEncontrado = () => new Response("No encontrado", { status: 404 });

const esquema = z.object({
  titulo: z.string().trim().min(3).max(140),
  excerpt: z.string().trim().min(10).max(240),
  cuerpo: z.string().max(20_000).default(""),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  imageUrl: z.string().url().nullable().default(null),
  imageAlt: z.string().trim().max(200).nullable().default(null),
  imageWidth: z.number().int().positive().nullable().default(null),
  imageHeight: z.number().int().positive().nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  publicada: z.boolean().default(false),
});

async function cuerpoJSON(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Una foto sin texto alternativo es una foto que no existe para quien usa un
 * lector de pantalla. Se pide aquí, en el servidor, y no solo en el formulario.
 */
function compruebaAlt(datos: z.infer<typeof esquema>): string | null {
  if (datos.imageUrl && !datos.imageAlt) {
    return "Escribe qué se ve en la foto: hace falta para quien no puede verla.";
  }
  return null;
}

export const GET: APIRoute = async ({ locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();
  try {
    return json({ noticias: await listarNoticias({ soloPublicadas: false }) });
  } catch (error) {
    console.error("[admin/noticias] no se pudieron leer:", error);
    return json({ error: "No se pudieron cargar las noticias." }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const parsed = esquema.safeParse(await cuerpoJSON(request));
  if (!parsed.success) return json({ error: "Faltan datos de la noticia." }, 400);

  const falta = compruebaAlt(parsed.data);
  if (falta) return json({ error: falta }, 400);

  try {
    const noticia = await crearNoticia(parsed.data);
    // Se invalida después de guardar, y `invalidar` nunca lanza: si falla, el
    // cambio ya está escrito y solo tarda un poco más en verse.
    await invalidar(RUTAS_NOTICIAS);
    return json({ noticia }, 201);
  } catch (error) {
    if (error instanceof NoticiaError) return json({ error: error.message }, error.status);
    console.error("[admin/noticias] no se pudo crear:", error);
    return json({ error: "No se pudo guardar la noticia." }, 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const bruto = await cuerpoJSON(request);
  const id = (bruto as { id?: unknown })?.id;
  if (typeof id !== "string") return json({ error: "Falta la noticia a editar." }, 400);

  const parsed = esquema.safeParse(bruto);
  if (!parsed.success) return json({ error: "Faltan datos de la noticia." }, 400);

  const falta = compruebaAlt(parsed.data);
  if (falta) return json({ error: falta }, 400);

  try {
    const noticia = await actualizarNoticia(id, parsed.data);
    if (!noticia) return json({ error: "Esa noticia ya no existe." }, 404);
    await invalidar([...RUTAS_NOTICIAS, `/noticias/${noticia.slug}`]);
    return json({ noticia });
  } catch (error) {
    if (error instanceof NoticiaError) return json({ error: error.message }, error.status);
    console.error("[admin/noticias] no se pudo actualizar:", error);
    return json({ error: "No se pudo guardar la noticia." }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const bruto = await cuerpoJSON(request);
  const id = (bruto as { id?: unknown })?.id;
  if (typeof id !== "string") return json({ error: "Falta la noticia a borrar." }, 400);

  try {
    const borradas = await borrarNoticia(id);
    if (!borradas) return json({ error: "Esa noticia ya no existe." }, 404);
    await invalidar(RUTAS_NOTICIAS);
    return json({ ok: true });
  } catch (error) {
    console.error("[admin/noticias] no se pudo borrar:", error);
    return json({ error: "No se pudo borrar la noticia." }, 500);
  }
};
```

- [ ] **Paso 4: Escribir el endpoint de subida de fotos**

```ts
// src/pages/api/admin/imagen.ts
import type { APIRoute } from "astro";
import { guardarImagen, ImagenError, type Carpeta } from "~/lib/storage";
import { esAdmin } from "~/lib/auth/guardia";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const CARPETAS: Carpeta[] = ["productos", "noticias"];

export const POST: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return new Response("No encontrado", { status: 404 });

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return json({ error: "No hemos recibido la foto." }, 400);
  }

  const fichero = formulario.get("foto");
  const carpeta = String(formulario.get("carpeta") ?? "");

  if (!(fichero instanceof File)) return json({ error: "No hemos recibido la foto." }, 400);
  // La carpeta sale de una lista cerrada: si viniera del navegador tal cual,
  // se podría escribir en cualquier sitio del almacén.
  if (!CARPETAS.includes(carpeta as Carpeta)) {
    return json({ error: "Destino de la foto no válido." }, 400);
  }

  try {
    return json(await guardarImagen(fichero, carpeta as Carpeta));
  } catch (error) {
    if (error instanceof ImagenError) return json({ error: error.message }, error.status);
    console.error("[admin/imagen] no se pudo guardar la foto:", error);
    return json({ error: "No se pudo guardar la foto." }, 500);
  }
};
```

- [ ] **Paso 5: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/tests/api-admin.test.ts`
Esperado: PASA, 3 pruebas.

- [ ] **Paso 6: Escribir el editor**

`src/islands/AdminNoticias.tsx`, una isla de React con el mismo patrón que
`src/islands/CuentaDirecciones.tsx` (leerlo antes: de ahí salen el manejo de errores, los estados de
carga y el aviso al usuario). Requisitos concretos:

- Recibe `noticiasIniciales: Noticia[]` como prop y las pinta en una lista con su estado
  (Publicada / Borrador), la fecha y el título.
- Botón «Escribir una noticia» que abre el formulario vacío; clic en una existente, para editarla.
- Campos: título, fecha (`<input type="date">`), entradilla (`textarea`, contador hasta 240),
  cuerpo (`textarea`, Markdown), etiquetas (texto separado por comas), foto y su texto alternativo,
  y una casilla «Publicada».
- La foto se sube al elegirla, a `POST /api/admin/imagen` con `FormData` (`foto` y
  `carpeta: "noticias"`), y se enseña la miniatura con la URL que devuelve. Mientras sube, el botón
  de guardar está desactivado: guardar a medias dejaría la noticia sin foto.
- Guardar llama a `POST` (nueva) o `PUT` (existente) de `/api/admin/noticias` y refresca la lista
  con lo que devuelve el servidor, no con lo que tenía el formulario.
- Borrar pide confirmación con el título dentro del mensaje.
- Los errores se enseñan tal cual llegan del servidor: ya vienen en español y pensados para leerse.
- Al guardar con éxito: aviso «Guardado. En la web se ve en unos segundos.» — no prometer
  «al momento», que la invalidación de caché tarda un poco.

- [ ] **Paso 7: Escribir la página del panel**

```astro
---
// src/pages/admin/noticias.astro
import AdminLayout from "~/layouts/AdminLayout.astro";
import AdminNoticias from "~/islands/AdminNoticias.tsx";
import { listarNoticias, type Noticia } from "~/lib/db/noticias";

export const prerender = false;

let noticiasIniciales: Noticia[] = [];
try {
  noticiasIniciales = await listarNoticias({ soloPublicadas: false });
} catch (error) {
  // La isla sabe recargar la lista por su cuenta: mejor entrar con la lista
  // vacía y poder reintentar que ver un 500 al abrir el panel.
  console.error(
    "No se pudieron cargar las noticias del panel:",
    error instanceof Error ? error.message : error,
  );
}
---
<AdminLayout titulo="Noticias">
  <AdminNoticias client:load noticiasIniciales={noticiasIniciales} />
</AdminLayout>
```

Y añadir la entrada en `AdminLayout.astro`:

```ts
  { href: "/admin/noticias", label: "Noticias" },
```

- [ ] **Paso 8: Probar el ciclo entero a mano**

```bash
pnpm dev
```

Con la cuenta de admin, en `/admin/noticias`:
1. Escribir una noticia nueva con foto, dejarla **sin publicar** → no aparece en `/noticias`.
2. Publicarla → aparece, con su foto y su fecha.
3. Editarle el título → la URL **no cambia** (el slug se conserva) y el texto sí.
4. Subir un PDF como foto → «La foto tiene que ser un jpg, png o webp.»
5. Poner foto y dejar el texto alternativo vacío → no deja guardar, con el motivo escrito.
6. Borrarla → desaparece de las dos listas.
7. Desde otra sesión de cliente: `curl -X POST .../api/admin/noticias` → 404.

- [ ] **Paso 9: Retirar la colección de noticias**

**Solo después** de que `pnpm migrar:noticias --verificar` dé verde contra la base de datos de
**producción** y de comprobar en el despliegue que `/noticias` las enseña desde la base de datos:

```bash
pnpm migrar:noticias --verificar   # con DATABASE_URL de producción
git rm -r src/content/noticias public/images/noticias
```

`git rm -r` y no un borrado a secas: así el borrado queda en el commit y se recupera con
`git revert` si algo se tuerce.

En `src/content.config.ts`: borrar el bloque `export const noticias = defineCollection({...})` y
dejar `export const collections = { products };`.

- [ ] **Paso 10: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add -A
git commit -m "feat(admin): escribir y publicar noticias desde el panel"
```

---

**Fin de la parte B.** Desplegar. Comprobar en producción: subir una foto de verdad, publicar una
noticia y ver que aparece en `/noticias` en menos de un minuto. Si no aparece, el `bypassToken` no
coincide entre construcción y ejecución: es el fallo más probable y no da ningún error visible.

---

# PARTE C — El catálogo se edita desde el panel

Es el cambio más grande del proyecto (spec §11) y lo que está en juego son las 98 fichas de la
carta. Por eso el orden es: primero la tabla y el volcado **con verificación**, después el precio,
después lo público, y **retirar los Markdown al final del todo**, cuando ya se ha comprobado que
la web funciona leyendo de la base de datos.

---

### Tarea 14: Tablas y repositorio de productos

**Ficheros:**
- Crear: `db/migrations/007_productos.sql`
- Crear: `src/lib/db/productos.ts`
- Crear: `src/lib/db/productos.test.ts`

**Interfaces:**
- Produce:
  - `listarProductos(opts?: { soloActivos?: boolean }): Promise<Producto[]>`
  - `obtenerProducto(slug: string, opts?: { soloActivo?: boolean }): Promise<Producto | null>`
  - `productosParaPedido(slugs: string[]): Promise<Map<string, ProductoVendible>>`
  - `crearProducto(datos: DatosProducto): Promise<Producto>`
  - `actualizarProducto(id: string, datos: DatosProducto): Promise<Producto | null>`
  - `ProductoError` con `status`
  - Tipos `Producto`, `Variante`, `ProductoVendible`, `DatosProducto`

**Tres decisiones del modelo:**

1. **No hay borrado, solo `activo`.** La spec §8 pide «activar o desactivar una ficha», no borrarla.
   Un producto desactivado desaparece del catálogo y no se puede comprar, pero su fila sigue ahí:
   si alguien la desactiva por error, se vuelve a activar y punto.
2. **`agotado` y `activo` son cosas distintas.** Agotado se ve pero no se puede comprar (la carta
   sigue enseñando lo que existe); desactivado no se ve. Confundirlos obligaría a borrar de la
   carta lo que se acaba un martes.
3. **La restricción «o precio o consultar» vive en la base de datos**, no solo en zod. Es la misma
   regla que hoy impone el `.refine` de `src/content.config.ts`, y si solo estuviera en el
   formulario, una escritura por otro camino podría dejar una ficha sin precio y sin aviso.

- [ ] **Paso 1: Escribir la migración**

```sql
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
```

- [ ] **Paso 2: Aplicar la migración a la base de pruebas**

```bash
DATABASE_URL="$DATABASE_URL_TEST" pnpm db:migrar
```

Esperado: `✓ 007_productos.sql`.

- [ ] **Paso 3: Escribir las pruebas que fallan**

```ts
// src/lib/db/productos.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de productos", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/productos");

  const datos = (extra: Record<string, unknown> = {}) => ({
    name: "Tarta de queso",
    category: "tartas",
    seccion: "cremosas",
    priceCents: 1850,
    consultar: false,
    unit: "8–10 raciones",
    shortDescription: "Receta tradicional, elaboración diaria.",
    cuerpo: "**Especialidad desde 1986.**",
    allergens: ["gluten", "huevo"],
    destacado: false,
    temporada: false,
    orden: 205,
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    activo: true,
    agotado: false,
    variantes: [],
    ...extra,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS, max: 2 });
    repo = await import("~/lib/db/productos");
    await pool.query("delete from productos");
  });

  afterAll(async () => {
    await pool.query("delete from productos");
    await pool.end();
  });

  it("crea un producto con sus variantes y las devuelve en orden", async () => {
    const producto = await repo.crearProducto(
      datos({
        name: "Roscón de Reyes",
        variantes: [
          { variantId: "grande", label: "Grande", priceCents: 2600, orden: 1 },
          { variantId: "pequeno", label: "Pequeño", priceCents: 1800, orden: 0 },
        ],
      }),
    );

    expect(producto.slug).toBe("roscon-de-reyes");
    expect(producto.variantes.map((v) => v.variantId)).toEqual(["pequeno", "grande"]);
  });

  it("sustituye las variantes al editar, no las acumula", async () => {
    const producto = await repo.crearProducto(
      datos({
        name: "Brazo de gitano",
        variantes: [{ variantId: "chico", label: "Chico", priceCents: 1200, orden: 0 }],
      }),
    );

    const cambiado = await repo.actualizarProducto(producto.id, {
      ...datos({ name: "Brazo de gitano" }),
      variantes: [{ variantId: "grande", label: "Grande", priceCents: 1900, orden: 0 }],
    });

    expect(cambiado?.variantes).toHaveLength(1);
    expect(cambiado?.variantes[0].variantId).toBe("grande");
  });

  it("no deja guardar una ficha sin precio y sin «consultar»", async () => {
    await expect(
      repo.crearProducto(datos({ name: "Sin precio", priceCents: null, consultar: false })),
    ).rejects.toMatchObject({ name: "ProductoError" });
  });

  it("un producto desactivado desaparece del catálogo y de su propia URL", async () => {
    const producto = await repo.crearProducto(datos({ name: "Retirada", activo: false }));

    const activos = await repo.listarProductos({ soloActivos: true });
    expect(activos.map((p) => p.id)).not.toContain(producto.id);

    expect(await repo.obtenerProducto(producto.slug, { soloActivo: true })).toBeNull();
    // Pero el panel sí lo ve: desactivar no es borrar.
    expect(await repo.obtenerProducto(producto.slug)).not.toBeNull();
    const todos = await repo.listarProductos({ soloActivos: false });
    expect(todos.map((p) => p.id)).toContain(producto.id);
  });

  it("productosParaPedido trae solo lo pedido, con su estado de venta", async () => {
    const vendible = await repo.crearProducto(datos({ name: "A la venta" }));
    const agotado = await repo.crearProducto(datos({ name: "Se acabó", agotado: true }));

    const mapa = await repo.productosParaPedido([vendible.slug, agotado.slug, "no-existe"]);

    expect(mapa.size).toBe(2);
    expect(mapa.get(vendible.slug)?.agotado).toBe(false);
    expect(mapa.get(agotado.slug)?.agotado).toBe(true);
    expect(mapa.get("no-existe")).toBeUndefined();
  });

  it("el listado del catálogo va en el orden de la carta", async () => {
    await pool.query("delete from productos");
    await repo.crearProducto(datos({ name: "Segunda", orden: 200 }));
    await repo.crearProducto(datos({ name: "Primera", orden: 100 }));
    const lista = await repo.listarProductos({ soloActivos: true });
    expect(lista.map((p) => p.name)).toEqual(["Primera", "Segunda"]);
  });
});
```

- [ ] **Paso 4: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/lib/db/productos.test.ts`
Esperado: FALLA — el módulo no existe.

- [ ] **Paso 5: Escribir el repositorio**

```ts
// src/lib/db/productos.ts
import { pool } from "~/lib/db/pool";
import { slugify } from "~/lib/slug";

/**
 * Productos y variantes. Sustituye a la colección de contenido como fuente de
 * verdad del catálogo. Único sitio con SQL de productos; hacia fuera,
 * camelCase y sin nombres de columna.
 */

export class ProductoError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ProductoError";
  }
}

export type Variante = {
  variantId: string;
  label: string;
  priceCents: number;
  orden: number;
};

export type Producto = {
  id: string;
  slug: string;
  name: string;
  category: string;
  seccion: string | null;
  priceCents: number | null;
  consultar: boolean;
  unit: string | null;
  shortDescription: string;
  cuerpo: string;
  allergens: string[];
  destacado: boolean;
  temporada: boolean;
  orden: number;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  activo: boolean;
  agotado: boolean;
  variantes: Variante[];
};

/** Lo justo que necesita `priceOrder` para poner precio a una línea. */
export type ProductoVendible = {
  slug: string;
  name: string;
  priceCents: number | null;
  consultar: boolean;
  activo: boolean;
  agotado: boolean;
  variantes: { variantId: string; label: string; priceCents: number }[];
};

export type DatosProducto = Omit<Producto, "id" | "slug" | "variantes"> & {
  variantes: Variante[];
  /** Solo lo usa el volcado inicial, para conservar las URLs de siempre. */
  slug?: string;
};

const CAMPOS = `
  p.id, p.slug, p.name, p.category, p.seccion,
  p.price_cents       as "priceCents",
  p.consultar, p.unit,
  p.short_description as "shortDescription",
  p.cuerpo, p.allergens,
  p.destacado, p.temporada, p.orden,
  p.image_url    as "imageUrl",
  p.image_alt    as "imageAlt",
  p.image_width  as "imageWidth",
  p.image_height as "imageHeight",
  p.activo, p.agotado,
  coalesce(
    (select json_agg(json_build_object(
              'variantId', v.variant_id,
              'label', v.label,
              'priceCents', v.price_cents,
              'orden', v.orden)
            order by v.orden, v.label)
       from variantes v where v.producto_id = p.id),
    '[]'::json
  ) as variantes
`;

function traduce(err: unknown): never {
  if (err instanceof ProductoError) throw err;
  if (typeof err === "object" && err && "code" in err) {
    if (err.code === "23505") {
      throw new ProductoError("Ya hay una ficha con ese nombre. Cámbialo un poco.", 409);
    }
    // La restricción `precio_o_consultar` de la migración 007.
    if (err.code === "23514") {
      throw new ProductoError(
        "Pon un precio, o marca la ficha como «precio a consultar».",
        400,
      );
    }
  }
  throw err;
}

export async function listarProductos(
  { soloActivos = true }: { soloActivos?: boolean } = {},
): Promise<Producto[]> {
  const { rows } = await pool.query<Producto>(
    `select ${CAMPOS} from productos p
      ${soloActivos ? "where p.activo" : ""}
      order by p.orden, p.name`,
  );
  return rows;
}

export async function obtenerProducto(
  slug: string,
  { soloActivo = false }: { soloActivo?: boolean } = {},
): Promise<Producto | null> {
  const { rows } = await pool.query<Producto>(
    `select ${CAMPOS} from productos p
      where p.slug = $1 ${soloActivo ? "and p.activo" : ""}`,
    [slug],
  );
  return rows[0] ?? null;
}

/**
 * Lo que necesita el checkout: solo los productos pedidos, no el catálogo
 * entero. Devuelve también `activo` y `agotado` **sin filtrar por ellos** a
 * propósito: `priceOrder` tiene que poder decir «"X" ya no está disponible»
 * o «"X" se ha agotado», que no es lo mismo que «ese producto no existe».
 */
export async function productosParaPedido(
  slugs: string[],
): Promise<Map<string, ProductoVendible>> {
  if (slugs.length === 0) return new Map();

  const { rows } = await pool.query<ProductoVendible>(
    `select p.slug, p.name,
            p.price_cents as "priceCents",
            p.consultar, p.activo, p.agotado,
            coalesce(
              (select json_agg(json_build_object(
                        'variantId', v.variant_id,
                        'label', v.label,
                        'priceCents', v.price_cents)
                      order by v.orden)
                 from variantes v where v.producto_id = p.id),
              '[]'::json
            ) as variantes
       from productos p
      where p.slug = any($1::text[])`,
    [slugs],
  );

  return new Map(rows.map((p) => [p.slug, p]));
}

/**
 * Crear y editar comparten el guardado de variantes, y va en transacción: un
 * producto con las variantes a medias es un producto con precios erróneos.
 */
async function guardaVariantes(
  cliente: import("pg").PoolClient,
  productoId: string,
  variantes: Variante[],
): Promise<void> {
  // Se borran y se vuelven a escribir: es lo único que deja el resultado
  // igual a lo que enseña el formulario, sin acumular las que se quitaron.
  await cliente.query("delete from variantes where producto_id = $1", [productoId]);
  for (const v of variantes) {
    await cliente.query(
      `insert into variantes (producto_id, variant_id, label, price_cents, orden)
       values ($1,$2,$3,$4,$5)`,
      [productoId, v.variantId, v.label, v.priceCents, v.orden],
    );
  }
}

const VALORES = (datos: DatosProducto) => [
  datos.name,
  datos.category,
  datos.seccion,
  datos.priceCents,
  datos.consultar,
  datos.unit,
  datos.shortDescription,
  datos.cuerpo,
  datos.allergens,
  datos.destacado,
  datos.temporada,
  datos.orden,
  datos.imageUrl,
  datos.imageAlt,
  datos.imageWidth,
  datos.imageHeight,
  datos.activo,
  datos.agotado,
];

export async function crearProducto(datos: DatosProducto): Promise<Producto> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ id: string; slug: string }>(
      `insert into productos
         (name, category, seccion, price_cents, consultar, unit,
          short_description, cuerpo, allergens, destacado, temporada, orden,
          image_url, image_alt, image_width, image_height, activo, agotado, slug)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       returning id, slug`,
      [...VALORES(datos), datos.slug ?? slugify(datos.name)],
    );
    await guardaVariantes(cliente, rows[0].id, datos.variantes);
    await cliente.query("commit");
    return (await obtenerProducto(rows[0].slug))!;
  } catch (err) {
    await cliente.query("rollback");
    traduce(err);
  } finally {
    cliente.release();
  }
}

/**
 * El slug NO se recalcula al editar: cambiar el nombre de una ficha no puede
 * romper la URL que ya está compartida ni el enlace que tiene alguien en un
 * carrito a medio hacer.
 */
export async function actualizarProducto(
  id: string,
  datos: DatosProducto,
): Promise<Producto | null> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ slug: string }>(
      `update productos set
         name = $1, category = $2, seccion = $3, price_cents = $4,
         consultar = $5, unit = $6, short_description = $7, cuerpo = $8,
         allergens = $9, destacado = $10, temporada = $11, orden = $12,
         image_url = $13, image_alt = $14, image_width = $15, image_height = $16,
         activo = $17, agotado = $18, updated_at = now()
       where id = $19
       returning slug`,
      [...VALORES(datos), id],
    );

    if (rows.length === 0) {
      await cliente.query("rollback");
      return null;
    }

    await guardaVariantes(cliente, id, datos.variantes);
    await cliente.query("commit");
    return await obtenerProducto(rows[0].slug);
  } catch (err) {
    await cliente.query("rollback");
    traduce(err);
  } finally {
    cliente.release();
  }
}
```

- [ ] **Paso 6: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/lib/db/productos.test.ts`
Esperado: PASA, 6 pruebas.

- [ ] **Paso 7: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add db/migrations/007_productos.sql src/lib/db/productos.ts src/lib/db/productos.test.ts
git commit -m "feat(catalogo): tablas y repositorio de productos y variantes"
```

---

### Tarea 15: Volcar las 98 fichas de la carta

**Ficheros:**
- Crear: `scripts/migrar-productos.mjs`
- Modificar: `package.json` (script `migrar:productos`)

**Interfaces:**
- Consume: `src/content/products/*.md`, `public/images/productos/`, la tabla `productos`.
- Produce: `pnpm migrar:productos` y `pnpm migrar:productos --verificar`.

**Esta es la tarea de riesgo de todo el plan.** Aquí es donde se pierde la carta si algo va mal.
Tres cautelas:

1. **Las fotos se suben una sola vez.** Las 98 fichas comparten 8 fotos (`tasks/todo.md`: «las 100
   fichas llevan las 8 fotos del obrador repetidas por familia»). Subir la misma foto 98 veces
   sería lento y llenaría el almacén de copias: se guarda en un mapa la URL de cada fichero ya
   subido.
2. **La verificación compara campo a campo**, incluidas las variantes, y cuenta el total. No basta
   con que haya 98 filas: tienen que ser las 98 correctas.
3. **Los Markdown no se tocan en esta tarea.** Siguen siendo la fuente de verdad hasta la tarea 20.

- [ ] **Paso 1: Escribir el script**

```js
// scripts/migrar-productos.mjs
/**
 * Vuelca `src/content/products/*.md` a las tablas `productos` y `variantes`,
 * subiendo las fotos al almacén.
 *
 *   pnpm migrar:productos              vuelca
 *   pnpm migrar:productos --verificar  no escribe: compara ficha a ficha
 *
 * Idempotente: el slug es el nombre del fichero, así que las URLs de siempre
 * no cambian y volver a ejecutarlo actualiza en vez de duplicar.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";
import pg from "pg";
import { put } from "@vercel/blob";
import sharp from "sharp";

const DIR = "src/content/products";
const soloVerificar = process.argv.includes("--verificar");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
if (!soloVerificar && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN: sin él no se pueden subir las fotos");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

/** Las 98 fichas comparten 8 fotos: cada fichero se sube una sola vez. */
const fotosSubidas = new Map();

async function subeFoto(rutaRelativa) {
  const ruta = rutaRelativa.replace(/^(\.\.\/)+/, "");
  if (fotosSubidas.has(ruta)) return fotosSubidas.get(ruta);

  const original = await readFile(ruta);
  const salida = await sharp(original)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const nombre = basename(ruta).replace(/\.[a-z0-9]+$/i, "");
  const { url } = await put(`productos/${nombre}.webp`, salida.data, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  const foto = { url, ancho: salida.info.width, alto: salida.info.height };
  fotosSubidas.set(ruta, foto);
  console.log(`  foto ↑ ${nombre}.webp`);
  return foto;
}

const ficheros = (await readdir(DIR)).filter((f) => f.endsWith(".md")).sort();
let escritos = 0;
let problemas = 0;

for (const fichero of ficheros) {
  const slug = basename(fichero, ".md");
  const { data, content } = matter(await readFile(join(DIR, fichero), "utf8"));
  const variantes = data.variants ?? [];

  if (soloVerificar) {
    const { rows } = await cliente.query(
      `select p.id, p.name, p.category, p.seccion, p.price_cents, p.consultar,
              p.unit, p.short_description, p.cuerpo, p.allergens, p.destacado,
              p.temporada, p.orden, p.image_url, p.image_alt
         from productos p where p.slug = $1`,
      [slug],
    );
    if (rows.length === 0) {
      console.error(`✗ ${slug}: no está en la base de datos`);
      problemas++;
      continue;
    }
    const f = rows[0];
    const dif = [];
    if (f.name !== data.name) dif.push(`nombre: «${f.name}» ≠ «${data.name}»`);
    if (f.category !== data.category) dif.push(`categoría: ${f.category} ≠ ${data.category}`);
    if ((f.seccion ?? null) !== (data.seccion ?? null)) dif.push("sección distinta");
    if (f.price_cents !== (data.priceCents ?? null))
      dif.push(`PRECIO: ${f.price_cents} ≠ ${data.priceCents ?? null}`);
    if (f.consultar !== Boolean(data.consultar)) dif.push("«consultar» distinto");
    if ((f.unit ?? null) !== (data.unit ?? null)) dif.push("unidad distinta");
    if (f.short_description !== data.shortDescription) dif.push("descripción distinta");
    if (f.cuerpo.trim() !== content.trim()) dif.push("cuerpo distinto");
    if (JSON.stringify(f.allergens) !== JSON.stringify(data.allergens ?? []))
      dif.push("alérgenos distintos");
    if (f.destacado !== Boolean(data.featured)) dif.push("«destacado» distinto");
    if (f.temporada !== Boolean(data.seasonal)) dif.push("«temporada» distinto");
    if (f.orden !== (data.order ?? 100)) dif.push(`orden: ${f.orden} ≠ ${data.order ?? 100}`);
    if (data.image && !f.image_url) dif.push("sin foto");
    if ((f.image_alt ?? null) !== (data.imageAlt ?? null)) dif.push("texto alternativo distinto");

    const { rows: vs } = await cliente.query(
      `select variant_id, label, price_cents from variantes
        where producto_id = $1 order by orden`,
      [f.id],
    );
    if (vs.length !== variantes.length) {
      dif.push(`VARIANTES: ${vs.length} en la base, ${variantes.length} en el fichero`);
    } else {
      for (const [i, v] of variantes.entries()) {
        if (vs[i].variant_id !== v.id || vs[i].price_cents !== v.priceCents) {
          dif.push(`variante ${v.id}: ${vs[i].price_cents} ≠ ${v.priceCents}`);
        }
      }
    }

    if (dif.length) {
      console.error(`✗ ${slug}: ${dif.join("; ")}`);
      problemas++;
    }
    continue;
  }

  const foto = data.image ? await subeFoto(data.image) : null;

  const { rows } = await cliente.query(
    `insert into productos
       (slug, name, category, seccion, price_cents, consultar, unit,
        short_description, cuerpo, allergens, destacado, temporada, orden,
        image_url, image_alt, image_width, image_height, activo, agotado)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,false)
     on conflict (slug) do update set
       name = excluded.name, category = excluded.category,
       seccion = excluded.seccion, price_cents = excluded.price_cents,
       consultar = excluded.consultar, unit = excluded.unit,
       short_description = excluded.short_description, cuerpo = excluded.cuerpo,
       allergens = excluded.allergens, destacado = excluded.destacado,
       temporada = excluded.temporada, orden = excluded.orden,
       image_url = excluded.image_url, image_alt = excluded.image_alt,
       image_width = excluded.image_width, image_height = excluded.image_height,
       updated_at = now()
     returning id`,
    [
      slug,
      data.name,
      data.category,
      data.seccion ?? null,
      data.priceCents ?? null,
      Boolean(data.consultar),
      data.unit ?? null,
      data.shortDescription,
      content.trim(),
      data.allergens ?? [],
      Boolean(data.featured),
      Boolean(data.seasonal),
      data.order ?? 100,
      foto?.url ?? null,
      data.imageAlt ?? null,
      foto?.ancho ?? null,
      foto?.alto ?? null,
    ],
  );

  await cliente.query("delete from variantes where producto_id = $1", [rows[0].id]);
  for (const [i, v] of variantes.entries()) {
    await cliente.query(
      `insert into variantes (producto_id, variant_id, label, price_cents, orden)
       values ($1,$2,$3,$4,$5)`,
      [rows[0].id, v.id, v.label, v.priceCents, i],
    );
  }

  escritos++;
}

// El recuento importa tanto como los campos: una ficha de más en la base de
// datos (un slug viejo que ya no está en el repositorio) también es un fallo.
const { rows: total } = await cliente.query("select count(*)::int as n from productos");
await cliente.end();

if (soloVerificar) {
  if (total[0].n !== ficheros.length) {
    console.error(
      `✗ hay ${total[0].n} fichas en la base de datos y ${ficheros.length} ficheros`,
    );
    problemas++;
  }
  console.log(
    problemas === 0
      ? `\nTodo cuadra: ${ficheros.length} fichas, campo a campo.`
      : `\n${problemas} problema(s). NO retires los Markdown.`,
  );
  process.exit(problemas === 0 ? 0 : 1);
}
console.log(
  `\n${escritos} ficha(s) volcadas, ${fotosSubidas.size} foto(s) subidas.` +
    `\nAhora: pnpm migrar:productos --verificar`,
);
```

- [ ] **Paso 2: Añadir el script a `package.json`**

```json
    "migrar:productos": "node --env-file=.env scripts/migrar-productos.mjs",
```

- [ ] **Paso 3: Volcar contra la base de pruebas y verificar**

```bash
pnpm migrar:productos
pnpm migrar:productos --verificar
```

Esperado: `98 ficha(s) volcadas, 8 foto(s) subidas.` y después
`Todo cuadra: 98 fichas, campo a campo.`
**Si el número de fotos subidas se parece a 98, el mapa de reutilización no funciona**: arreglarlo
antes de ejecutar esto contra producción.

- [ ] **Paso 4: Romper un precio a propósito y ver que la verificación lo caza**

En la base de pruebas:

```sql
update productos set price_cents = 1 where slug = 'arroz-con-leche-del-obrador';
```

```bash
pnpm migrar:productos --verificar
```

Esperado: `✗ arroz-con-leche-del-obrador: PRECIO: 1 ≠ 1850` y salida 1. Después,
`pnpm migrar:productos` para dejarlo bien. Repetir la prueba **quitando una variante** de un
producto que las tenga, para comprobar que el recuento de variantes también salta.

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add scripts/migrar-productos.mjs package.json
git commit -m "feat(catalogo): volcado y verificación de las 98 fichas"
```

---

### Tarea 16: El precio sale de la base de datos

**Ficheros:**
- Modificar: `src/lib/pedido.ts`, `src/lib/pedido.test.ts`

**Interfaces:**
- Consume: `productosParaPedido` (tarea 14).
- Produce: `priceOrder` deja de importar `astro:content`.

**Es la pieza del dinero.** Lo que no puede cambiar: el precio se sigue calculando en servidor a
partir de la fuente de verdad, nunca del navegador. Lo que cambia: la fuente de verdad ahora es la
tabla `productos`. Y se añaden dos rechazos que antes no existían porque no había estados:
desactivado y agotado.

**Las pruebas dejan de leer el catálogo real.** Hoy `pedido.test.ts` saca un producto de
`getCollection("products")`; con la base de datos eso obligaría a tener una base de pruebas llena
para probar el precio. Se sustituye por un doble de `~/lib/db/productos`: las pruebas quedan más
rápidas, no dependen de qué haya en el catálogo ese día y siguen cubriendo exactamente lo mismo.

- [ ] **Paso 1: Cambiar las pruebas primero**

En `src/lib/pedido.test.ts`, sustituir el import de `astro:content` y `productoDeCatalogoSencillo`
por un doble, dejando **todos los casos existentes tal cual** (código postal fuera de zona, fecha
no permitida, teléfono inválido, producto inexistente, variante inexistente, precio a consultar):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { earliestDate } from "~/lib/entrega";

const productosParaPedido = vi.fn();
vi.mock("~/lib/db/productos", () => ({ productosParaPedido }));

const { priceOrder, OrderError } = await import("~/lib/pedido");
type OrderPayload = import("~/lib/pedido").OrderPayload;

/** Un producto sencillo, sin variantes, con precio de venta online. */
const SENCILLO = {
  slug: "tarta-de-queso",
  name: "Tarta de queso",
  priceCents: 1850,
  consultar: false,
  activo: true,
  agotado: false,
  variantes: [],
};

const catalogo = (...productos: (typeof SENCILLO)[]) =>
  new Map(productos.map((p) => [p.slug, p]));

beforeEach(() => {
  productosParaPedido.mockReset().mockResolvedValue(catalogo(SENCILLO));
});

const AHORA = new Date("2026-03-10T10:00:00");
const FECHA_RECOGIDA = earliestDate("recogida", AHORA, { storeId: "alcobendas" });

const pedidoBase = (): OrderPayload => ({
  items: [{ slug: SENCILLO.slug, qty: 2 }],
  mode: "recogida",
  dateISO: FECHA_RECOGIDA,
  slot: "morning",
  storeId: "alcobendas",
  email: "cliente@example.com",
  phone: "666123456",
});
```

Y añadir los dos casos nuevos:

```ts
describe("priceOrder — estados de venta", () => {
  it("un producto desactivado no se puede comprar, y se dice sin tecnicismos", async () => {
    productosParaPedido.mockResolvedValue(catalogo({ ...SENCILLO, activo: false }));
    await expect(priceOrder(pedidoBase(), { now: AHORA })).rejects.toThrow(
      /ya no está disponible/i,
    );
  });

  it("un producto agotado tampoco, y con un mensaje distinto", async () => {
    productosParaPedido.mockResolvedValue(catalogo({ ...SENCILLO, agotado: true }));
    await expect(priceOrder(pedidoBase(), { now: AHORA })).rejects.toThrow(/se ha agotado/i);
  });

  it("el precio sale del catálogo, nunca de lo que mande el navegador", async () => {
    // El payload no tiene ni un campo de precio, y aun así el total es exacto.
    const order = await priceOrder(pedidoBase(), { now: AHORA });
    expect(order.subtotalCents).toBe(3700);
    expect(order.lines[0].unitPriceCents).toBe(1850);
  });

  it("solo pide a la base de datos los productos del carrito", async () => {
    await priceOrder(pedidoBase(), { now: AHORA });
    expect(productosParaPedido).toHaveBeenCalledWith([SENCILLO.slug]);
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/lib/pedido.test.ts`
Esperado: FALLA — `priceOrder` sigue leyendo `astro:content` y el doble no se usa.

- [ ] **Paso 3: Cambiar `priceOrder`**

En `src/lib/pedido.ts`, quitar `import { getCollection } from "astro:content";` y añadir:

```ts
import { productosParaPedido } from "~/lib/db/productos";
```

Sustituir el bloque que carga el catálogo y el bucle de líneas por:

```ts
  // La fuente de verdad del precio es la tabla `productos`. Se piden solo los
  // slugs del carrito, no el catálogo entero: son 98 fichas y aquí hacen falta
  // dos o tres.
  const bySlug = await productosParaPedido(payload.items.map((i) => i.slug));

  const lines: PricedLine[] = [];
  for (const item of payload.items) {
    const product = bySlug.get(item.slug);
    if (!product || !product.activo) {
      // Mismo mensaje para «no existe» y «desactivado»: para quien compra son
      // lo mismo, y distinguirlo solo serviría para adivinar qué hay detrás.
      throw new OrderError(`El producto «${item.slug}» ya no está disponible.`);
    }

    if (product.agotado) {
      throw new OrderError(
        `«${product.name}» se ha agotado. Quítalo del carrito y vuelve a intentarlo.`,
      );
    }

    if (product.consultar || product.priceCents === null) {
      throw new OrderError(
        `«${product.name}» se encarga hablando con el obrador: no tiene precio de venta online.`,
      );
    }

    let unitPriceCents = product.priceCents;
    let variantLabel: string | undefined;

    if (item.variantId) {
      const variant = product.variantes.find((v) => v.variantId === item.variantId);
      if (!variant) {
        throw new OrderError(
          `La opción elegida de «${product.name}» ya no está disponible.`,
        );
      }
      unitPriceCents = variant.priceCents;
      variantLabel = variant.label;
    }

    lines.push({
      slug: item.slug,
      name: product.name,
      variantLabel,
      qty: item.qty,
      unitPriceCents,
      totalCents: unitPriceCents * item.qty,
    });
  }
```

- [ ] **Paso 4: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/lib/pedido.test.ts src/tests/api-checkout.test.ts`
Esperado: PASAN todas, las viejas y las cuatro nuevas.

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check
git add src/lib/pedido.ts src/lib/pedido.test.ts
git commit -m "feat(pedido): el precio se lee de la base de datos y respeta agotado y desactivado"
```

---

### Tarea 17: El catálogo público desde la base de datos

**Ficheros:**
- Modificar: `src/components/CatalogoGrid.astro`, `src/components/ProductCard.astro`
- Modificar: `src/pages/catalogo/index.astro`, `dulce.astro`, `salado.astro`, `top-ventas.astro`,
  `packs.astro`
- Modificar: `src/pages/index.astro`

**Interfaces:**
- Consume: `listarProductos` (tarea 14).
- Produce: `ProductCard` acepta `imagen: { url, alt, ancho, alto } | null` y `agotado: boolean`.

**Lo que NO hay que tocar.** El filtro (`src/islands/CategoryFilter.tsx`) y el buscador trabajan
sobre los atributos `data-product`, `data-category`, `data-grupo`, `data-seccion` y `data-search`
que pinta el servidor. Si esos atributos se siguen escribiendo igual, **el filtro no se entera de
que ha cambiado la fuente de datos** y no hay que reescribirlo. Es la parte del catálogo que más
fácil se rompe: no se toca.

Las secciones (`src/data/secciones.ts`), las categorías (`src/data/categories.ts`) y los packs
(`src/data/packs.ts`) **siguen en código**, como dice la spec §5.4. Solo cambian las fichas.

- [ ] **Paso 1: Adaptar la tarjeta**

En `src/components/ProductCard.astro`:

```ts
interface Props {
  slug: string;
  name: string;
  category: CategoryId;
  seccionLabel?: string;
  /** Foto del almacén con sus medidas, o nada si la ficha aún no tiene. */
  imagen?: { url: string; alt: string; ancho: number; alto: number } | null;
  shortDescription: string;
  priceCents?: number;
  consultar?: boolean;
  /** Se ve en la carta, pero hoy no se puede comprar. */
  agotado?: boolean;
  unit?: string;
  variants?: { id: string; label: string; priceCents: number }[];
}
```

El `<Image>` pasa a usar la URL remota con sus medidas:

```astro
      {imagen ? (
        <Image
          src={imagen.url}
          alt={imagen.alt}
          width={imagen.ancho}
          height={imagen.alto}
          widths={[300, 600, 900]}
          sizes="(min-width:1024px) 360px, (min-width:640px) 50vw, 100vw"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div class="w-full h-full flex items-center justify-center bg-[color:var(--color-latte)] border-b border-[color:var(--color-avellana)]" aria-hidden="true">
          <span class="numeracion">Foto pendiente</span>
        </div>
      )}
```

Y **antes** de las ramas de precio, la de agotado — el botón de añadir al carrito no puede
aparecer para algo que no se puede comprar:

```astro
      {agotado ? (
        <div class="flex items-center justify-between">
          <p class="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--color-ink-muted)]">
            {sinPrecio ? "Consultar" : formatPriceCents(priceCents!)}
          </p>
          <span class="numeracion">Agotado hoy</span>
        </div>
      ) : sinPrecio ? (
        /* ...las ramas que ya había, sin cambios... */
      ) : conTamanos ? (
```

- [ ] **Paso 2: Adaptar la rejilla**

En `src/components/CatalogoGrid.astro`, sustituir la carga y dejar **el resto del fichero igual**,
incluidos los `data-*`:

```astro
---
import ProductCard from "~/components/ProductCard.astro";
import CategoryFilter from "~/islands/CategoryFilter.tsx";
import { listarProductos, type Producto } from "~/lib/db/productos";
import { grupoCategories, grupoOfCategory, grupoLabel, type GrupoId, type CategoryId } from "~/data/categories";
import { secciones, seccionById, type SeccionId } from "~/data/secciones";
import { stores } from "~/data/stores";

/* ...las mismas Props que había... */

const allowed = grupo ? grupoCategories[grupo] : null;

// Solo los activos: una ficha desactivada desde el panel desaparece de la
// web. `listarProductos` ya los devuelve en el orden de la carta.
let todos: Producto[] = [];
try {
  todos = await listarProductos({ soloActivos: true });
} catch (error) {
  // Un fallo de Postgres deja el catálogo vacío, no una página rota.
  console.error(
    "No se pudo cargar el catálogo:",
    error instanceof Error ? error.message : error,
  );
}

const products = todos
  .filter((p) => (destacados ? p.destacado : true))
  .filter((p) => !allowed || allowed.includes(p.category as CategoryId));
---
```

Y en los dos sitios donde se pinta una tarjeta, cambiar el acceso a los datos (`p.data.name` →
`p.name`, `p.id` → `p.slug`, `p.data.seccion` → `p.seccion`) y pasar la foto y el estado:

```astro
              <div
                data-product
                data-category={p.category}
                data-grupo={grupoOfCategory(p.category as CategoryId)}
                data-seccion={p.seccion}
                data-search={`${p.name} ${p.shortDescription} ${b.seccion.label}`}
              >
                <ProductCard
                  slug={p.slug}
                  name={p.name}
                  category={p.category as CategoryId}
                  seccionLabel={seccionById(b.seccion.id).label}
                  imagen={p.imageUrl ? { url: p.imageUrl, alt: p.imageAlt ?? p.name, ancho: p.imageWidth!, alto: p.imageHeight! } : null}
                  shortDescription={p.shortDescription}
                  priceCents={p.priceCents ?? undefined}
                  consultar={p.consultar}
                  agotado={p.agotado}
                  unit={p.unit ?? undefined}
                  variants={p.variantes.map((v) => ({ id: v.variantId, label: v.label, priceCents: v.priceCents }))}
                />
              </div>
```

(Lo mismo en la rama sin secciones, con `p.seccion ? seccionById(p.seccion as SeccionId).label : undefined`.)

- [ ] **Paso 3: Marcar las páginas como bajo demanda**

En `src/pages/catalogo/index.astro`, `dulce.astro`, `salado.astro`, `top-ventas.astro` y en
`src/pages/index.astro` —todas las que montan un `CatalogoGrid`— añadir arriba del frontmatter:

```ts
// Lee el catálogo de la base de datos: bajo demanda, con la caché ISR delante
// y el panel invalidándola al guardar.
export const prerender = false;
```

`packs.astro` **solo se toca si usa `CatalogoGrid`**: si sale de `src/data/packs.ts`, se queda
estático, que es lo correcto.

- [ ] **Paso 4: Comprobar a mano, con la lista de siempre**

```bash
pnpm dev
```

Con la base de pruebas ya volcada (tarea 15), comprobar **una por una**:

1. `/catalogo` enseña las 98 fichas, agrupadas igual que antes.
2. El buscador filtra al escribir «roscón».
3. Los chips de gama (Dulce / Salado) filtran.
4. En `/catalogo/dulce`, los chips de sección filtran y el orden de las secciones es el de la carta.
5. Los precios coinciden con los de antes del cambio: comparar tres o cuatro con
   `git show HEAD~5:src/content/products/<slug>.md`.
6. Una ficha con variantes enseña el selector de tamaño y el precio cambia al elegir.
7. Marcar una a mano como agotada
   (`update productos set agotado = true where slug = '...'`): se sigue viendo, con «Agotado hoy» y
   **sin** botón de añadir.
8. Desactivar otra (`update productos set activo = false where slug = '...'`): desaparece de la
   rejilla.
9. En la home, los destacados siguen siendo los mismos.

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add src/components/CatalogoGrid.astro src/components/ProductCard.astro src/pages/catalogo src/pages/index.astro
git commit -m "feat(catalogo): la rejilla y los filtros leen de la base de datos"
```

---

### Tarea 18: La ficha de producto desde la base de datos

**Ficheros:**
- Modificar: `src/pages/catalogo/[slug].astro`
- Modificar: `src/pages/sitemap-contenido.xml.ts`

**Interfaces:**
- Consume: `obtenerProducto` (tarea 14), `aHtml` (tarea 10).

- [ ] **Paso 1: Reescribir la cabecera de la ficha**

Quitar `getStaticPaths` y sustituir por:

```astro
---
import { Image } from "astro:assets";
import MarketingLayout from "~/layouts/MarketingLayout.astro";
import AddToCart from "~/islands/AddToCart.tsx";
import { categoryById, type CategoryId } from "~/data/categories";
import { seccionById, type SeccionId } from "~/data/secciones";
import { obtenerProducto } from "~/lib/db/productos";
import { aHtml } from "~/lib/markdown";

export const prerender = false;

const { slug } = Astro.params;
// `soloActivo`: una ficha desactivada tampoco se ve escribiendo su URL.
const product = slug ? await obtenerProducto(slug, { soloActivo: true }) : null;
if (!product) return new Response("No encontrado", { status: 404 });

const cuerpo = await aHtml(product.cuerpo);
const cat = categoryById(product.category as CategoryId);
const seccion = product.seccion ? seccionById(product.seccion as SeccionId) : null;
const eyebrow = seccion?.label ?? cat.label;
---
```

- [ ] **Paso 2: Adaptar el cuerpo de la página**

- `product.data.X` → `product.X` en todo el fichero.
- La imagen: `src={product.imageUrl} width={product.imageWidth} height={product.imageHeight}`
  dentro de su `{product.imageUrl ? ... : ...}`.
- `<Content />` → `<article ... set:html={cuerpo} />`.
- En el `jsonLd`, `image: product.imageUrl ?? undefined` (ya es absoluta) y la disponibilidad pasa
  a reflejar el estado real, que es justo lo que Google enseña en los resultados:

```ts
        offers: {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: (product.priceCents / 100).toFixed(2),
          availability: product.agotado
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        },
```

- Añadir el aviso de agotado justo antes del `AddToCart`, sustituyéndolo:

```astro
          {product.agotado ? (
            <div>
              <p class="font-[family-name:var(--font-display)] text-3xl text-[color:var(--color-ink-muted)]">
                Agotado hoy
              </p>
              <p class="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                Se ha terminado. Llámanos y te decimos cuándo vuelve a salir del horno.
              </p>
              <a href="/contacto" class="btn btn-primario mt-4">Preguntar por este producto</a>
            </div>
          ) : product.consultar || product.priceCents === null ? (
            /* ...la rama de «precio a consultar», como estaba... */
```

- El `AddToCart` recibe `variants={product.variantes.map((v) => ({ id: v.variantId, label: v.label, priceCents: v.priceCents }))}`
  y `unit={product.unit ?? undefined}`.

- [ ] **Paso 3: Añadir las fichas al sitemap**

En `src/pages/sitemap-contenido.xml.ts`, junto a las noticias:

```ts
import { listarProductos } from "~/lib/db/productos";
```

```ts
    const productos = await listarProductos({ soloActivos: true });
    urls = [
      ...urls,
      ...productos.map((p) => ({ loc: new URL(`/catalogo/${p.slug}`, base).toString() })),
    ];
```

(Dentro del mismo `try`: si falla la base de datos, sale el sitemap con lo que haya.)

- [ ] **Paso 4: Comprobar a mano**

1. `/catalogo/arroz-con-leche-del-obrador` se ve igual que antes: foto, precio, alérgenos, cuerpo.
2. Una ficha con variantes: el selector funciona y añade al carrito el tamaño correcto.
3. Una ficha desactivada: 404.
4. Una ficha agotada: se ve, dice «Agotado hoy» y no deja añadir.
5. `/catalogo/inventado`: 404.
6. `/sitemap-contenido.xml` lista noticias y fichas.
7. **Un pedido entero de prueba**: añadir dos cosas al carrito, llegar al resumen y comprobar que
   el total cuadra. (Sin claves de Stripe no se puede completar el pago: llega hasta el aviso de
   «el pago no está configurado todavía», y eso es lo esperado.)

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add "src/pages/catalogo/[slug].astro" src/pages/sitemap-contenido.xml.ts
git commit -m "feat(catalogo): la ficha de producto sale de la base de datos"
```

---

### Tarea 19: Editar el catálogo desde el panel

**Ficheros:**
- Crear: `src/pages/api/admin/productos.ts`
- Crear: `src/islands/AdminProductos.tsx`
- Crear: `src/pages/admin/productos.astro`
- Modificar: `src/layouts/AdminLayout.astro`, `src/tests/api-admin.test.ts`

**Interfaces:**
- Consume: `listarProductos`, `crearProducto`, `actualizarProducto` (tarea 14); `invalidar` y
  `RUTAS_CATALOGO` (tarea 8); `POST /api/admin/imagen` (tarea 13).
- Produce: `GET|POST|PUT /api/admin/productos`. **No hay DELETE**: se desactiva, no se borra.

**Qué se puede tocar y qué no** (spec §8): precio, descripción, alérgenos, variantes, agotado,
activo, foto, y crear ficha nueva. **No** se editan desde aquí las secciones ni las categorías:
siguen en código, donde se revisan en un pull request.

- [ ] **Paso 1: Añadir las pruebas de guardia y de precio**

En `src/tests/api-admin.test.ts`, añadir el doble del repositorio de productos y estas pruebas:

```ts
vi.mock("~/lib/db/productos", () => ({
  listarProductos: vi.fn().mockResolvedValue([]),
  crearProducto: vi.fn(),
  actualizarProducto: vi.fn(),
  ProductoError: class extends Error {},
}));

describe("guardia y validación de /api/admin/productos", () => {
  const peticionProducto = (body: unknown) =>
    new Request("https://x.test/api/admin/productos", {
      method: "POST",
      body: JSON.stringify(body),
    });

  it("con sesión de cliente, 404", async () => {
    const { POST } = await import("~/pages/api/admin/productos");
    const r = await POST({
      request: peticionProducto({}),
      locals: { usuario: cliente },
    } as never);
    expect(r.status).toBe(404);
  });

  it("un precio negativo o cero no entra, aunque lo mande un admin", async () => {
    const { POST } = await import("~/pages/api/admin/productos");
    const base = {
      name: "Tarta",
      category: "tartas",
      shortDescription: "Una tarta.",
      priceCents: 0,
      consultar: false,
      allergens: [],
      variantes: [],
    };
    const r = await POST({
      request: peticionProducto(base),
      locals: { usuario: admin },
    } as never);
    expect(r.status).toBe(400);
  });

  it("una categoría inventada tampoco: la lista está cerrada en código", async () => {
    const { POST } = await import("~/pages/api/admin/productos");
    const r = await POST({
      request: peticionProducto({
        name: "Tarta",
        category: "inventada",
        shortDescription: "Una tarta.",
        priceCents: 1000,
        consultar: false,
        allergens: [],
        variantes: [],
      }),
      locals: { usuario: admin },
    } as never);
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Paso 2: Ejecutar y ver que fallan**

Ejecutar: `pnpm test src/tests/api-admin.test.ts`
Esperado: FALLA — el endpoint no existe.

- [ ] **Paso 3: Escribir el endpoint**

```ts
// src/pages/api/admin/productos.ts
import type { APIRoute } from "astro";
import { z } from "zod";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  ProductoError,
} from "~/lib/db/productos";
import { invalidar, RUTAS_CATALOGO } from "~/lib/cache";
import { esAdmin } from "~/lib/auth/guardia";
import { categoryIds } from "~/data/categories";
import { seccionIds } from "~/data/secciones";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const noEncontrado = () => new Response("No encontrado", { status: 404 });

const ALERGENOS = [
  "gluten",
  "huevo",
  "leche",
  "frutos-secos",
  "soja",
  "sesamo",
  "sulfitos",
] as const;

/**
 * Las categorías, las secciones y los alérgenos salen de las listas que ya
 * hay en código: son las mismas que valida `src/content.config.ts` hoy. Un
 * valor fuera de esas listas rompería el filtro del catálogo sin dar error,
 * así que se rechaza aquí.
 */
const esquema = z
  .object({
    name: z.string().trim().min(2).max(140),
    category: z.enum(categoryIds),
    seccion: z.enum(seccionIds).nullable().default(null),
    priceCents: z.number().int().positive().nullable().default(null),
    consultar: z.boolean().default(false),
    unit: z.string().trim().max(60).nullable().default(null),
    shortDescription: z.string().trim().min(3).max(180),
    cuerpo: z.string().max(20_000).default(""),
    allergens: z.array(z.enum(ALERGENOS)).default([]),
    destacado: z.boolean().default(false),
    temporada: z.boolean().default(false),
    orden: z.number().int().min(0).max(9999).default(100),
    imageUrl: z.string().url().nullable().default(null),
    imageAlt: z.string().trim().max(200).nullable().default(null),
    imageWidth: z.number().int().positive().nullable().default(null),
    imageHeight: z.number().int().positive().nullable().default(null),
    activo: z.boolean().default(true),
    agotado: z.boolean().default(false),
    variantes: z
      .array(
        z.object({
          variantId: z.string().trim().min(1).max(60),
          label: z.string().trim().min(1).max(80),
          priceCents: z.number().int().positive(),
          orden: z.number().int().min(0).max(99).default(0),
        }),
      )
      .max(10)
      .default([]),
  })
  // La misma regla que la restricción de la migración 007 y que el `.refine`
  // que ya tenía la colección de contenido: o precio, o «consultar».
  .refine((d) => d.consultar || typeof d.priceCents === "number", {
    message: "Pon un precio, o marca la ficha como «precio a consultar».",
    path: ["priceCents"],
  })
  .refine((d) => !d.imageUrl || Boolean(d.imageAlt), {
    message: "Escribe qué se ve en la foto: hace falta para quien no puede verla.",
    path: ["imageAlt"],
  });

async function cuerpoJSON(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** El primer mensaje de zod, que ya está escrito en español y para leerse. */
const primerError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Faltan datos de la ficha.";

export const GET: APIRoute = async ({ locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();
  try {
    // `soloActivos: false`: el panel también tiene que ver lo desactivado,
    // que si no, no habría forma de volver a activarlo.
    return json({ productos: await listarProductos({ soloActivos: false }) });
  } catch (error) {
    console.error("[admin/productos] no se pudieron leer:", error);
    return json({ error: "No se pudo cargar el catálogo." }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const parsed = esquema.safeParse(await cuerpoJSON(request));
  if (!parsed.success) return json({ error: primerError(parsed.error) }, 400);

  try {
    const producto = await crearProducto(parsed.data);
    await invalidar(RUTAS_CATALOGO);
    return json({ producto }, 201);
  } catch (error) {
    if (error instanceof ProductoError) return json({ error: error.message }, error.status);
    console.error("[admin/productos] no se pudo crear:", error);
    return json({ error: "No se pudo guardar la ficha." }, 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const bruto = await cuerpoJSON(request);
  const id = (bruto as { id?: unknown })?.id;
  if (typeof id !== "string") return json({ error: "Falta la ficha a editar." }, 400);

  const parsed = esquema.safeParse(bruto);
  if (!parsed.success) return json({ error: primerError(parsed.error) }, 400);

  try {
    const producto = await actualizarProducto(id, parsed.data);
    if (!producto) return json({ error: "Esa ficha ya no existe." }, 404);
    // También su propia página, no solo los listados.
    await invalidar([...RUTAS_CATALOGO, `/catalogo/${producto.slug}`]);
    return json({ producto });
  } catch (error) {
    if (error instanceof ProductoError) return json({ error: error.message }, error.status);
    console.error("[admin/productos] no se pudo actualizar:", error);
    return json({ error: "No se pudo guardar la ficha." }, 500);
  }
};
```

- [ ] **Paso 4: Ejecutar las pruebas y verlas pasar**

Ejecutar: `pnpm test src/tests/api-admin.test.ts`
Esperado: PASA, 6 pruebas.

- [ ] **Paso 5: Escribir el editor**

`src/islands/AdminProductos.tsx`, con el mismo patrón que `AdminNoticias` (tarea 13). Requisitos:

- Recibe `productosIniciales: Producto[]`.
- **Buscador** por nombre (con acentos normalizados, como hace `CategoryFilter`) y **filtro por
  sección**: son 98 fichas, sin eso el panel es inservible.
- Cada fila enseña: nombre, sección, precio (o «Consultar»), y dos marcas visibles cuando toca —
  «Agotado» y «Desactivado».
- Dos interruptores rápidos en la propia fila, sin abrir el formulario: **Agotado** y **Activo**.
  Son los dos que se usan a diario, y hacen `PUT` con la ficha entera más el campo cambiado.
- Formulario completo al abrir una ficha: nombre, sección, categoría, precio en euros (se convierte
  a céntimos al mandar: `Math.round(euros * 100)`, nunca al revés en el servidor), unidad,
  descripción corta (máx. 180), cuerpo en Markdown, alérgenos (casillas con las 7 opciones),
  destacado, temporada, orden, foto y su texto alternativo, y la lista de variantes (añadir,
  quitar, reordenar; cada una con identificador, etiqueta y precio).
- **Aviso claro al desactivar**: «Desaparece del catálogo y no se puede comprar. La ficha se
  conserva y se puede volver a activar.»
- Botón «Ficha nueva».
- Los errores del servidor se enseñan tal cual.
- Al guardar: «Guardado. En la web se ve en unos segundos.»

**Cuidado con el precio.** El formulario trabaja en euros y la base de datos en céntimos. La
conversión se hace en un único sitio de la isla y con `Math.round`: `19.99 * 100` en coma flotante
da `1998.9999999999998`, y sin redondear se guardaría un precio con un céntimo de menos.

- [ ] **Paso 6: Escribir la página del panel**

```astro
---
// src/pages/admin/productos.astro
import AdminLayout from "~/layouts/AdminLayout.astro";
import AdminProductos from "~/islands/AdminProductos.tsx";
import { listarProductos, type Producto } from "~/lib/db/productos";

export const prerender = false;

let productosIniciales: Producto[] = [];
try {
  productosIniciales = await listarProductos({ soloActivos: false });
} catch (error) {
  console.error(
    "No se pudo cargar el catálogo del panel:",
    error instanceof Error ? error.message : error,
  );
}
---
<AdminLayout titulo="Productos">
  <AdminProductos client:load productosIniciales={productosIniciales} />
</AdminLayout>
```

Y la entrada en `AdminLayout.astro`, la primera de la lista (es la pantalla que más se usa):

```ts
  { href: "/admin/productos", label: "Productos" },
```

- [ ] **Paso 7: Probar el ciclo entero a mano**

```bash
pnpm dev
```

Con la cuenta de admin, en `/admin/productos`:
1. Buscar «roscón»: aparece.
2. Cambiarle el precio y guardar → el precio nuevo se ve en `/catalogo` y en su ficha.
3. Marcarlo agotado desde la fila → en la web se ve pero no se puede añadir al carrito.
4. **Intentar comprarlo de todas formas**: añadirlo al carrito **antes** de marcarlo agotado, luego
   marcarlo, y entonces terminar el pedido → el checkout lo rechaza con «se ha agotado». Es la
   comprobación que demuestra que el precio y la disponibilidad se deciden en servidor.
5. Desactivarlo → desaparece de la rejilla y su URL da 404. Volver a activarlo → vuelve.
6. Crear una ficha nueva con dos variantes → sale en el catálogo con su selector de tamaño.
7. Poner precio 0 → no deja guardar, con el motivo escrito.
8. Dejar el precio vacío sin marcar «consultar» → no deja guardar.

- [ ] **Paso 8: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add src/pages/api/admin/productos.ts src/islands/AdminProductos.tsx src/pages/admin/productos.astro src/layouts/AdminLayout.astro src/tests/api-admin.test.ts
git commit -m "feat(admin): editar el catálogo desde el panel"
```

---

### Tarea 20: Retirar los Markdown y cerrar

**Ficheros:**
- Modificar: `src/content.config.ts`
- Retirar: `src/content/products/`, `public/images/productos/`
- Modificar: `tasks/todo.md`, `README.md` (si documenta el flujo de contenido)

**Este paso no se hace hasta el final y con la verificación en verde contra producción.** Es el
paso 5 de la spec §10, y el orden importa: primero se comprueba que la web funciona leyendo de la
base de datos, después se retira lo viejo.

- [ ] **Paso 1: Volcar y verificar contra producción**

```bash
# Con DATABASE_URL y BLOB_READ_WRITE_TOKEN de PRODUCCIÓN
pnpm migrar:productos
pnpm migrar:productos --verificar
pnpm migrar:noticias --verificar
```

Esperado: `Todo cuadra: 98 fichas, campo a campo.` **Si sale un solo ✗, parar aquí.**

- [ ] **Paso 2: Comprobar la web de producción antes de retirar nada**

Con el despliegue en marcha: `/catalogo` con sus 98 fichas, tres precios comparados con la carta en
PDF (`public/carta-horno-san-lorenzo.pdf`), una ficha con variantes, `/noticias`, y un pedido de
prueba hasta el resumen.

- [ ] **Paso 3: Retirar la colección**

```bash
git rm -r src/content/products public/images/productos
```

En `src/content.config.ts`: borrar la colección `products` entera y el fichero si se queda vacío
(en ese caso, quitar también `src/content.config.ts` y comprobar que `pnpm build` sigue en verde:
Astro no necesita el fichero si no hay colecciones).

Comprobar que **no queda ni un `getCollection` en el proyecto**:

```bash
grep -rn "astro:content" src/ || echo "Ni un import: correcto"
```

- [ ] **Paso 4: Actualizar los pendientes**

En `tasks/todo.md`:

- Marcar como hecho lo que este plan resuelve.
- Reescribir el pendiente de los **alérgenos**: ya no es «editar 100 Markdown», es «meterlos por el
  panel», que puede hacer el obrador sin nosotros. Dejarlo dicho así.
- Reescribir el pendiente de las **fotos reales**: ahora se suben desde `/admin/productos`.
- Añadir lo que este trabajo deja abierto:

```markdown
- [ ] **Probar una restauración de la copia de seguridad, ahora que la carta
      también vive en la base de datos.** Antes, el contenido estaba en git y se
      recuperaba solo. Ya no: si se pierde la base de datos se pierden las 98
      fichas, las noticias y los pedidos. Esto sube de «pendiente» a «lo primero»
- [ ] **Las fotos ya no están en git.** Viven en Vercel Blob y no entran en
      ninguna copia de seguridad hoy. Decidir si se hace un volcado periódico o
      se asume el riesgo por escrito
- [ ] **Pantalla para dar de alta a otro admin** (viene de la tarea 7)
- [ ] **Registro de quién cambia qué en el panel.** Hoy un cambio de precio no
      deja rastro de quién lo hizo ni de cuándo. Con una sola persona da igual;
      con dos, no
```

- [ ] **Paso 5: Comprobación completa y commit**

```bash
pnpm test && pnpm check && pnpm build
git add -A
git commit -m "feat(catalogo): el catálogo vive en la base de datos y se edita desde el panel"
```

---

## Lo que este plan NO resuelve

Queda escrito para que nadie lo dé por hecho:

- **El RGPD de las cuentas.** Sigue abierto y sigue bloqueando que se registre el primer cliente
  real: falta el borrado de cuenta, los encargados del tratamiento (Neon, Resend, Stripe, **y ahora
  también Vercel Blob**) y el plazo de conservación. Este trabajo **añade** un encargado nuevo a esa
  lista.
- **Cobrar.** El checkout de Stripe sigue sin claves y las condiciones de compra sin revisión legal.
- **Los alérgenos, los rangos de código postal, el horario de Alcobendas y los gastos de envío.**
  Son datos del obrador. Lo que cambia es que ahora los alérgenos se pueden meter desde el panel sin
  tocar código.
- **Las copias de seguridad probadas.** Nunca se ha restaurado un volcado, y a partir de ahora la
  carta entera depende de ello.
- **La base de datos de desarrollo separada de la de producción.** `DATABASE_URL` sigue apuntando a
  la misma rama de Neon en local y en Vercel. Con las 98 fichas dentro, esto pasa de incómodo a
  peligroso: **conviene resolverlo antes de la parte C**, no después.
- **Las páginas de bollería diaria y temporada de la carta**, que nunca llegaron a tener ficha.
