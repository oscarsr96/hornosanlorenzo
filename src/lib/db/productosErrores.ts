/**
 * Errores propios de los productos y su traducción a un mensaje presentable.
 * Deliberadamente sin `pg` de por medio —`productos.ts`, el repositorio, es
 * quien importa `~/lib/db/pool`—: así este módulo se puede importar en las
 * pruebas (`traduce` es lógica pura) sin arrastrar una conexión a Postgres,
 * y sobre todo sin disparar la creación del pool de producción antes de que
 * el `beforeAll` de `productos.test.ts` apunte `DATABASE_URL` a la base de
 * pruebas para el resto de la suite. Mismo patrón que `noticiasErrores.ts` y
 * `direccionesErrores.ts`, cuyo comentario de cabecera cuenta el bug real
 * que esta separación evita: un `Error` pelado de `pg` sin `.code` (el
 * "Connection terminated unexpectedly" que lanza el driver cuando la
 * conexión se cae a media consulta) coleándose por la rama de «error
 * nuestro» y llegando en inglés hasta quien esté editando la ficha.
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

/**
 * Traduce los errores de Postgres a algo que se le puede enseñar a quien
 * está editando la ficha. El criterio es cerrado y va por lo que el error
 * *es*, no por lo que le falta: solo un `ProductoError` propio (lanzado por
 * `crearProducto` o `actualizarProducto`, en `productos.ts`) se reenvía tal
 * cual, con su propio `status`. Los únicos códigos de `pg` que se traducen a
 * mano son `23505` (el índice único de `slug`... en la práctica, del nombre,
 * porque el slug sale de él) y `23514` (la restricción `precio_o_consultar`
 * de la migración 007); ni el nombre del índice ni el de la restricción
 * salen nunca a la pantalla. Cualquier otra cosa —un `Error` pelado sin
 * `.code`, por ejemplo— no se confunde con un error nuestro: se relanza tal
 * cual para que quien llame decida qué hacer.
 */
export function traduce(err: unknown): never {
  if (err instanceof ProductoError) throw err;
  if (typeof err === "object" && err && "code" in err) {
    if (err.code === "23505") {
      throw new ProductoError(
        "Ya hay una ficha con ese nombre. Cámbialo un poco.",
        409,
      );
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
