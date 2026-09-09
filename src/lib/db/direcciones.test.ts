import { describe, expect, it, beforeAll, afterAll } from "vitest";
// Del módulo sin `pg`, no de `~/lib/db/direcciones`: ese importa
// `~/lib/db/pool`, que crea el pool de conexión en cuanto se carga el
// módulo. Un `import` estático de `~/lib/db/direcciones` aquí arriba
// dispararía esa creación contra el `DATABASE_URL` normal *antes* de que el
// `beforeAll` de más abajo lo redirija a `DATABASE_URL_TEST` — y, como los
// módulos de Node se cachean, el `import()` dinámico de dentro del
// `beforeAll` devolvería ese mismo pool ya apuntando a la base equivocada.
import { DireccionError, traduceError } from "~/lib/db/direccionesErrores";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

// `traduceError` es lógica pura —no toca Postgres—, así que corre siempre,
// sin depender de `DATABASE_URL_TEST` ni de tener una base de pruebas
// configurada: es justo la prueba que faltaba y la que habría detectado la
// ronda de arreglo anterior, donde un `Error` pelado sin `.code` (como el
// que lanza `pg` cuando la conexión se cae a media consulta:
// "Connection terminated unexpectedly", en `node_modules/pg/lib/client.js`)
// se colaba por la rama de «error nuestro» y su texto en inglés llegaba tal
// cual al navegador.
describe("traduceError", () => {
  it("un DireccionError propio se presenta tal cual, con su status", () => {
    const { mensaje, status } = traduceError(
      new DireccionError("No repartimos en el código postal 08001.", 400),
      "genérico",
    );
    expect(mensaje).toBe("No repartimos en el código postal 08001.");
    expect(status).toBe(400);
  });

  it("un error de pg con código conocido se traduce a un mensaje nuestro", () => {
    const errorPg = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "direcciones_una_predeterminada"',
      ),
      {
        code: "23505",
      },
    );
    const { mensaje, status } = traduceError(errorPg, "genérico");
    expect(mensaje).not.toMatch(/direcciones_una_predeterminada/);
    expect(mensaje).not.toMatch(/duplicate key/i);
    expect(mensaje).toMatch(/ya tienes una dirección predeterminada/i);
    expect(status).toBe(409);
  });

  it("un Error pelado sin código (como la conexión perdida de pg) cae en el genérico, nunca en su propio texto", () => {
    // Así lanza `pg` en `lib/client.js` cuando la conexión se cae con una
    // consulta en curso: un `Error` normal, sin `.code`, que antes del
    // arreglo se colaba como si fuera un mensaje nuestro.
    const errorConexion = new Error("Connection terminated unexpectedly");
    const { mensaje, status } = traduceError(
      errorConexion,
      "No se pudo guardar la dirección.",
    );
    expect(mensaje).toBe("No se pudo guardar la dirección.");
    expect(mensaje).not.toMatch(/connection terminated/i);
    expect(status).toBe(400);
  });
});

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
