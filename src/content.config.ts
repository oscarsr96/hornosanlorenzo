import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { categoryIds } from "~/data/categories";
import { seccionIds } from "~/data/secciones";

const allergens = z.enum([
  "gluten",
  "huevo",
  "leche",
  "frutos-secos",
  "soja",
  "sesamo",
  "sulfitos",
]);

const variant = z.object({
  id: z.string(),
  label: z.string(),
  priceCents: z.number().int().positive(),
});

export const products = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/products" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      category: z.enum(categoryIds),
      /** Sección de la carta impresa. Agrupa la página de Dulce. */
      seccion: z.enum(seccionIds).optional(),
      priceCents: z.number().int().positive(),
      unit: z.string().optional(),
      variants: z.array(variant).optional(),
      /** Pendiente para la carta de 2026: las fotos llegan más adelante. */
      image: image().optional(),
      imageAlt: z.string().optional(),
      shortDescription: z.string().max(180),
      allergens: z.array(allergens).default([]),
      featured: z.boolean().default(false),
      seasonal: z.boolean().default(false),
      order: z.number().int().default(100),
    }),
});

export const noticias = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/noticias" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      excerpt: z.string().max(240),
      image: image(),
      imageAlt: z.string(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

export const collections = { products, noticias };
