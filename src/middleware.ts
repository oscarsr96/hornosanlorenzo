import { defineMiddleware } from "astro:middleware";
import { auth } from "~/lib/auth/server";

export const onRequest = defineMiddleware(async (context, next) => {
  // Este middleware corre en TODAS las peticiones, no solo en las de
  // autenticación. Si `getSession` lanza —un corte momentáneo con Postgres,
  // una cookie corrupta, un fallo interno de Better Auth— no puede tumbar el
  // resto del sitio: degrada a "sin sesión" y deja pasar la petición.
  // Alguien que no pueda identificarse debe poder seguir comprando como
  // invitado.
  try {
    const sesion = await auth.api.getSession({
      headers: context.request.headers,
    });

    context.locals.usuario = sesion?.user ?? null;
  } catch (error) {
    // Nunca volcar cookies, tokens ni la cadena de conexión: solo el motivo.
    console.error(
      "No se pudo resolver la sesión, se sirve como invitado:",
      error instanceof Error ? error.message : error,
    );
    context.locals.usuario = null;
  }

  return next();
});
