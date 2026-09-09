import { APIError } from "better-auth/api";
import { esTelefonoValido, normalizaTelefono } from "~/lib/entrega";

/**
 * Lógica de `databaseHooks.user.create.before` (Better Auth), separada de
 * `server.ts` para poder probarla sin levantar Postgres: importar
 * `server.ts` crea el pool de conexión en cuanto se carga el módulo.
 *
 * `validaRegistro`, en `~/lib/auth/validacion`, solo corre en el navegador.
 * Quien llame a `/sign-up/email` directamente, sin pasar por el formulario,
 * se saltaría esa validación: el teléfono es el dato con el que el
 * repartidor llama cuando no encuentra el portal, así que aquí se repite —
 * en el único sitio por el que pasa cualquier alta, sea cual sea su origen.
 * De paso se normaliza con `normalizaTelefono` (para no guardar
 * «666 12 34 56» y «+34666123456» como si fueran cosas distintas) y se
 * recorta el nombre, rechazando el alta si queda vacío.
 *
 * Un `APIError` lanzado aquí llega tal cual al cliente (código + mensaje),
 * no como un 500: Better Auth captura el fallo de `createUser` y, al ser un
 * `APIError`, lo relanza sin envolverlo.
 */
export async function preparaAltaUsuario(
  user: Record<string, any>,
): Promise<{ data: Record<string, any> }> {
  const nombre = typeof user.name === "string" ? user.name.trim() : "";
  if (!nombre) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_NAME",
      message: "Dinos cómo te llamas.",
    });
  }

  const telefonoBruto = typeof user.telefono === "string" ? user.telefono : "";
  if (!esTelefonoValido(telefonoBruto)) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_PHONE",
      message: "Escribe un móvil o fijo español de nueve dígitos.",
    });
  }

  return {
    data: {
      ...user,
      name: nombre,
      telefono: normalizaTelefono(telefonoBruto),
    },
  };
}
