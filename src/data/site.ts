export const site = {
  name: "Horno San Lorenzo",
  short: "HSL",
  tagline: "Pan de pueblo, hecho a mano. Desde 1986.",
  founded: 1986,
  url: import.meta.env.PUBLIC_SITE_URL,
  whatsapp: import.meta.env.PUBLIC_WHATSAPP_NUMBER,
  social: {
    instagram: "https://instagram.com/hornosanlorenzo_1986",
    facebook: "https://facebook.com/hornosanlorenzo",
  },
  email: "info@hornosanlorenzo.com",
  ogImage: "/og-image.jpg",
  noteForDemo:
    "Demo en presentación — fotos representativas. Los productos, tiendas y datos de contacto son reales.",
} as const;

export type Site = typeof site;
