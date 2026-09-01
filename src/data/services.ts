export type Service = {
  id: "domicilio" | "empresas" | "horeca";
  title: string;
  short: string;
  body: string;
  number: string;
};

export const services: readonly Service[] = [
  {
    id: "domicilio",
    title: "Reparto propio a domicilio",
    short: "Furgoneta y repartidor de la casa, de lunes a sábado.",
    body: "Pide por WhatsApp o por teléfono antes de las 11:00 y lo llevamos esa misma tarde a Alcobendas, Pozuelo y municipios cercanos. Nadie subcontratado: al cliente se le conoce por su nombre, no por su número de pedido.",
    number: "01",
  },
  {
    id: "empresas",
    title: "Empresas y oficinas",
    short: "Desayunos de equipo, coffee breaks y catering de reuniones.",
    body: "Comida de verdad servida cada día, con el precio y la fiabilidad que una empresa necesita. Alta con CIF, packs XL con descuento y factura mensual. La misma calidad para un cumpleaños que para cien desayunos.",
    number: "02",
  },
  {
    id: "horeca",
    title: "Hostelería",
    short: "Bares, restaurantes, hoteles y cafeterías de la zona norte.",
    body: "Suministro recurrente de tartas, empanadas y bollería con entrega diaria de lunes a sábado. Producto de obrador, formato mayorista y constancia: más de 40 años haciéndolo bien.",
    number: "03",
  },
] as const;
