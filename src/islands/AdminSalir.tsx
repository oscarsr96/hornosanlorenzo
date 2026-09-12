import { authClient } from "~/lib/auth/cliente";

// El panel se sirve sin la cabecera pública (BaseLayout no la incluye), así
// que sin esta isla no habría forma de cerrar sesión desde /admin. Hace lo
// mismo que el «Salir» de `AccesoSesion`: borrar la sesión en el servidor y
// volver a la home.
async function salir() {
  await authClient.signOut();
  window.location.href = "/";
}

export default function AdminSalir() {
  return (
    <button
      type="button"
      onClick={salir}
      className="text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-moka)] underline underline-offset-4 hover:text-[color:var(--color-caramelo)] transition-colors"
    >
      Salir
    </button>
  );
}
