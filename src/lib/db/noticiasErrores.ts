/**
 * Errores propios de las noticias y su traducción a un mensaje presentable.
 * Deliberadamente sin `pg` de por medio —`noticias.ts`, el repositorio, es
 * quien importa `~/lib/db/pool`—: así este módulo se puede importar en las
 * pruebas (`traduce` es lógica pura) sin arrastrar una conexión a Postgres,
 * y sobre todo sin disparar la creación del pool de producción antes de que
 * el `beforeAll` de `noticias.test.ts` apunte `DATABASE_URL` a la base de
 * pruebas para el resto de la suite. Mismo patrón que
 * `direccionesErrores.ts`, cuyo comentario de cabecera cuenta el bug real
 * que esta separación evita: un `Error` pelado de `pg` sin `.code` (el
 * "Connection terminated unexpectedly" que lanza el driver cuando la
 * conexión se cae a media consulta) coleándose por la rama de «error
 * nuestro» y llegando en inglés hasta quien esté escribiendo la noticia.
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

/**
 * Traduce los errores de Postgres a algo que se le puede enseñar a quien
 * está escribiendo la noticia. El criterio es cerrado y va por lo que el
 * error *es*, no por lo que le falta: solo un `NoticiaError` propio (lanzado
 * por `crearNoticia` o `actualizarNoticia`, en `noticias.ts`) se reenvía tal
 * cual, con su propio `status`. El único código de `pg` que se traduce a
 * mano es `23505`, la violación del índice único de `slug`, y desde que la
 * noticia puede enlazar un producto, `23503`, la clave ajena a `productos`
 * (el desplegable del panel apuntaba a una ficha que ya no existe). El
 * texto del índice o de la restricción de Postgres no sale nunca a la
 * pantalla. Cualquier otra cosa —un `Error` pelado sin `.code`, por
 * ejemplo— no se confunde con un error nuestro: se relanza tal cual para
 * que quien llame decida qué hacer.
 */
export function traduce(err: unknown): never {
  if (err instanceof NoticiaError) throw err;
  const code =
    typeof err === "object" && err && "code" in err ? err.code : undefined;
  if (code === "23505") {
    throw new NoticiaError(
      "Ya hay una noticia con ese título. Cámbialo un poco.",
      409,
    );
  }
  if (code === "23503") {
    throw new NoticiaError(
      "Ese producto ya no está en la carta. Elige otro o deja la noticia sin producto.",
      400,
    );
  }
  throw err;
}
