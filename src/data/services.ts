export type Service = {
  id: "domicilio" | "catering" | "horeca";
  title: string;
  short: string;
  body: string;
  icon: "truck" | "party" | "store";
};

export const services: readonly Service[] = [
  {
    id: "domicilio",
    title: "Servicio a domicilio",
    short: "Recibe tus dulces en casa, de lunes a sábado.",
    body: "Pedidos por WhatsApp o teléfono antes de las 11:00, entrega esa misma tarde en Alcobendas, Pozuelo y municipios cercanos. Pedido mínimo 15 €.",
    icon: "truck",
  },
  {
    id: "catering",
    title: "Catering para eventos",
    short: "Bautizos, comuniones, comidas de empresa, bodas.",
    body: "Repostería salada y dulce a medida. Asesoría de menú, montaje y entrega. Pídenos presupuesto con al menos una semana de antelación.",
    icon: "party",
  },
  {
    id: "horeca",
    title: "Distribución a hostelería",
    short: "Bares, restaurantes, hoteles y cafeterías.",
    body: "Reparto diario de bollería, hojaldres y tartas. Catálogo profesional, precios mayoristas, facturación mensual. Cubrimos toda la zona norte y oeste de Madrid.",
    icon: "store",
  },
] as const;
