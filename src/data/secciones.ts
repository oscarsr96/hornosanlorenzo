/**
 * Secciones de la carta de Dulce (p02_avellana, páginas 5–9 y 13).
 * Agrupan el catálogo tal y como está organizada la carta impresa; se
 * superponen a las categorías sin sustituirlas.
 */
export const seccionIds = [
  "tartas-obrador",
  "cremosas",
  "dulce-para-todos",
  "planchas",
  "bocados",
  "coleccion-especial",
  "bizcochos",
  "brazos",
  "detalles-celebracion",
  "las-lorenzas",
  "empanadas",
  "supremas",
  "salado-para-todos",
  "quiches",
  "tartas-saladas",
  "para-compartir",
  "las-lorenzas-salado",
  "por-encargo",
] as const;

export type SeccionId = (typeof seccionIds)[number];

export type Seccion = {
  id: SeccionId;
  /** Título de la sección en la carta. */
  label: string;
  /** Antetítulo de la carta: «DULCE · TARTAS». */
  eyebrow: string;
  /** Nota de raciones y tamaños que acompaña a la sección. */
  nota?: string;
  order: number;
};

export const secciones: readonly Seccion[] = [
  {
    id: "tartas-obrador",
    label: "Las Tartas del Obrador",
    eyebrow: "Dulce · Tartas",
    nota: "Tartas tradicionales de bizcocho · Grande 15–20 rac. · Mediana 10–12 · Pequeña 6–8",
    order: 100,
  },
  {
    id: "cremosas",
    label: "Mousses y Tartas Dulces",
    eyebrow: "Dulce · Cremosas",
    nota: "8–10 raciones",
    order: 200,
  },
  {
    id: "dulce-para-todos",
    label: "Dulce para todos",
    eyebrow: "Dulce · Sin alérgenos",
    order: 300,
  },
  {
    id: "planchas",
    label: "Las Planchas de la Casa",
    eyebrow: "Dulce · Planchas",
    nota: "Planchas «San Lorenzo» · Grande 24–30 rac. · Pequeña 12–15 · Supl. por corte",
    order: 400,
  },
  {
    id: "bocados",
    label: "Bocados del Obrador",
    eyebrow: "Dulce · Por peso",
    nota: "Se venden por peso: 1 kg o ½ kg",
    order: 500,
  },
  {
    id: "coleccion-especial",
    label: "La Colección Especial",
    eyebrow: "Dulce · Planchas",
    nota: "Planchas especiales · Grande 24–30 rac. · Pequeña 12–15 · Supl. por corte",
    order: 600,
  },
  {
    id: "bizcochos",
    label: "Bizcochos y bollería de mantequilla",
    eyebrow: "Dulce · Bizcochos",
    order: 700,
  },
  {
    id: "brazos",
    label: "Brazos y Detalles",
    eyebrow: "Dulce · Brazos",
    nota: "Brazos 8–10 rac. / Mini 4–6 rac.",
    order: 800,
  },
  {
    id: "detalles-celebracion",
    label: "Detalles de celebración",
    eyebrow: "Dulce · Celebración",
    order: 900,
  },
  {
    id: "las-lorenzas",
    label: "Las Lorenzas · Mini Croissants Dulces",
    eyebrow: "Dulce · Las Lorenzas",
    nota: "De mantequilla · unidades de 6, 12 y 24",
    order: 1000,
  },
  {
    id: "empanadas",
    label: "Empanadas de hojaldre",
    eyebrow: "Salado · Hojaldre",
    nota: "Entera 16–20 rac. · Media 8–10 · Supl. por corte",
    order: 1100,
  },
  {
    id: "supremas",
    label: "Supremas de hojaldre",
    eyebrow: "Salado · Hojaldre",
    nota: "8–10 raciones",
    order: 1200,
  },
  {
    id: "salado-para-todos",
    label: "Salado para todos",
    eyebrow: "Salado · Sin alérgenos",
    order: 1300,
  },
  {
    id: "quiches",
    label: "Quiches artesanas",
    eyebrow: "Salado · Horno",
    nota: "8–10 raciones",
    order: 1400,
  },
  {
    id: "tartas-saladas",
    label: "Tartas saladas",
    eyebrow: "Salado · Horno",
    nota: "8–10 raciones",
    order: 1500,
  },
  {
    id: "para-compartir",
    label: "Para compartir",
    eyebrow: "Salado · Cóctel",
    order: 1600,
  },
  {
    id: "las-lorenzas-salado",
    label: "Las Lorenzas · Mini Croissants Salados",
    eyebrow: "Salado · Las Lorenzas",
    nota: "Pedido con un día de antelación · unidades de 6, 12 y 24",
    order: 1700,
  },
  {
    id: "por-encargo",
    label: "Por encargo",
    eyebrow: "Salado · Las Lorenzas",
    nota: "Precio a consultar con el obrador",
    order: 1800,
  },
] as const;

export const seccionById = (id: SeccionId): Seccion =>
  secciones.find((s) => s.id === id)!;

export const isSeccionId = (value: string | null): value is SeccionId =>
  value !== null && (seccionIds as readonly string[]).includes(value);
