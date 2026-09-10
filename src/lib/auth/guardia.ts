/**
 * Quién entra en el panel. Sin `pg` ni `astro:*` a propósito: así se puede
 * probar sin levantar nada, igual que `~/lib/auth/campos`.
 */

export const ROL_ADMIN = "admin";

type Usuario = App.Locals["usuario"];

/**
 * Comparación exacta contra la constante. Nada de `includes` ni de pasar a
 * minúsculas: el papel lo escribe `scripts/hacer-admin.mjs` con este valor y
 * ninguna variante debe colar.
 */
export function esAdmin(usuario: Usuario): boolean {
  return usuario?.rol === ROL_ADMIN;
}

/** Todo lo que hay debajo de estas rutas está cerrado. */
const RUTAS_PANEL = ["/admin", "/api/admin"];

/** `/administracion` no es `/admin`: o es exacta, o cuelga con una barra. */
const esRutaDelPanel = (pathname: string): boolean =>
  RUTAS_PANEL.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );

/**
 * Devuelve la respuesta con la que hay que cortar, o null si se puede pasar.
 *
 * Sin sesión: a la pantalla de acceso. Con sesión pero sin ser admin: 404
 * pelado. Es lo que pide la spec §7 y el motivo es concreto — un 403 le
 * confirmaría a cualquier cliente registrado que ahí detrás hay un panel de
 * administración que puede ponerse a probar.
 */
export function guardiaAdmin(contexto: {
  usuario: Usuario;
  pathname: string;
}): Response | null {
  if (!esRutaDelPanel(contexto.pathname)) return null;

  if (!contexto.usuario) {
    return new Response(null, {
      status: 302,
      headers: { location: "/acceso" },
    });
  }
  if (!esAdmin(contexto.usuario)) {
    return new Response("No encontrado", { status: 404 });
  }
  return null;
}
