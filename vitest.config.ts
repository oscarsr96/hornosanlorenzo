/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/**
 * `pnpm test` tiene que ejecutar de verdad las pruebas que necesitan
 * Postgres (`src/lib/db/direcciones.test.ts`) cuando hay una base de
 * pruebas configurada en `.env`, sin depender de cómo se invoque el
 * comando — nada de exportar variables a mano ni de `node --env-file`.
 *
 * Se lee `.env` aquí, una única vez al cargar la configuración, y se pasa a
 * `test.env`: es la opción de Vitest documentada para inyectar variables en
 * el `process.env` de cada worker de pruebas antes de arrancar.
 *
 * Si el fichero no existe —repositorio recién clonado, o un CI que inyecta
 * secretos por variable de entorno en vez de por `.env`— esto devuelve un
 * objeto vacío sin lanzar: las pruebas que necesiten `DATABASE_URL_TEST`
 * siguen saltándose solas (`describeSiHayBD`, en cada fichero que la usa) y
 * cualquier variable ya exportada en el proceso sigue llegando igual, porque
 * Vitest mezcla `process.env` con `test.env` sin borrar lo que ya hubiera.
 */
function envDelProyecto(): NodeJS.Dict<string> {
  try {
    const ruta = fileURLToPath(new URL("./.env", import.meta.url));
    return parseEnv(readFileSync(ruta, "utf8"));
  } catch {
    return {};
  }
}

/**
 * `defineConfig` a secas no arranca la integración de contenido de Astro:
 * cualquier fichero que importe `astro:content` (la config de colecciones,
 * los componentes de catálogo) revienta antes de empezar con «Cannot find
 * package "astro:content"». `getViteConfig`, en cambio, procesa
 * `astro.config.mjs` igual que el propio Astro y expone `astro:content` a
 * las pruebas. Sustituye a `defineConfig` como la exportación por defecto:
 * es la propia documentación de Astro la que lo pide para Vitest, no un
 * añadido nuestro.
 */
export default getViteConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: envDelProyecto(),
  },
});
