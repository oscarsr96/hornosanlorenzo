/**
 * Errores propios de las direcciones guardadas y su traducción a un mensaje
 * presentable. Deliberadamente sin `pg` de por medio —`direcciones.ts`, el
 * repositorio, es quien importa `~/lib/db/pool`—: así este módulo se puede
 * importar en las pruebas (`traduceError` es lógica pura) sin arrastrar una
 * conexión a Postgres, y sobre todo sin disparar la creación del pool de
 * producción antes de que el `beforeAll` de `direcciones.test.ts` apunte
 * `DATABASE_URL` a la base de pruebas para el resto de la suite.
 */

/**
 * Igual que `OrderError` en `~/lib/pedido`: un error propio, reconocible por
 * `instanceof`, para los mensajes que el repositorio de direcciones escribe
 * a propósito para que los vea el usuario. El endpoint solo reenvía
 * `.message` cuando el error es de esta clase — identificarlos por lo que
 * *son*, no por lo que les falta (un `Error` pelado sin `.code`, como el
 * que lanza `pg` cuando se cae la conexión a media consulta, no es un error
 * nuestro aunque no traiga código; con la clase propia no hay ambigüedad
 * posible).
 */
export class DireccionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "DireccionError";
  }
}

/**
 * Mismo mensaje para «no existe» y «es de otro usuario»: distinguirlos le
 * diría a quien pruebe ids ajenos cuáles existen de verdad. Lo usan
 * `borrarDireccion` (vía el endpoint, que compone la respuesta a partir de
 * `rowCount`) y `marcarPredeterminada` (que lo lanza directamente), para que
 * el endpoint solo tenga que comparar contra una constante, no repetir el
 * texto.
 */
export const MENSAJE_DIRECCION_AJENA = "Esa dirección no existe o no es tuya.";

/**
 * Traduce un error a una respuesta presentable, en español, sin reenviar
 * nunca el texto crudo de Postgres —o de cualquier otra cosa que no
 * hayamos escrito nosotros a propósito— al navegador.
 *
 * El criterio es cerrado y va por lo que el error *es*, no por lo que le
 * falta: solo un `DireccionError` (lanzado por `crearDireccion` o
 * `marcarPredeterminada`, en `direcciones.ts`) se reenvía tal cual, con su
 * propio `status`. Cualquier otra cosa —un `DatabaseError` de `pg` con
 * código SQLSTATE, o un `Error` pelado como `"Connection terminated
 * unexpectedly"`, que el driver lanza sin `.code` cuando la conexión se
 * cae a media consulta— cae en el genérico, salvo el único código de `pg`
 * que sabemos traducir a mano: `23505`, la violación del índice único de
 * «una predeterminada» si dos peticiones piden a la vez marcar
 * predeterminadas distintas.
 */
export function traduceError(
  error: unknown,
  generico: string,
): { mensaje: string; status: number } {
  if (error instanceof DireccionError) {
    return { mensaje: error.message, status: error.status };
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === "23505") {
    return {
      mensaje:
        "Ya tienes una dirección predeterminada. Quítale la marca antes de poner otra.",
      status: 409,
    };
  }
  return { mensaje: generico, status: 400 };
}
