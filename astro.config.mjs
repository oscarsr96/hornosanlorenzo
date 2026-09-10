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
      // El adaptador decide si una ruta va a ISR comparando cada entrada de
      // `exclude` con el `route.pattern` de Astro: si es string, por
      // IGUALDAD EXACTA; si es RegExp, con `.test()`. Un string solo protege
      // ESA ruta exacta, nunca sus hijas. `/admin`, `/cuenta`, `/carrito` y
      // `/api` no son un único fichero dinámico: son ficheros sueltos
      // (`pedidos.astro`, `clientes.astro`, `checkout.ts`, y los que se
      // añadan), así que un string por ruta se queda corto en cuanto se
      // añade una página nueva bajo ese árbol y la deja cacheada sin avisar.
      // Por eso las cinco raíces con sesión van con string (la raíz exacta)
      // + regex (`/^\/raíz\//`, el árbol entero) — no solo las que ya tienen
      // hijas hoy, sino todas, porque la próxima página que se añada bajo
      // cualquiera de ellas no debe depender de acordarse de tocar esta
      // lista.
      //
      // Probé primero el patrón con corchetes que usa Astro para rutas
      // dinámicas (p. ej. `"/admin/[...ruta]"`) pensando que el adaptador lo
      // interpretaría como "todo el árbol". Con un build real
      // (`task-8-report.md`) vi que sí genera una regla de enrutado que
      // cubre el árbol, pero la comparación de arriba (la que decide si esa
      // ruta entra en el mapeo a ISR) sigue siendo por igualdad exacta y ese
      // string nunca es igual a `route.pattern` de una página real, así que
      // cada hija se colaba igualmente en el mapeo a ISR. Que esas páginas
      // no acabaran sirviéndose desde ahí era solo porque la regla de
      // enrutado quedaba antes en `config.json` que esa entrada de ISR
      // sobrante: un accidente del ORDEN en que el adaptador genera las
      // reglas, no una garantía del patrón. De ahí la regex: hace que la
      // comparación misma excluya la ruta, sin entradas muertas ni depender
      // de ese orden.
      exclude: [
        "/admin",
        /^\/admin\//,
        "/cuenta",
        /^\/cuenta\//,
        "/carrito",
        /^\/carrito\//,
        "/acceso",
        /^\/acceso\//,
        /^\/api\//,
      ],
    },
  }),
  // Las fotos del panel viven en Vercel Blob: sin esto, `<Image>` no las
  // optimiza (y ni siquiera las sirve, según el caso).
  image: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
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
