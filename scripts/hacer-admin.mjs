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
