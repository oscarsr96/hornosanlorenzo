import { authClient } from "~/lib/auth/cliente";

type Tono = "claro" | "moka";

// El sitio es estático: casi todas las páginas se generan en build, sin
// petición ni sesión. Esta isla resuelve la sesión en el navegador con
// `authClient.useSession()` en vez de leer `Astro.locals.usuario` (que en
// una página prerenderizada siempre es `null`). Por eso vive en un único
// componente de cliente, montado dos veces con distinto tono de color.
const ESTILOS: Record<
  Tono,
  { contenedor: string; enlace: string; salir: string }
> = {
  // Banda superior de escritorio: fondo teja, texto en leche.
  claro: {
    contenedor: "hidden lg:inline-flex items-center gap-3",
    enlace:
      "hidden lg:inline-flex items-center h-10 px-4 whitespace-nowrap border border-[color:var(--color-leche)]/45 text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--color-leche)] hover:bg-[color:var(--color-leche)] hover:text-[color:var(--color-teja)] transition-colors",
    salir:
      "text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--color-leche)] underline underline-offset-4 hover:text-[color:var(--color-latte)] transition-colors",
  },
  // Panel del menú móvil: fondo latte, texto en moka con filete avellana.
  moka: {
    contenedor: "flex items-center gap-3 mt-4",
    enlace: "btn btn-secundario",
    salir:
      "text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-moka)] underline underline-offset-4 hover:text-[color:var(--color-caramelo)] transition-colors",
  },
};

async function salir() {
  await authClient.signOut();
  window.location.href = "/";
}

export default function AccesoSesion({ tono }: { tono: Tono }) {
  const { data, isPending } = authClient.useSession();
  const estilo = ESTILOS[tono];
  const claseInactiva = tono === "claro" ? "" : "mt-4";

  // Mientras se resuelve la sesión no se pinta ni «Acceso clientes» ni «Mi
  // cuenta»: se reserva el hueco del enlace sin sesión (el caso más
  // frecuente) pero invisible, para que la maqueta no salte al resolverse.
  if (isPending) {
    return (
      <a
        href="/acceso"
        aria-hidden="true"
        tabIndex={-1}
        className={`${estilo.enlace} ${claseInactiva} invisible`.trim()}
      >
        Acceso clientes
      </a>
    );
  }

  if (!data?.user) {
    return (
      <a
        href="/acceso"
        data-mobile-nav-link
        className={`${estilo.enlace} ${claseInactiva}`.trim()}
      >
        Acceso clientes
      </a>
    );
  }

  return (
    <div className={estilo.contenedor}>
      <a href="/cuenta" data-mobile-nav-link className={estilo.enlace}>
        Mi cuenta
      </a>
      <button type="button" className={estilo.salir} onClick={salir}>
        Salir
      </button>
    </div>
  );
}
