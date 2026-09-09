import type { APIRoute } from "astro";
import { auth } from "~/lib/auth/server";

export const prerender = false;

export const ALL: APIRoute = (ctx) => {
  // El límite de intentos se calcula por IP. Detrás del proxy de Vercel la
  // IP real del cliente no va en una cabecera estándar del `Request`, así
  // que se la pasamos a mano: sin esto, en producción todo el tráfico
  // compartiría un único contador. En local, Better Auth usa localhost como
  // IP por defecto y el límite funciona igual sin este paso.
  //
  // OJO: `ctx.clientAddress` en Vercel viene del `x-forwarded-for` original,
  // que puede traer varios saltos separados por comas ("ip-cliente, proxy1,
  // proxy2"). Better Auth, sin proxies de confianza configurados, rechaza
  // cualquier cabecera con más de una IP y cae en una clave global de límite
  // compartida por todo el sitio: bastan diez peticiones de cualquiera para
  // bloquear el inicio de sesión a todo el mundo. Por eso nos quedamos solo
  // con el primer token, que es la IP real del cliente. No lo «simplifiques»
  // quitando el split: eso reabre el candado global.
  if (ctx.clientAddress) {
    const ipCliente = ctx.clientAddress.split(",")[0].trim();
    ctx.request.headers.set("x-forwarded-for", ipCliente);
  }
  return auth.handler(ctx.request);
};
