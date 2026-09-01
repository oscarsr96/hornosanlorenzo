import type { CategoryId } from "~/data/categories";

/**
 * Estructura de navegación del brief de front end:
 * cuatro secciones, con submenú de tres entradas en «Nuestros Productos».
 */
export type NavChild = {
  href: string;
  label: string;
  short: string;
  /** Categorías del catálogo que agrupa esta entrada. */
  categories?: readonly CategoryId[];
};

export type NavItem = {
  href: string;
  label: string;
  children?: readonly NavChild[];
};

export const mainNav: readonly NavItem[] = [
  { href: "/tiendas", label: "Nuestras tiendas" },
  { href: "/tradicion-y-calidad", label: "Tradición y Calidad" },
  {
    href: "/catalogo",
    label: "Nuestros Productos",
    children: [
      {
        href: "/catalogo/dulce",
        label: "Dulce",
        short: "Repostería de obrador con la receta tradicional desde 1986.",
        categories: ["bolleria", "tartas", "temporada"],
      },
      {
        href: "/catalogo/salado",
        label: "Salado",
        short: "El secreto de comer bien lleva 40 años en nuestra casa.",
        categories: ["salado"],
      },
      {
        href: "/catalogo/packs",
        label: "Packs y promos del mes",
        short: "Nuestras cajitas para cada ocasión, listas para llevar.",
      },
    ],
  },
  { href: "/hosteleria-y-empresas", label: "Hostelería y Empresas" },
] as const;

export const footerNav: readonly { href: string; label: string }[] = [
  { href: "/catalogo", label: "Nuestros productos" },
  { href: "/catalogo/packs", label: "Packs y promos" },
  { href: "/hosteleria-y-empresas", label: "Hostelería y empresas" },
  { href: "/servicios", label: "Servicios" },
  { href: "/tradicion-y-calidad", label: "Tradición y calidad" },
  { href: "/tiendas", label: "Nuestras tiendas" },
  { href: "/noticias", label: "Noticias" },
  { href: "/contacto", label: "Contacto" },
] as const;

/** Formas de pago admitidas, para el pie de página. */
export const paymentMethods: readonly { id: string; label: string }[] = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "amex", label: "American Express" },
  { id: "bizum", label: "Bizum" },
  { id: "efectivo", label: "Efectivo en tienda" },
  { id: "transferencia", label: "Transferencia (empresas)" },
] as const;
