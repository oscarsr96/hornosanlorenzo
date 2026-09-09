import { defineMiddleware } from "astro:middleware";
import { auth } from "~/lib/auth/server";

export const onRequest = defineMiddleware(async (context, next) => {
  const sesion = await auth.api.getSession({
    headers: context.request.headers,
  });

  context.locals.usuario = sesion?.user ?? null;

  return next();
});
