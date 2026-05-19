export type StoreId = "alcobendas" | "pozuelo";

export type Store = {
  id: StoreId;
  name: string;
  shortName: string;
  address: string;
  city: string;
  postal: string;
  phone: string;
  phoneDisplay: string;
  email: string;
  hoursText: string;
  openDays: number[]; // 0=Sun ... 6=Sat
  mapsEmbed: string;
  mapsLink: string;
  coords: { lat: number; lng: number };
  image: string;
  imageAlt: string;
};

export const stores: readonly Store[] = [
  {
    id: "alcobendas",
    name: "Horno San Lorenzo — Central",
    shortName: "Alcobendas",
    address: "C/ Valgrande 21, Nave 2-k",
    city: "Alcobendas",
    postal: "28108",
    phone: "+34916613932",
    phoneDisplay: "916 613 932",
    email: "info@hornosanlorenzo.com",
    hoursText: "Lun–Sáb 7:00–14:00 · Domingos cerrado",
    openDays: [1, 2, 3, 4, 5, 6],
    mapsEmbed:
      "https://www.google.com/maps?q=C%2FValgrande+21+Alcobendas&output=embed",
    mapsLink: "https://www.google.com/maps?q=C%2FValgrande+21+Alcobendas",
    coords: { lat: 40.5468, lng: -3.6394 },
    image: "/images/tiendas/alcobendas.jpg",
    imageAlt: "Fachada del obrador central en Alcobendas",
  },
  {
    id: "pozuelo",
    name: "Tienda Pozuelo",
    shortName: "Pozuelo",
    address: "Avda. Europa 28, entrada por C/ América",
    city: "Pozuelo de Alarcón",
    postal: "28223",
    phone: "+34916059056",
    phoneDisplay: "91 605 90 56",
    email: "pasteleriapozuelo@hornosanlorenzo.com",
    hoursText: "Lun–Dom 8:00–14:30 y 17:00–20:30",
    openDays: [0, 1, 2, 3, 4, 5, 6],
    mapsEmbed:
      "https://www.google.com/maps?q=Avenida+Europa+28+Pozuelo+de+Alarcon&output=embed",
    mapsLink:
      "https://www.google.com/maps?q=Avenida+Europa+28+Pozuelo+de+Alarcon",
    coords: { lat: 40.4378, lng: -3.809 },
    image: "/images/tiendas/pozuelo.jpg",
    imageAlt: "Tienda de Pozuelo, escaparate con bollería y pan",
  },
] as const;

export const storeById = (id: StoreId): Store =>
  stores.find((s) => s.id === id)!;
