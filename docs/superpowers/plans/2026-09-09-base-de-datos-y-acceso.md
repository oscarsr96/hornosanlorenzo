# Base de datos y acceso — Plan de implementación (1 de 3)

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que un cliente pueda registrarse con correo y contraseña, entrar, guardar sus datos y sus direcciones, y encontrarse el checkout relleno — sobre una base de datos Postgres que el día de mañana se pueda mudar a Google Cloud cambiando una cadena de conexión.

**Arquitectura:** Postgres a secas (proveedor gestionado hoy, Cloud SQL mañana) con SQL versionado en `db/migrations/` y un runner propio. La autenticación es Better Auth sobre nuestras tablas, con `pg.Pool`, no el servicio del proveedor. El navegador nunca habla con la base de datos: todo pasa por rutas `/api` y por un middleware de Astro que resuelve la sesión en servidor. El catálogo **no se toca** en este plan: sigue en Markdown.

**Stack:** Astro 5 · React 19 · Postgres (`pg`) · Better Auth · Resend · Vitest · Vercel

**Spec:** `docs/superpowers/specs/2026-09-09-registro-usuarios-y-panel-admin-design.md`

**Este plan es el primero de tres.** Los otros dos, en orden: *(2)* pedidos guardados y panel de admin; *(3)* catálogo en base de datos. Al terminar este, el sitio funciona entero con cuentas de cliente y sin panel.

## Cómo leer este plan

Los pasos de **servidor** —endpoints, autenticación, SQL, repositorios— llevan el código entero: es donde un fallo abre un agujero o corrompe datos, y no se deja a interpretación.

Los pasos de **islas de React** llevan requisitos concretos en vez del componente completo, a propósito: son componentes largos, cargados de estilo, y el repo ya tiene el patrón a seguir. Antes de escribir uno, lee `src/islands/CheckoutFlow.tsx` y `src/islands/AccesoClientes.tsx`, que fijan cómo se validan los campos, cómo se pintan los errores en teja y cómo se usan los tokens de la marca. Si un requisito de esos pasos te resulta ambiguo, para y pregunta: no lo resuelvas inventando.

## Restricciones globales

Se aplican a **todas** las tareas.

- **Gestor de paquetes: `pnpm`.** El repo tiene `pnpm-lock.yaml`.
- **El precio lo pone el servidor.** `priceOrder` en `src/lib/pedido.ts` sigue siendo la única autoridad. Ninguna tarea puede aceptar un importe que venga del navegador.
- **Portabilidad:** solo `src/lib/db/pool.ts`, `src/lib/storage/*` y `src/lib/email/*` pueden saber quién es el proveedor. Nada de APIs REST propias del proveedor, ni extensiones exclusivas, ni `auth.uid()` en SQL.
- **Copy en español**, con el tono del sitio: frases cortas, sin signos de exclamación, sin emoji.
- **Reglas de marca** (`docs` del manual, resumidas en `src/styles/global.css`): sin esquinas redondeadas, sin sombras, sin degradados. Se separa con filete de 1 px en avellana. Los CTA en caramelo (`--color-caramelo`). El teja (`--color-teja`) solo para errores y para lo ya pactado.
- **Formularios accesibles:** cada campo con su `<label>` asociado; los errores con `role="alert"` y referenciados con `aria-describedby`.
- **Nunca registrar contraseñas ni tokens** en consola, ni siquiera al depurar.
- **Verificación manual:** este repo no tiene pruebas de extremo a extremo. Cada tarea termina con una comprobación manual escrita paso a paso. Hazla; no la des por hecha.
- **Ojo con la caché de desarrollo** (`tasks/lessons.md`): tras instalar dependencias, vacía `node_modules/.vite` y `.astro`, y lee el puerto del log con `grep -i local`, que Astro lo cambia sin avisar.

---

### Tarea 1: Arnés de pruebas

Hoy no hay ni una prueba. Antes de escribir lógica nueva hace falta poder probarla, y la primera prueba se escribe contra algo que **ya funciona**, para saber que falla el arnés y no el código.

**Ficheros:**
- Crear: `vitest.config.ts`
- Crear: `src/lib/entrega.test.ts`
- Modificar: `package.json` (scripts)

**Interfaces:**
- Consume: `esTelefonoValido` y `admiteCP` de `src/lib/entrega.ts`
- Produce: `pnpm test` y `pnpm test:watch`

- [ ] **Paso 1: Instalar Vitest**

```bash
pnpm add -D vitest
```

- [ ] **Paso 2: Configurar Vitest con el alias `~`**

`vitest.config.ts` — el alias tiene que coincidir con el de `tsconfig.json`, o los imports `~/lib/...` no resuelven:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Paso 3: Añadir los scripts**

En `package.json`, dentro de `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Paso 4: Escribir la prueba contra lo que ya existe**

`src/lib/entrega.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admiteCP, esTelefonoValido } from "~/lib/entrega";

describe("esTelefonoValido", () => {
  it("acepta un móvil con espacios y con prefijo", () => {
    expect(esTelefonoValido("666 12 34 56")).toBe(true);
    expect(esTelefonoValido("+34 666123456")).toBe(true);
  });

  it("acepta un fijo de Madrid", () => {
    expect(esTelefonoValido("916613932")).toBe(true);
  });

  it("rechaza lo que no son nueve dígitos españoles", () => {
    expect(esTelefonoValido("12345")).toBe(false);
    expect(esTelefonoValido("1234567890")).toBe(false);
  });
});

describe("admiteCP", () => {
  it("acepta la zona de reparto", () => {
    expect(admiteCP("28001")).toBe(true);
    expect(admiteCP("28760")).toBe(true);
  });

  it("rechaza fuera de zona y formatos malos", () => {
    expect(admiteCP("08001")).toBe(false);
    expect(admiteCP("28056")).toBe(false);
    expect(admiteCP("2800")).toBe(false);
  });
});
```

- [ ] **Paso 5: Ejecutar**

```bash
pnpm test
```

Esperado: 5 pruebas en verde. Si fallan los imports, el alias de `vitest.config.ts` no coincide con el de `tsconfig.json`.

- [ ] **Paso 6: Commit**

```bash
git add vitest.config.ts src/lib/entrega.test.ts package.json pnpm-lock.yaml
git commit -m "test: arnés de pruebas con Vitest y cobertura de las reglas de entrega"
```

---

### Tarea 2: Conexión a Postgres y runner de migraciones

La pieza que decide la portabilidad. Una cadena de conexión y ficheros `.sql` numerados: nada más. Mudarse a Cloud SQL será cambiar `DATABASE_URL`.

**Ficheros:**
- Crear: `src/lib/db/pool.ts`
- Crear: `db/migrations/001_migraciones.sql`
- Crear: `scripts/migrar.mjs`
- Modificar: `.env.example`, `package.json` (script `db:migrar`), `src/env.d.ts`

**Interfaces:**
- Produce: `pool` (instancia de `pg.Pool`), `pnpm db:migrar`

- [ ] **Paso 1: Instalar el cliente de Postgres**

```bash
pnpm add pg
pnpm add -D @types/pg
```

- [ ] **Paso 2: Dar de alta la base de datos**

Crea un proyecto de Postgres gestionado (Supabase o Neon; ambos valen y ambos dan una cadena de conexión estándar). Copia la cadena **de conexión agrupada** (*pooled*), que es la que aguanta funciones sin estado.

Añade a `.env` local y a Vercel:

```
DATABASE_URL=postgresql://usuario:clave@host:5432/basededatos?sslmode=require
```

Y a `.env.example`, sin credenciales:

```
# Postgres. Cualquier proveedor: lo único que se usa es SQL estándar.
# Usa la cadena agrupada (pooled), no la directa.
DATABASE_URL=postgresql://usuario:clave@host:5432/basededatos?sslmode=require
```

Aprovecha y **borra de `.env.example` la línea `PUBLIC_WHATSAPP_NUMBER`**: quedó muerta al retirar WhatsApp del sitio.

- [ ] **Paso 3: El pool**

`src/lib/db/pool.ts` — **el único módulo que sabe cómo se llega a la base de datos**:

```ts
import { Pool } from "pg";

/**
 * Único punto de conexión a Postgres. Nada más en el proyecto debe importar
 * `pg` directamente: cuando esto se mude a Cloud SQL, se cambia aquí y ya.
 *
 * `max: 3` porque cada función sin estado de Vercel abre su propio pool y el
 * proveedor tiene un límite de conexiones bajo en los planes pequeños.
 */
const connectionString = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Cópiala de .env.example y ponla en .env y en Vercel.",
  );
}

export const pool = new Pool({ connectionString, max: 3 });
```

Declara la variable en `src/env.d.ts`, dentro de `ImportMetaEnv`:

```ts
readonly DATABASE_URL: string;
```

- [ ] **Paso 4: La tabla de control de migraciones**

`db/migrations/001_migraciones.sql`:

```sql
-- Registro de qué migraciones se han aplicado ya.
create table if not exists _migraciones (
  nombre      text primary key,
  aplicada_en timestamptz not null default now()
);
```

- [ ] **Paso 5: El runner**

`scripts/migrar.mjs` — aplica en orden lo que falte, cada una en su transacción:

```js
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const DIR = "db/migrations";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

await cliente.query(`
  create table if not exists _migraciones (
    nombre      text primary key,
    aplicada_en timestamptz not null default now()
  )
`);

const { rows } = await cliente.query("select nombre from _migraciones");
const aplicadas = new Set(rows.map((r) => r.nombre));
const ficheros = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();

let nuevas = 0;
for (const fichero of ficheros) {
  if (aplicadas.has(fichero)) continue;
  const sql = await readFile(join(DIR, fichero), "utf8");
  try {
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query("insert into _migraciones (nombre) values ($1)", [fichero]);
    await cliente.query("commit");
    console.log(`✓ ${fichero}`);
    nuevas++;
  } catch (err) {
    await cliente.query("rollback");
    console.error(`✗ ${fichero}\n`, err.message);
    process.exit(1);
  }
}

console.log(nuevas === 0 ? "Nada que aplicar." : `${nuevas} migración(es) aplicadas.`);
await cliente.end();
```

En `package.json`:

```json
"db:migrar": "node --env-file=.env scripts/migrar.mjs"
```

- [ ] **Paso 6: Ejecutar y comprobar**

```bash
pnpm db:migrar
```

Esperado: `✓ 001_migraciones.sql`. Vuelve a ejecutarlo: ahora tiene que decir `Nada que aplicar.` Esa segunda ejecución es la prueba de que el runner es idempotente y no reaplica nada.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/db/pool.ts db/migrations scripts/migrar.mjs package.json pnpm-lock.yaml .env.example src/env.d.ts
git commit -m "feat(db): conexión a Postgres y runner de migraciones en SQL"
```

---

### Tarea 3: Autenticación con Better Auth

**Ficheros:**
- Crear: `src/lib/auth/server.ts`, `src/lib/auth/cliente.ts`
- Crear: `src/pages/api/auth/[...all].ts`
- Crear: `src/middleware.ts`
- Modificar: `src/env.d.ts` (variables y `App.Locals`), `.env.example`

**Interfaces:**
- Consume: `pool` de `src/lib/db/pool.ts`
- Produce: `auth` (servidor), `authClient` (navegador), `Astro.locals.usuario` con `{ id, email, name, telefono, rol }` o `null`

> **Antes de escribir código:** Better Auth se mueve rápido. Consulta la documentación vigente de su integración con Astro (con la herramienta de documentación, biblioteca `/better-auth/better-auth`) y ajusta las firmas si han cambiado.

- [ ] **Paso 1: Instalar**

```bash
pnpm add better-auth
```

- [ ] **Paso 2: El secreto**

Genera uno y ponlo en `.env` y en Vercel:

```bash
openssl rand -base64 32
```

```
BETTER_AUTH_SECRET=<lo que salga>
```

En `.env.example`, con el comentario de cómo generarlo. Declara en `src/env.d.ts`:

```ts
readonly BETTER_AUTH_SECRET: string;
```

- [ ] **Paso 3: La instancia de servidor**

`src/lib/auth/server.ts`:

```ts
import { betterAuth } from "better-auth";
import { pool } from "~/lib/db/pool";

/**
 * Autenticación sobre nuestras propias tablas de Postgres, no sobre el
 * servicio del proveedor: es lo que permite mudarse sin reemitir contraseñas.
 *
 * `rol` va con `input: false` a propósito. Sin eso, cualquiera podría
 * registrarse pidiendo `rol: "admin"` en el cuerpo de la petición.
 */
export const auth = betterAuth({
  database: pool,
  secret: import.meta.env.BETTER_AUTH_SECRET,
  baseURL: import.meta.env.PUBLIC_SITE_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Sin esto, `/acceso` aguanta miles de intentos por minuto contra una
  // contraseña. El spec lo pide explícitamente.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
  user: {
    additionalFields: {
      telefono: { type: "string", required: false },
      rol: {
        type: "string",
        required: false,
        defaultValue: "cliente",
        input: false,
      },
    },
  },
});
```

- [ ] **Paso 4: Crear las tablas**

```bash
pnpm dlx @better-auth/cli generate --output db/migrations/002_auth.sql
pnpm db:migrar
```

Si el CLI no acepta esa salida, genera el esquema y **cópialo tal cual** a `db/migrations/002_auth.sql` antes de migrar: todo el SQL del proyecto tiene que estar versionado en el repo, no aplicado a mano contra la base de datos. Comprueba en el fichero que existen las tablas `user`, `session`, `account` y `verification`, y que `user` tiene las columnas `telefono` y `rol`.

- [ ] **Paso 5: La ruta que atiende la autenticación**

`src/pages/api/auth/[...all].ts`:

```ts
import type { APIRoute } from "astro";
import { auth } from "~/lib/auth/server";

export const prerender = false;

export const ALL: APIRoute = (ctx) => auth.handler(ctx.request);
```

- [ ] **Paso 6: El middleware que resuelve la sesión**

`src/middleware.ts`:

```ts
import { defineMiddleware } from "astro:middleware";
import { auth } from "~/lib/auth/server";

export const onRequest = defineMiddleware(async (context, next) => {
  const sesion = await auth.api.getSession({
    headers: context.request.headers,
  });

  context.locals.usuario = sesion?.user ?? null;

  return next();
});
```

Y los tipos, en `src/env.d.ts`:

```ts
declare namespace App {
  interface Locals {
    usuario: {
      id: string;
      email: string;
      name: string;
      telefono?: string | null;
      rol?: string | null;
    } | null;
  }
}
```

- [ ] **Paso 7: El cliente de navegador**

`src/lib/auth/cliente.ts`:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

- [ ] **Paso 8: Comprobación manual**

```bash
pnpm dev
```

Lee el puerto del log. Con el servidor levantado, registra un usuario a mano:

```bash
curl -i -X POST http://localhost:PUERTO/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"prueba@ejemplo.com","password":"unaclavelarga","name":"Prueba","telefono":"666123456"}'
```

Esperado: respuesta correcta y una cookie de sesión en las cabeceras. Comprueba en la base de datos que la fila existe y que **la contraseña no está en claro**:

```sql
select id, email, telefono, rol from "user";
select "providerId", length(password) from account;
```

Esperado: `rol` = `cliente` y una contraseña cifrada de largo fijo. Ahora intenta colarte el rol:

```bash
curl -s -X POST http://localhost:PUERTO/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"intruso@ejemplo.com","password":"unaclavelarga","name":"Intruso","rol":"admin"}'
```

Esperado: el usuario se crea **con `rol` = `cliente`**. Si sale `admin`, `input: false` no está puesto y la tarea no está terminada.

Y comprueba el límite de intentos: lanza quince entradas seguidas con la contraseña mal.

```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:PUERTO/api/auth/sign-in/email \
    -H 'content-type: application/json' \
    -d '{"email":"prueba@ejemplo.com","password":"malmalmal"}'
done; echo
```

Esperado: las primeras responden 401 y a partir de cierto punto empiezan a salir **429**. Si salen quince 401, el límite no está activo.

- [ ] **Paso 9: Commit**

```bash
git add src/lib/auth src/pages/api/auth src/middleware.ts src/env.d.ts db/migrations/002_auth.sql package.json pnpm-lock.yaml .env.example
git commit -m "feat(auth): correo y contraseña con Better Auth sobre nuestras tablas"
```

---

### Tarea 4: Envío de correo detrás de una interfaz

Hoy Resend se usa directamente en el webhook. Para que la mudanza no lo arrastre, el envío pasa por un módulo propio, y de paso queda listo para los correos de recuperación de la tarea 9.

**Ficheros:**
- Crear: `src/lib/email/enviar.ts`, `src/lib/email/enviar.test.ts`
- Modificar: `src/pages/api/webhook.ts` (usar el módulo)

**Interfaces:**
- Produce: `enviarCorreo({ para, asunto, texto }): Promise<{ ok: boolean; error?: string }>`

- [ ] **Paso 1: Escribir la prueba primero**

`src/lib/email/enviar.test.ts` — se prueba lo que puede fallar en silencio: que sin clave configurada no reviente, y que el remitente sale de la variable de entorno.

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const enviarMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: enviarMock };
  },
}));

beforeEach(() => {
  enviarMock.mockReset();
  vi.resetModules();
});

describe("enviarCorreo", () => {
  it("no revienta si falta la clave: devuelve error y no llama al proveedor", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { enviarCorreo } = await import("~/lib/email/enviar");

    const r = await enviarCorreo({ para: "a@b.com", asunto: "Hola", texto: "Qué tal" });

    expect(r.ok).toBe(false);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("manda con el remitente de la configuración", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ORDER_FROM_EMAIL", "web@hornosanlorenzo.com");
    enviarMock.mockResolvedValue({ data: { id: "1" }, error: null });
    const { enviarCorreo } = await import("~/lib/email/enviar");

    const r = await enviarCorreo({ para: "a@b.com", asunto: "Hola", texto: "Qué tal" });

    expect(r.ok).toBe(true);
    expect(enviarMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "web@hornosanlorenzo.com", to: "a@b.com" }),
    );
  });
});
```

- [ ] **Paso 2: Ver la prueba fallar**

```bash
pnpm test
```

Esperado: FALLA con `Cannot find module '~/lib/email/enviar'`.

- [ ] **Paso 3: Escribir el módulo**

`src/lib/email/enviar.ts`:

```ts
import { Resend } from "resend";

/**
 * Único punto de salida de correo. Cambiar de proveedor es reescribir este
 * fichero; nada más en el proyecto importa `resend`.
 *
 * Sin clave no lanza: devuelve `ok: false`. Un correo que no sale no puede
 * tumbar un pedido que ya está pagado.
 */
export type Correo = { para: string; asunto: string; texto: string };

export async function enviarCorreo({
  para,
  asunto,
  texto,
}: Correo): Promise<{ ok: boolean; error?: string }> {
  const clave = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const remitente =
    import.meta.env.ORDER_FROM_EMAIL ?? process.env.ORDER_FROM_EMAIL;

  if (!clave || !remitente) {
    console.error("[email] sin RESEND_API_KEY o ORDER_FROM_EMAIL: no se envía");
    return { ok: false, error: "Correo no configurado." };
  }

  const { error } = await new Resend(clave).emails.send({
    from: remitente,
    to: para,
    subject: asunto,
    text: texto,
  });

  if (error) {
    console.error("[email] el proveedor rechazó el envío", error);
    return { ok: false, error: "No se pudo enviar el correo." };
  }

  return { ok: true };
}
```

- [ ] **Paso 4: Ver la prueba pasar**

```bash
pnpm test
```

Esperado: en verde.

- [ ] **Paso 5: Que el webhook lo use**

En `src/pages/api/webhook.ts`, sustituye el uso directo de `Resend` por `enviarCorreo`. No cambies el texto del aviso al obrador: solo por dónde sale.

- [ ] **Paso 6: Comprobar que el webhook sigue compilando**

```bash
pnpm check
```

Esperado: 0 errores.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/email src/pages/api/webhook.ts
git commit -m "refactor(email): el envío pasa por un módulo propio, no por Resend directo"
```

---

### Tarea 5: Pantalla de acceso y registro

`/acceso` deja de ser un formulario que abre el correo y pasa a crear cuentas de verdad. La página ya existe con dos pestañas (Particulares y Empresas) y con Particulares seleccionado de serie; se conserva esa forma.

**Ficheros:**
- Crear: `src/lib/auth/validacion.ts`, `src/lib/auth/validacion.test.ts`
- Crear: `src/islands/AccesoForm.tsx`
- Modificar: `src/islands/AccesoClientes.tsx` (la pestaña de Particulares monta el formulario nuevo)
- Modificar: `src/pages/acceso.astro` (`prerender = false`, y si ya hay sesión, a `/cuenta`)

**Interfaces:**
- Consume: `authClient` (tarea 3), `esTelefonoValido` de `~/lib/entrega`
- Produce: `validaRegistro(datos)` y `validaEntrada(datos)`, que devuelven `{ ok: true } | { ok: false; errores: Record<string, string> }`

- [ ] **Paso 1: Escribir la prueba de validación primero**

`src/lib/auth/validacion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validaEntrada, validaRegistro } from "~/lib/auth/validacion";

describe("validaRegistro", () => {
  const bueno = {
    nombre: "Ana",
    email: "ana@ejemplo.com",
    telefono: "666123456",
    password: "unaclavelarga",
  };

  it("acepta un alta completa", () => {
    expect(validaRegistro(bueno)).toEqual({ ok: true });
  });

  it("exige nombre", () => {
    const r = validaRegistro({ ...bueno, nombre: " " });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errores.nombre).toBeTruthy();
  });

  it("exige un correo con forma de correo", () => {
    const r = validaRegistro({ ...bueno, email: "ana@" });
    expect(r.ok === false && r.errores.email).toBeTruthy();
  });

  it("reutiliza la validación de teléfono del pedido", () => {
    const r = validaRegistro({ ...bueno, telefono: "12345" });
    expect(r.ok === false && r.errores.telefono).toBeTruthy();
  });

  it("exige ocho caracteres de contraseña, como el servidor", () => {
    const r = validaRegistro({ ...bueno, password: "corta7" });
    expect(r.ok === false && r.errores.password).toBeTruthy();
  });
});

describe("validaEntrada", () => {
  it("solo mira que haya correo y contraseña", () => {
    expect(validaEntrada({ email: "ana@ejemplo.com", password: "x" })).toEqual({ ok: true });
    expect(validaEntrada({ email: "", password: "x" }).ok).toBe(false);
  });
});
```

- [ ] **Paso 2: Ver fallar**

```bash
pnpm test
```

Esperado: FALLA por módulo inexistente.

- [ ] **Paso 3: Escribir la validación**

`src/lib/auth/validacion.ts`:

```ts
import { esTelefonoValido } from "~/lib/entrega";

/** Mismo mínimo que `minPasswordLength` en el servidor. Si cambia uno, cambia el otro. */
export const MIN_PASSWORD = 8;

export type Resultado =
  | { ok: true }
  | { ok: false; errores: Record<string, string> };

const esEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export function validaRegistro(d: {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
}): Resultado {
  const errores: Record<string, string> = {};

  if (!d.nombre.trim()) errores.nombre = "Dinos cómo te llamas.";
  if (!esEmail(d.email)) errores.email = "Ese correo no parece válido.";
  if (!esTelefonoValido(d.telefono)) {
    errores.telefono = "Escribe un móvil o fijo español de nueve dígitos.";
  }
  if (d.password.length < MIN_PASSWORD) {
    errores.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  }

  return Object.keys(errores).length ? { ok: false, errores } : { ok: true };
}

export function validaEntrada(d: { email: string; password: string }): Resultado {
  const errores: Record<string, string> = {};
  if (!d.email.trim()) errores.email = "Escribe tu correo.";
  if (!d.password) errores.password = "Escribe tu contraseña.";
  return Object.keys(errores).length ? { ok: false, errores } : { ok: true };
}
```

- [ ] **Paso 4: Ver pasar**

```bash
pnpm test
```

Esperado: en verde.

- [ ] **Paso 5: El formulario**

`src/islands/AccesoForm.tsx` — una isla con dos modos, entrar y registrarse, alternando con un enlace. Requisitos concretos:

- Campos de registro: nombre, correo, teléfono (`type="tel"`, `inputMode="tel"`), contraseña (`type="password"`, `autoComplete="new-password"`).
- Campos de entrada: correo y contraseña (`autoComplete="current-password"`).
- Valida con `validaRegistro` / `validaEntrada` **antes** de llamar al servidor; pinta los errores bajo cada campo, en `--color-teja`, con `role="alert"`.
- Llama a `authClient.signUp.email({ email, password, name, telefono })` o a `authClient.signIn.email({ email, password })`.
- Si el servidor devuelve error, muestra el mensaje del servidor tal cual **salvo credenciales incorrectas**, donde el texto es siempre el mismo —«Correo o contraseña incorrectos.»— tanto si el correo no existe como si la contraseña falla: decir cuál de los dos falla es regalar qué correos están dados de alta.
- Botón deshabilitado mientras se envía, con el texto en «Entrando…» / «Creando la cuenta…».
- Al terminar bien, `window.location.href = "/cuenta"`.
- Estilo: `.btn.btn-primario` para el envío, filete de avellana en los campos, sin radios ni sombras.
- Enlace discreto a `/acceso/recuperar` bajo el formulario de entrada (la pantalla llega en la tarea 9; el enlace puede quedar apuntando a una ruta que aún no existe durante esta tarea).

- [ ] **Paso 6: Montarlo en la pestaña de Particulares**

En `src/islands/AccesoClientes.tsx`, sustituye `<ContactForm variant="particular" />` por `<AccesoForm />`. La pestaña de Empresas **no se toca**: sigue con su formulario de alta con CIF, porque las empresas no compran online.

En `src/pages/acceso.astro`, añade arriba:

```ts
export const prerender = false;

if (Astro.locals.usuario) return Astro.redirect("/cuenta");
```

- [ ] **Paso 7: Comprobación manual**

Con `pnpm dev`:

1. Entra en `/acceso`. Sale Particulares elegido, con el formulario nuevo.
2. Dale a crear cuenta con todo vacío: salen los cuatro errores y no se llama al servidor.
3. Mete un teléfono de cinco dígitos: error de teléfono.
4. Regístrate con datos buenos: acabas en `/cuenta`.
5. Cierra sesión (o borra la cookie), vuelve a `/acceso` y entra con esas credenciales.
6. Prueba con la contraseña mal: el mensaje es «Correo o contraseña incorrectos.»
7. Prueba con un correo que no existe: **el mismo mensaje, palabra por palabra**.
8. Con la sesión abierta, ve a `/acceso`: te manda a `/cuenta`.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/auth/validacion.ts src/lib/auth/validacion.test.ts src/islands/AccesoForm.tsx src/islands/AccesoClientes.tsx src/pages/acceso.astro
git commit -m "feat(acceso): registro y entrada de particulares con correo y contraseña"
```

---

### Tarea 6: La cabecera sabe quién eres

**Ficheros:**
- Modificar: `src/components/Header.astro`
- Crear: `src/islands/SalirButton.tsx`

**Interfaces:**
- Consume: `Astro.locals.usuario`, `authClient`

- [ ] **Paso 1: Cambiar el enlace de la cabecera**

En `src/components/Header.astro`, el enlace «Acceso clientes» (escritorio y menú móvil) pasa a depender de la sesión:

```astro
const usuario = Astro.locals.usuario;
```

- Sin sesión: sigue igual, «Acceso clientes» → `/acceso`.
- Con sesión: «Mi cuenta» → `/cuenta`, y al lado el botón de salir.

Respeta los colores actuales: la cabecera es teja, así que el texto va en leche y el borde en `leche/45`.

- [ ] **Paso 2: El botón de salir**

`src/islands/SalirButton.tsx`:

```tsx
import { authClient } from "~/lib/auth/cliente";

export default function SalirButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "var(--color-leche)",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      Salir
    </button>
  );
}
```

- [ ] **Paso 3: Ojo con la caché de la cabecera**

`Header.astro` lleva `transition:persist`. Comprueba que al entrar y al salir la cabecera se actualiza y no se queda con el estado anterior al navegar entre páginas. Si se queda pegada, quita `transition:persist` **solo** de la parte que depende de la sesión, no del `<header>` entero.

- [ ] **Paso 4: Comprobación manual**

1. Sin sesión, en tres páginas distintas: pone «Acceso clientes».
2. Entra: pasa a «Mi cuenta» y aparece «Salir».
3. Navega a `/catalogo` y a `/tiendas`: sigue diciendo «Mi cuenta».
4. Pulsa «Salir»: vuelves a la home y la cabecera dice «Acceso clientes».
5. En móvil (390 px), repite 1 y 2 dentro del menú plegado.

- [ ] **Paso 5: Commit**

```bash
git add src/components/Header.astro src/islands/SalirButton.tsx
git commit -m "feat(acceso): la cabecera refleja la sesión y permite salir"
```

---

### Tarea 7: `/cuenta` con los datos personales

**Ficheros:**
- Crear: `src/pages/cuenta.astro`
- Crear: `src/pages/api/cuenta/datos.ts`
- Crear: `src/islands/CuentaDatos.tsx`

**Interfaces:**
- Consume: `Astro.locals.usuario`, `pool`
- Produce: `PATCH /api/cuenta/datos` con `{ nombre, telefono }`

- [ ] **Paso 1: La página, protegida en servidor**

`src/pages/cuenta.astro`:

```astro
---
import MarketingLayout from "~/layouts/MarketingLayout.astro";
import CuentaDatos from "~/islands/CuentaDatos.tsx";

export const prerender = false;

const usuario = Astro.locals.usuario;
if (!usuario) return Astro.redirect("/acceso");
---
```

Dentro, el encabezado de la página y la isla, con el estilo del resto del sitio.

- [ ] **Paso 2: El endpoint**

`src/pages/api/cuenta/datos.ts`:

```ts
import type { APIRoute } from "astro";
import { pool } from "~/lib/db/pool";
import { esTelefonoValido, normalizaTelefono } from "~/lib/entrega";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;
  if (!usuario) return new Response("No autorizado", { status: 401 });

  const { nombre, telefono } = await request.json();

  if (typeof nombre !== "string" || !nombre.trim()) {
    return Response.json({ error: "Dinos cómo te llamas." }, { status: 400 });
  }
  if (typeof telefono !== "string" || !esTelefonoValido(telefono)) {
    return Response.json(
      { error: "Escribe un móvil o fijo español de nueve dígitos." },
      { status: 400 },
    );
  }

  // El id sale de la sesión, nunca del cuerpo de la petición: si viniera del
  // cliente, cualquiera podría editar la ficha de otro.
  await pool.query(
    'update "user" set name = $1, telefono = $2 where id = $3',
    [nombre.trim(), normalizaTelefono(telefono), usuario.id],
  );

  return Response.json({ ok: true });
};
```

- [ ] **Paso 3: La isla**

`src/islands/CuentaDatos.tsx`: recibe `nombre`, `email` y `telefono` como props, permite editar nombre y teléfono, llama al `PATCH` y muestra «Guardado» al terminar. El correo se enseña pero **no se edita**: cambiarlo es cambiar la identidad de acceso y eso pide verificación, que no está en este plan.

- [ ] **Paso 4: Comprobación manual**

1. Sin sesión, `/cuenta` redirige a `/acceso`.
2. Con sesión, salen tu nombre, tu correo y tu teléfono.
3. Cambia el nombre, guarda, recarga: se mantiene.
4. Mete un teléfono malo: error del servidor, sin guardar.
5. Prueba a saltarte el navegador:

```bash
curl -i -X PATCH http://localhost:PUERTO/api/cuenta/datos \
  -H 'content-type: application/json' \
  -d '{"nombre":"Intruso","telefono":"666123456"}'
```

Sin cookie de sesión, esperado: **401**. Si responde 200, la comprobación de sesión no está puesta y la tarea no está terminada.

- [ ] **Paso 5: Commit**

```bash
git add src/pages/cuenta.astro src/pages/api/cuenta src/islands/CuentaDatos.tsx
git commit -m "feat(cuenta): ver y editar los datos personales"
```

---

### Tarea 8: Direcciones guardadas

**Ficheros:**
- Crear: `db/migrations/003_direcciones.sql`
- Crear: `src/lib/db/direcciones.ts`, `src/lib/db/direcciones.test.ts`
- Crear: `src/pages/api/cuenta/direcciones.ts`
- Crear: `src/islands/CuentaDirecciones.tsx`
- Modificar: `src/pages/cuenta.astro`

**Interfaces:**
- Consume: `pool`, `admiteCP` de `~/lib/entrega`
- Produce: `listarDirecciones(userId)`, `crearDireccion(userId, datos)`, `borrarDireccion(userId, id)`, `marcarPredeterminada(userId, id)`. Tipo `Direccion = { id, alias, calle, postalCode, predeterminada }`

- [ ] **Paso 1: La migración**

`db/migrations/003_direcciones.sql`:

```sql
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
```

```bash
pnpm db:migrar
```

- [ ] **Paso 2: Escribir la prueba del repositorio primero**

`src/lib/db/direcciones.test.ts` — necesita una base de datos de verdad, así que se salta sola si no hay una de pruebas configurada:

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de direcciones", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/direcciones");
  let userId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS });
    repo = await import("~/lib/db/direcciones");

    userId = `prueba-${Date.now()}`;
    await pool.query(
      'insert into "user" (id, email, name, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, false, now(), now())',
      [userId, `${userId}@ejemplo.com`, "Prueba"],
    );
  });

  afterAll(async () => {
    await pool.query('delete from "user" where id = $1', [userId]);
    await pool.end();
  });

  it("guarda y devuelve una dirección", async () => {
    const d = await repo.crearDireccion(userId, {
      alias: "Casa",
      calle: "Calle de Alcalá 100",
      postalCode: "28001",
      predeterminada: true,
    });

    const todas = await repo.listarDirecciones(userId);
    expect(todas).toHaveLength(1);
    expect(todas[0].id).toBe(d.id);
    expect(todas[0].predeterminada).toBe(true);
  });

  it("rechaza un código postal fuera de la zona de reparto", async () => {
    await expect(
      repo.crearDireccion(userId, {
        alias: "Barcelona",
        calle: "Passeig de Gràcia 1",
        postalCode: "08001",
        predeterminada: false,
      }),
    ).rejects.toThrow(/no repartimos/i);
  });

  it("al marcar otra predeterminada, la anterior deja de serlo", async () => {
    const segunda = await repo.crearDireccion(userId, {
      alias: "Oficina",
      calle: "Gran Vía 1",
      postalCode: "28013",
      predeterminada: false,
    });

    await repo.marcarPredeterminada(userId, segunda.id);
    const todas = await repo.listarDirecciones(userId);

    expect(todas.filter((d) => d.predeterminada)).toHaveLength(1);
    expect(todas.find((d) => d.predeterminada)?.id).toBe(segunda.id);
  });

  it("no deja borrar la dirección de otra persona", async () => {
    const [mia] = await repo.listarDirecciones(userId);
    const borradas = await repo.borrarDireccion("otro-usuario", mia.id);
    expect(borradas).toBe(0);
  });
});
```

- [ ] **Paso 3: Ver fallar**

Levanta una base de datos de pruebas (otra de tu proveedor, o Postgres local), aplícale las migraciones y exporta la variable:

```bash
DATABASE_URL=<la de pruebas> pnpm db:migrar
DATABASE_URL_TEST=<la de pruebas> pnpm test
```

Esperado: FALLA por módulo inexistente. Sin `DATABASE_URL_TEST`, las pruebas se saltan y el resto sigue en verde.

- [ ] **Paso 4: Escribir el repositorio**

`src/lib/db/direcciones.ts`. Requisitos concretos:

- `crearDireccion` valida con `admiteCP` **antes de tocar la base de datos** y lanza `new Error("No repartimos en el código postal ...")` si no.
- `marcarPredeterminada` va en una transacción: primero pone a `false` todas las del usuario, luego a `true` la elegida. Sin transacción, el índice único puede rechazar la escritura a medias y dejar al usuario sin ninguna predeterminada.
- **Todas** las consultas llevan `where user_id = $1`, incluidas las de borrado. `borrarDireccion` devuelve `rowCount` para que se pueda distinguir «borrada» de «no era tuya».
- Consultas parametrizadas siempre. Nada de concatenar SQL.
- **El mapeo de nombres es del repositorio.** En SQL las columnas son `postal_code` y `user_id`; hacia fuera el tipo es `Direccion = { id, alias, calle, postalCode, predeterminada }`, en camelCase. Haz el alias en el `select` (`postal_code as "postalCode"`) para que ningún consumidor vea nombres de columna.

- [ ] **Paso 5: Ver pasar**

```bash
DATABASE_URL_TEST=<la de pruebas> pnpm test
```

Esperado: las cuatro pruebas en verde.

- [ ] **Paso 6: Endpoint y pantalla**

`src/pages/api/cuenta/direcciones.ts` con `GET`, `POST`, `PATCH` (marcar predeterminada) y `DELETE`. Todos empiezan igual: si no hay `locals.usuario`, 401; y el `userId` sale **siempre** de la sesión.

`src/islands/CuentaDirecciones.tsx`: lista de direcciones con su alias, calle y código postal; marcar una como predeterminada; borrar con confirmación; formulario de alta que valida el código postal en cliente con `admiteCP` y avisa antes de enviar, igual que hace el checkout.

Móntala en `/cuenta` bajo los datos personales, separada con filete.

- [ ] **Paso 7: Comprobación manual**

1. Añade «Casa» con 28001: aparece en la lista.
2. Añade una con 08001: la rechaza antes de enviar.
3. Añade «Oficina» y márcala predeterminada: «Casa» deja de serlo.
4. Borra una: desaparece y sigue habiendo exactamente una predeterminada.
5. Con la sesión de otro usuario, intenta borrar por `curl` una dirección ajena usando su id. Esperado: no se borra nada.

- [ ] **Paso 8: Commit**

```bash
git add db/migrations/003_direcciones.sql src/lib/db/direcciones.ts src/lib/db/direcciones.test.ts src/pages/api/cuenta/direcciones.ts src/islands/CuentaDirecciones.tsx src/pages/cuenta.astro
git commit -m "feat(cuenta): direcciones guardadas con validación de zona de reparto"
```

---

### Tarea 9: Restablecer la contraseña

Sin esto, una contraseña olvidada deja la cuenta cerrada y hay que entrar a mano en la base de datos. Es parte del alcance mínimo, no un extra.

**Ficheros:**
- Modificar: `src/lib/auth/server.ts` (enganchar `sendResetPassword`)
- Crear: `src/pages/acceso/recuperar.astro`, `src/pages/acceso/nueva-contrasena.astro`
- Crear: `src/islands/RecuperarForm.tsx`, `src/islands/NuevaContrasenaForm.tsx`

**Interfaces:**
- Consume: `enviarCorreo` (tarea 4), `authClient`, `MIN_PASSWORD` (tarea 5)

- [ ] **Paso 1: Enganchar el correo**

En `src/lib/auth/server.ts`, dentro de `emailAndPassword`:

```ts
sendResetPassword: async ({ user, url }) => {
  await enviarCorreo({
    para: user.email,
    asunto: "Cambiar tu contraseña — Horno San Lorenzo",
    texto: [
      `Hola${user.name ? `, ${user.name}` : ""}:`,
      "",
      "Has pedido cambiar la contraseña de tu cuenta. Abre este enlace:",
      url,
      "",
      "El enlace caduca en una hora y solo sirve una vez.",
      "Si no has sido tú, no hace falta que hagas nada.",
    ].join("\n"),
  });
},
```

- [ ] **Paso 2: La pantalla de pedirlo**

`src/pages/acceso/recuperar.astro` con `RecuperarForm.tsx`: pide el correo y llama a `authClient.forgetPassword({ email, redirectTo: "/acceso/nueva-contrasena" })`.

**Responde siempre lo mismo**, exista o no la cuenta: «Si ese correo tiene cuenta, te hemos enviado un enlace para cambiar la contraseña.» Decir que no existe es confirmar qué correos están dados de alta.

- [ ] **Paso 3: La pantalla de cambiarla**

`src/pages/acceso/nueva-contrasena.astro` con `NuevaContrasenaForm.tsx`: lee el token del parámetro de la URL **en cliente** (el sitio es estático para lo público y esta página va sin prerenderizar, pero el token no debe pasar por el servidor de renderizado ni acabar en un log), pide la contraseña nueva dos veces, valida el mínimo de 8, y llama a `authClient.resetPassword({ newPassword, token })`. Al terminar, a `/acceso` con un aviso de que ya puede entrar.

- [ ] **Paso 4: Comprobación manual**

1. En `/acceso`, pulsa el enlace de recuperar.
2. Pon un correo que **no** existe: sale el mensaje neutro.
3. Pon el tuyo: llega el correo (con `RESEND_API_KEY` de pruebas; si no hay clave, el enlace sale en el log del servidor).
4. Abre el enlace, cambia la contraseña, entra con la nueva.
5. Vuelve a abrir el **mismo** enlace: tiene que estar caducado.
6. Comprueba que con la contraseña vieja ya no se entra.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/auth/server.ts src/pages/acceso src/islands/RecuperarForm.tsx src/islands/NuevaContrasenaForm.tsx
git commit -m "feat(acceso): recuperación de contraseña por correo"
```

---

### Tarea 10: El checkout viene relleno

El pago de esto: quien tiene cuenta no vuelve a teclear su nombre, su teléfono ni su dirección.

**Ficheros:**
- Modificar: `src/pages/carrito.astro` (pasar los datos de la sesión a la isla)
- Modificar: `src/islands/CartPage.tsx` (dejarlos pasar)
- Modificar: `src/islands/CheckoutFlow.tsx` (estado inicial y guardar dirección nueva)
- Modificar: `src/lib/pedido.ts` (`userId` opcional en el pedido)

**Interfaces:**
- Consume: `Astro.locals.usuario`, `listarDirecciones` (tarea 8)
- Produce: `CheckoutFlow` acepta `prefill?: { nombre, email, telefono, direcciones: Direccion[] }`

- [ ] **Paso 1: Llevar los datos hasta el checkout**

En `src/pages/carrito.astro`, con `prerender = false`, si hay sesión carga sus direcciones y pásalo todo como props hasta `CheckoutFlow`. Sin sesión, `prefill` es `undefined` y **todo sigue funcionando exactamente como hoy**: el checkout de invitado no se toca.

- [ ] **Paso 2: Estado inicial del formulario**

En `CheckoutFlow.tsx`, los estados `name`, `email`, `phone` arrancan con lo que venga en `prefill`. Si hay una dirección predeterminada, `address` y `postalCode` arrancan con ella.

Añade, cuando haya más de una dirección, un selector encima del campo de dirección: elegir una rellena los dos campos. La opción «Otra dirección» los vacía para escribir a mano.

Los campos **siguen siendo editables**: relleno no es bloqueo.

- [ ] **Paso 3: Guardar la dirección nueva**

Si el usuario tiene sesión y escribe una dirección que no está en su lista, ofrece una casilla «Guardar esta dirección en mi cuenta», marcada por defecto. Al enviar el pedido, si está marcada, llama a `POST /api/cuenta/direcciones` con alias `"Guardada en un pedido"`.

Si esa llamada falla, **el pedido sigue adelante**: no guardar una dirección no puede tumbar una compra.

- [ ] **Paso 4: Atar el pedido a la persona**

En `src/lib/pedido.ts`, añade `userId?: string` al pedido valorado — **no al esquema del cuerpo de la petición**. Sale de la sesión en el endpoint, nunca del navegador. En esta tarea todavía no se guarda en ninguna tabla; el plan 2 lo aprovecha para escribir `pedidos`.

- [ ] **Paso 5: Comprobar que no se ha roto el invitado**

```bash
pnpm test
pnpm check
```

Esperado: verde y 0 errores.

- [ ] **Paso 6: Comprobación manual, los dos caminos**

**Sin sesión** (ventana privada):
1. Añade un producto, ve al carrito y termina el pedido con envío. Todo igual que hoy: campos vacíos, código postal validado, teléfono obligatorio.

**Con sesión:**
2. Entra, añade un producto y abre el checkout. Nombre, correo y teléfono vienen puestos.
3. En envío, la dirección predeterminada viene puesta con su código postal.
4. Con dos direcciones, el selector cambia los campos al elegir.
5. Escribe una dirección nueva con la casilla marcada, termina el pedido y comprueba en `/cuenta` que aparece guardada.
6. Repite con la casilla desmarcada: no se guarda.

- [ ] **Paso 7: Commit**

```bash
git add src/pages/carrito.astro src/islands/CartPage.tsx src/islands/CheckoutFlow.tsx src/lib/pedido.ts
git commit -m "feat(checkout): el pedido viene relleno para quien tiene cuenta"
```

---

## Al terminar

Comprobaciones de cierre antes de dar el plan por hecho:

- [ ] `pnpm test` en verde y `pnpm check` con 0 errores.
- [ ] `pnpm build` termina bien.
- [ ] El catálogo, el carrito y el checkout de invitado funcionan igual que antes de empezar.
- [ ] `DATABASE_URL` y `BETTER_AUTH_SECRET` están en Vercel, no solo en local.
- [ ] `.env.example` documenta las variables nuevas y ya no menciona WhatsApp.

Y dos apuntes para `tasks/todo.md`, que este plan crea y no resuelve:

- **RGPD.** Ya se guardan datos personales. La política de privacidad no cubre cuentas y no hay borrado de cuenta a petición. Bloquea salir a producción con registro abierto.
- **Copias de seguridad.** Activar las del proveedor y **probar una restauración**, no solo confiar en que existen.
