export const tradicion = {
  intro:
    "Horno San Lorenzo es un obrador artesano fundado en 1986 en Alcobendas. Cada día, en horno propio y con método tradicional, hacemos comida casera de verdad —tartas y empanadas, nuestra especialidad— con ingredientes de siempre.",
  intro2:
    "No es una pastelería de diseño: es el horno de barrio que sabe lo que hace desde siempre. Cuatro décadas creciendo sin publicidad, gracias a la confianza de quien vuelve: personas que repiten, familias que recomiendan, hostelería que renueva y empresas que buscan una solución fiable, sencilla y de calidad.",

  /** Brand promise. */
  promesa: "Lo que sale hoy del obrador sabe igual que hace cuarenta años.",
  promesaBody:
    "Misma receta, mismo método y mismo precio justo, cada día, para la mesa de casa y la mesa de la empresa.",

  cifras: [
    { figure: "40", label: "años de trayectoria", body: "Fundado en 1986: mismo oficio, mismas recetas de base." },
    { figure: "2", label: "obradores en Madrid", body: "Alcobendas (sede) y Pozuelo de Alarcón, con horno propio." },
    { figure: "3", label: "canales de negocio", body: "Empresas y oficinas, hostelería y particulares." },
    { figure: "L–S", label: "reparto propio", body: "Entrega diaria con furgoneta y repartidor de la casa." },
  ],

  /** Los cinco valores del sistema de marca. Cada uno se cumple en algo concreto. */
  valores: [
    {
      number: "01",
      title: "Oficio",
      body: "El producto se hace en obrador propio. Nada se externaliza y nada se descongela para vender como recién hecho.",
    },
    {
      number: "02",
      title: "Constancia",
      body: "La tarta de hoy sabe igual que la de hace veinte años. La receta no cambia por moda ni por coste.",
    },
    {
      number: "03",
      title: "Honestidad",
      body: "Se dice lo que lleva, lo que cuesta y cuándo estará. Sin letra pequeña y sin promesas de salud.",
    },
    {
      number: "04",
      title: "Cercanía",
      body: "Reparto propio de lunes a sábado. Al cliente se le conoce por su nombre, no por su número de pedido.",
    },
    {
      number: "05",
      title: "Generosidad",
      body: "Raciones honestas y precio justo. La accesibilidad forma parte de la calidad, no la contradice.",
    },
  ],

  /** Las tres pruebas que sostienen la propuesta. */
  pruebas: [
    "40 años creciendo solo por recomendación, sin pagar publicidad.",
    "Reparto propio de lunes a sábado, con furgoneta y repartidor de la casa.",
    "El mismo producto para la mesa de casa y la de la empresa.",
  ],

  especialidad: {
    title: "La especialidad de la casa",
    body: "Tartas y empanadas: lo que se pone en el centro de la mesa, se corta y se comparte.",
  },

  certifications: [
    "Elaboración íntegra en obrador propio, sin externalizar",
    "Inscritos en el registro sanitario de Madrid desde 1986",
  ],
} as const;
