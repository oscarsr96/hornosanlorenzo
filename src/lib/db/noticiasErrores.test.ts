import { describe, expect, it } from "vitest";
// Del módulo sin `pg`, no de `~/lib/db/noticias`: ese importa
// `~/lib/db/pool`, que crea el pool de conexión en cuanto se carga el
// módulo. Por eso estas pruebas corren siempre —sin `describeSiHayBD`, sin
// depender de `DATABASE_URL_TEST`—: `traduce` es lógica pura y es
// precisamente la prueba que antes solo corría bajo la suite de base de
// datos, sin cobertura en un entorno sin base de pruebas configurada.
import { NoticiaError, traduce } from "~/lib/db/noticiasErrores";

describe("traduce", () => {
  it("un NoticiaError propio pasa tal cual, con su status", () => {
    const propio = new NoticiaError("No se puede publicar sin fecha.", 400);
    expect(() => traduce(propio)).toThrow(propio);
  });

  it("un error de pg con código 23505 se traduce al mensaje en español, sin el nombre del índice", () => {
    const errorPg = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "noticias_slug_key"',
      ),
      { code: "23505" },
    );
    let capturado: unknown;
    try {
      traduce(errorPg);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(NoticiaError);
    const noticiaError = capturado as NoticiaError;
    expect(noticiaError.status).toBe(409);
    expect(noticiaError.message).toMatch(/ya hay una noticia/i);
    // El texto del índice de Postgres no puede llegar a la pantalla.
    expect(noticiaError.message).not.toMatch(/noticias_slug_key/);
    expect(noticiaError.message).not.toMatch(/duplicate key/i);
  });

  it("un Error pelado sin código (como la conexión perdida de pg) no se confunde con uno propio", () => {
    // Así lanza `pg` cuando la conexión se cae con una consulta en curso: un
    // `Error` normal, sin `.code`. No debe colarse por la rama de «error
    // nuestro» ni convertirse en un `NoticiaError`.
    const errorConexion = new Error("Connection terminated unexpectedly");
    let capturado: unknown;
    try {
      traduce(errorConexion);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).not.toBeInstanceOf(NoticiaError);
    expect(capturado).toBe(errorConexion);
  });
});
