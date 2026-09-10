import { describe, expect, it } from "vitest";
// Del módulo sin `pg`, no de `~/lib/db/productos`: ese importa
// `~/lib/db/pool`, que crea el pool de conexión en cuanto se carga el
// módulo. Por eso estas pruebas corren siempre —sin `describeSiHayBD`, sin
// depender de `DATABASE_URL_TEST`—: `traduce` es lógica pura. Mismo patrón
// que `noticiasErrores.test.ts` y `direccionesErrores.ts`.
import { ProductoError, traduce } from "~/lib/db/productosErrores";

describe("traduce", () => {
  it("un ProductoError propio pasa tal cual, con su status", () => {
    const propio = new ProductoError("No se puede guardar sin nombre.", 400);
    expect(() => traduce(propio)).toThrow(propio);
  });

  it("un error de pg con código 23505 se traduce al mensaje en español, sin el nombre del índice", () => {
    const errorPg = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "productos_slug_key"',
      ),
      { code: "23505" },
    );
    let capturado: unknown;
    try {
      traduce(errorPg);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(ProductoError);
    const productoError = capturado as ProductoError;
    expect(productoError.status).toBe(409);
    expect(productoError.message).toMatch(/ya hay una ficha/i);
    // El texto del índice de Postgres no puede llegar a la pantalla.
    expect(productoError.message).not.toMatch(/productos_slug_key/);
    expect(productoError.message).not.toMatch(/duplicate key/i);
  });

  it("un 23505 con el índice de slug se traduce al mensaje de «nombre repetido»", () => {
    const errorPg = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "productos_slug_key"',
      ),
      { code: "23505", constraint: "productos_slug_key" },
    );
    let capturado: unknown;
    try {
      traduce(errorPg);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(ProductoError);
    const productoError = capturado as ProductoError;
    expect(productoError.status).toBe(409);
    expect(productoError.message).toMatch(/ya hay una ficha/i);
  });

  it("un 23505 con el índice de variantes se traduce a su propio mensaje, no al del slug", () => {
    const errorPg = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "variantes_producto_id_variant_id_key"',
      ),
      { code: "23505", constraint: "variantes_producto_id_variant_id_key" },
    );
    let capturado: unknown;
    try {
      traduce(errorPg);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(ProductoError);
    const productoError = capturado as ProductoError;
    expect(productoError.status).toBe(409);
    expect(productoError.message).toMatch(/identificador/i);
    // El mensaje de «ya hay una ficha con ese nombre» es del índice de
    // slug: aplicarlo aquí sería decirle a quien edita que renombre el
    // producto cuando lo que hay que arreglar es la variante duplicada.
    expect(productoError.message).not.toMatch(/ya hay una ficha/i);
    expect(productoError.message).not.toMatch(
      /variantes_producto_id_variant_id_key/,
    );
  });

  it("un error de pg con código 23514 (precio_o_consultar) se traduce a su propio mensaje", () => {
    const errorPg = Object.assign(
      new Error(
        'new row for relation "productos" violates check constraint "precio_o_consultar"',
      ),
      { code: "23514" },
    );
    let capturado: unknown;
    try {
      traduce(errorPg);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(ProductoError);
    const productoError = capturado as ProductoError;
    expect(productoError.status).toBe(400);
    expect(productoError.message).toMatch(/precio.*consultar/i);
    // Tampoco aquí puede llegar el nombre de la restricción a la pantalla.
    expect(productoError.message).not.toMatch(/precio_o_consultar/);
  });

  it("un Error pelado sin código (como la conexión perdida de pg) no se confunde con uno propio", () => {
    // Así lanza `pg` cuando la conexión se cae con una consulta en curso: un
    // `Error` normal, sin `.code`. No debe colarse por la rama de «error
    // nuestro» ni convertirse en un `ProductoError`.
    const errorConexion = new Error("Connection terminated unexpectedly");
    let capturado: unknown;
    try {
      traduce(errorConexion);
    } catch (err) {
      capturado = err;
    }
    expect(capturado).not.toBeInstanceOf(ProductoError);
    expect(capturado).toBe(errorConexion);
  });
});
