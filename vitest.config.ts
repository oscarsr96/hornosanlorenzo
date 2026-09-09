import { defineConfig } from "vitest/config";
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

export default defineConfig({
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
