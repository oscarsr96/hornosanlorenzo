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
