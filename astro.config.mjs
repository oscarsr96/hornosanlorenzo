import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

const SITE =
  process.env.PUBLIC_SITE_URL ?? "https://hornosanlorenzo-demo.vercel.app";

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "never",
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
