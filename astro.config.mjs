import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

const SITE =
  process.env.PUBLIC_SITE_URL ?? "https://hornosanlorenzo-demo.vercel.app";

export default defineConfig({
  site: SITE,
  // Estático por defecto: solo las rutas de /api se sirven bajo demanda
  // (`export const prerender = false`), porque un cobro nunca puede calcularse
  // en el navegador.
  output: "static",
  // Las páginas que leen de la base de datos van con `prerender = false`:
  // el ISR las cachea igual que si fueran estáticas y el panel las
  // invalida al guardar (`src/lib/cache.ts`).
  adapter: vercel({
    isr: {
      // El mismo valor tiene que estar en el entorno de CONSTRUCCIÓN y en el
      // de ejecución en Vercel: aquí se lee al construir, y `src/lib/cache.ts`
      // al invalidar. Si no coinciden, la invalidación se ignora en silencio.
      bypassToken: process.env.VERCEL_BYPASS_TOKEN,
      // Ninguna página con sesión puede entrar en una caché compartida: lo
      // que se guardara ahí se le serviría a la siguiente persona. Esta lista
      // es una medida de seguridad, no de rendimiento.
      //
      // El adaptador decide si una ruta va a ISR comparando el patrón de
      // texto con el `route.pattern` de Astro por IGUALDAD EXACTA, no como
      // prefijo. `/admin` y `/api` no son un único fichero dinámico: son
      // ficheros sueltos (`pedidos.astro`, `clientes.astro`, `checkout.ts`,
      // y los que se añadan), así que un patrón de texto por ruta se queda
      // corto en cuanto se añade una página nueva. Con una expresión
      // regular, en cambio, esa misma comparación se hace con `.test()`, así
      // que cubre el árbol entero sin depender de listar cada fichero.
      // (El patrón de texto con corchetes, tal y como lo compila este
      // adaptador, también deja cada ruta afectada fuera del caché en la
      // build actual, pero solo porque la regla genérica que genera para el
      // `exclude` queda antes en `config.json` que la entrada de ISR
      // redundante y sin usar que deja para esa misma ruta: depende del
      // ORDEN de las reglas, no de que la comparación en sí case. La
      // expresión regular no deja esa entrada muerta ni esa dependencia:
      // ver la comparación de ambos `config.json` en `task-8-report.md`.
      exclude: [
        "/admin",
        /^\/admin\//,
        "/cuenta",
        "/carrito",
        "/acceso",
        /^\/acceso\//,
        /^\/api\//,
      ],
    },
  }),
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
