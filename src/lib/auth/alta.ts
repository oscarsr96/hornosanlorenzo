import { APIError } from "better-auth/api";
import { esTelefonoValido, normalizaTelefono } from "~/lib/entrega";

export type DatosPersonales = { name: string; telefono: string };

export type ResultadoValidacionDatos =
  | { ok: true; data: DatosPersonales }
  | { ok: false; code: "INVALID_NAME" | "INVALID_PHONE"; message: string };

/**
 * Valida y normaliza nombre y teléfono con las mismas reglas en todos los
 * sitios donde se pueden guardar: el alta (`preparaAltaUsuario`, más abajo)
 * y la edición desde `/cuenta` (`src/pages/api/cuenta/datos.ts`). Sería
 * absurdo poder guardar editando un teléfono que el alta rechaza.
 *
 * El teléfono es el dato con el que el repartidor llama cuando no encuentra
 * el portal. Se normaliza con `normalizaTelefono` (para no guardar
 * «666 12 34 56» y «+34666123456» como si fueran cosas distintas) y se
 * recorta el nombre, rechazando el dato si queda vacío.
 */
export function validaDatosPersonales(
  input: Record<string, unknown>,
): ResultadoValidacionDatos {
  const nombre = typeof input.name === "string" ? input.name.trim() : "";
  if (!nombre) {
    return {
      ok: false,
      code: "INVALID_NAME",
      message: "Dinos cómo te llamas.",
    };
  }

  const telefonoBruto =
    typeof input.telefono === "string" ? input.telefono : "";
  if (!esTelefonoValido(telefonoBruto)) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      message: "Escribe un móvil o fijo español de nueve dígitos.",
    };
  }

  return {
    ok: true,
    data: { name: nombre, telefono: normalizaTelefono(telefonoBruto) },
  };
}

/**
 * Lógica de `databaseHooks.user.create.before` (Better Auth), separada de
 * `server.ts` para poder probarla sin levantar Postgres: importar
 * `server.ts` crea el pool de conexión en cuanto se carga el módulo.
 *
 * `validaRegistro`, en `~/lib/auth/validacion`, solo corre en el navegador.
 * Quien llame a `/sign-up/email` directamente, sin pasar por el formulario,
 * se saltaría esa validación, así que aquí se repite con
 * `validaDatosPersonales` — en el único sitio por el que pasa cualquier
 * alta, sea cual sea su origen.
 *
 * Un `APIError` lanzado aquí llega tal cual al cliente (código + mensaje),
 * no como un 500: Better Auth captura el fallo de `createUser` y, al ser un
 * `APIError`, lo relanza sin envolverlo.
 */
export async function preparaAltaUsuario(
  user: Record<string, any>,
): Promise<{ data: Record<string, any> }> {
  const resultado = validaDatosPersonales(user);
  if (!resultado.ok) {
    throw new APIError("BAD_REQUEST", {
      code: resultado.code,
      message: resultado.message,
    });
  }

  return {
    data: {
      ...user,
      name: resultado.data.name,
      telefono: resultado.data.telefono,
    },
  };
}
