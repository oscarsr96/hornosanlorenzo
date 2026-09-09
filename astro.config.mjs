import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel/serverless";

const SITE =
  process.env.PUBLIC_SITE_URL ?? "https://hornosanlorenzo-demo.vercel.app";

export default defineConfig({
  site: SITE,
  // Estático por defecto: solo las rutas de /api se sirven bajo demanda
  // (`export const prerender = false`), porque un cobro nunca puede calcularse
  // en el navegador.
  output: "static",
  adapter: vercel(),
  trailingSlash: "never",
  // «Hostelería y Empresas» pasó a ser «A quién servimos»: la URL vieja puede
  // estar compartida por ahí fuera, así que se redirige en vez de romperse.
  redirects: {
    "/hosteleria-y-empresas": "/a-quien-servimos",
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: "auto",
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
});
