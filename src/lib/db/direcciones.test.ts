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
