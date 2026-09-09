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

  // Ronda de arreglo: `marcarPredeterminada` desmarca todas antes de
  // comprobar que el segundo `update` encontró la fila. Sin la comprobación
  // de `rowCount`, un id inexistente o ajeno dejaba al usuario sin ninguna
  // predeterminada aunque el endpoint respondiera `{ok:true}`. Estas dos
  // pruebas comprueban que, en ambos casos, la predeterminada que había
  // antes se conserva exactamente igual.
  it("marcar un id que no existe no deja al usuario sin predeterminada", async () => {
    const antes = await repo.listarDirecciones(userId);
    const predeterminadaAntes = antes.find((d) => d.predeterminada)?.id;
    expect(predeterminadaAntes).toBeDefined();

    await expect(
      repo.marcarPredeterminada(userId, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/no existe o no es tuya/i);

    const despues = await repo.listarDirecciones(userId);
    expect(despues.filter((d) => d.predeterminada)).toHaveLength(1);
    expect(despues.find((d) => d.predeterminada)?.id).toBe(predeterminadaAntes);
  });

  it("marcar la dirección de otro usuario no toca la predeterminada de ninguno de los dos", async () => {
    const otroUserId = `prueba-otro-${Date.now()}`;
    await pool.query(
      'insert into "user" (id, email, name, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, false, now(), now())',
      [otroUserId, `${otroUserId}@ejemplo.com`, "Prueba Otro"],
    );

    try {
      const deOtro = await repo.crearDireccion(otroUserId, {
        alias: "Casa de otro",
        calle: "Calle Mayor 1",
        postalCode: "28001",
        predeterminada: true,
      });

      const antes = await repo.listarDirecciones(userId);
      const predeterminadaAntes = antes.find((d) => d.predeterminada)?.id;
      expect(predeterminadaAntes).toBeDefined();

      await expect(
        repo.marcarPredeterminada(userId, deOtro.id),
      ).rejects.toThrow(/no existe o no es tuya/i);

      const despues = await repo.listarDirecciones(userId);
      expect(despues.filter((d) => d.predeterminada)).toHaveLength(1);
      expect(despues.find((d) => d.predeterminada)?.id).toBe(
        predeterminadaAntes,
      );

      const delOtroDespues = await repo.listarDirecciones(otroUserId);
      expect(delOtroDespues.filter((d) => d.predeterminada)).toHaveLength(1);
      expect(delOtroDespues.find((d) => d.predeterminada)?.id).toBe(deOtro.id);
    } finally {
      await pool.query('delete from "user" where id = $1', [otroUserId]);
    }
  });
});
