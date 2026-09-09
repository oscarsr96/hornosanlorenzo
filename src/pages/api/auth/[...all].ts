import type { APIRoute } from "astro";
import { auth } from "~/lib/auth/server";

export const prerender = false;

export const ALL: APIRoute = (ctx) => {
  // El límite de intentos se calcula por IP. Detrás del proxy de Vercel la
  // IP real del cliente no va en una cabecera estándar del `Request`, así
  // que se la pasamos a mano: sin esto, en producción todo el tráfico
  // compartiría un único contador. En local, Better Auth usa localhost como
  // IP por defecto y el límite funciona igual sin este paso.
  ctx.request.headers.set("x-forwarded-for", ctx.clientAddress);
  return auth.handler(ctx.request);
};
