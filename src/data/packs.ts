/**
 * Gamas de packs del brief de front end (COPY 1 y COPY 2 del menú de producto).
 * Las referencias concretas, con precio y foto, llegan con la carta de precios.
 */
export type PackRange = {
  id: string;
  title: string;
  claim: string;
  body: string;
};

export const packsSalado: readonly PackRange[] = [
  {
    id: "cajitas-salado",
    title: "Nuestras cajitas para cada ocasión",
    claim: "El aperitivo deja de improvisarse.",
    body: "Selecciones listas para llevar a la mesa y compartir.",
  },
  {
    id: "empanadas",
    title: "Empanadas y supremas de hojaldre",
    claim: "El hojaldre que cruje como debe.",
    body: "Masa laminada con mantequilla y rellenos generosos elaborados en nuestro obrador. Ese crujido inconfundible solo lo consigue el tiempo y el oficio.",
  },
  {
    id: "quiches",
    title: "Quiches",
    claim: "Una comida completa en cada porción.",
    body: "Base fina, relleno cremoso y un horneado en su punto. Perfectas para disfrutar solas o como protagonistas de una mesa compartida.",
  },
  {
    id: "tartas-saladas",
    title: "Tartas saladas",
    claim: "Cuando el aperitivo se convierte en el plato principal.",
    body: "Verduras, quesos y masas artesanas combinadas en recetas que alimentan tanto como sorprenden.",
  },
  {
    id: "bocados",
    title: "Bocados para compartir",
    claim: "Pequeños bocados, grandes momentos.",
    body: "Una selección variada pensada para disfrutar en el centro de la mesa, elaborada con las recetas que nos acompañan desde hace cuatro décadas.",
  },
  {
    id: "mini-croissants",
    title: "Mini croissants salados",
    claim: "Nuestro hojaldre, en versión bocado.",
    body: "Todo el sabor y la textura del croissant artesano llevado al aperitivo salado.",
  },
] as const;

export const packsDulce: readonly PackRange[] = [
  {
    id: "cajitas-dulce",
    title: "Nuestras cajitas para cada ocasión",
    claim: "Listas para llevar a cualquier mesa.",
    body: "Déjanos impresionar a tus invitados.",
  },
  {
    id: "tartas-bizcocho",
    title: "Las tartas de obrador de bizcocho",
    claim: "Bizcocho del que sabe a casa.",
    body: "Esponjoso, jugoso y hecho como toca. El clásico que nadie deja en el plato.",
  },
  {
    id: "mousses",
    title: "Mousses y tartas dulces",
    claim: "Cremoso por fuera, memorable por dentro.",
    body: "Texturas suaves y sabores que se quedan. Para terminar bien una comida o alegrar una tarde.",
  },
  {
    id: "planchas",
    title: "Las planchas de la casa",
    claim: "Para cuando sois muchos.",
    body: "El formato grande del obrador: se corta, se reparte y llega a todo el mundo.",
  },
] as const;
