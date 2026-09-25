import type { DeliveryMode } from "~/lib/entrega";

/**
 * Volver del login al checkout donde se dejó.
 *
 * «Ya soy cliente» en el paso de dirección manda a `/acceso`, y al entrar hay
 * que regresar al carrito con el checkout abierto en ese mismo paso, para
 * elegir una dirección guardada. Lo elegido hasta ahí se aparca en
 * `sessionStorage`: dura lo que la pestaña y no viaja al servidor.
 */

const KEY = "hsl-checkout-reanudar";

export type CheckoutAparcado = { mode: DeliveryMode; dateISO: string };

/** Adónde vuelve el login desde el checkout. */
export const VOLVER_AL_CARRITO = "/acceso?volver=/carrito";

export function aparcarCheckout(estado: CheckoutAparcado): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento se vuelve al carrito igual, solo que desde el principio.
  }
}

/** Lee y borra lo aparcado: se reanuda una vez, no cada vez que se abre. */
export function recogerCheckout(): CheckoutAparcado | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CheckoutAparcado>;
    if (
      (v.mode === "domicilio" || v.mode === "recogida") &&
      typeof v.dateISO === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.dateISO)
    ) {
      return { mode: v.mode, dateISO: v.dateISO };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ruta a la que mandar tras entrar. Solo rutas del propio sitio: un
 * `?volver=https://otro.sitio` convertiría el login en una redirección
 * abierta.
 */
export function rutaDeVuelta(raw: string | null | undefined): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\")
  ) {
    return "/cuenta";
  }
  return raw;
}
