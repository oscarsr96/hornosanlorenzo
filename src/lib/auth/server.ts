import { betterAuth } from "better-auth";
import { pool } from "~/lib/db/pool";

/**
 * Autenticación sobre nuestras propias tablas de Postgres, no sobre el
 * servicio del proveedor: es lo que permite mudarse sin reemitir contraseñas.
 *
 * `rol` va con `input: false` a propósito. Sin eso, cualquiera podría
 * registrarse pidiendo `rol: "admin"` en el cuerpo de la petición.
 */
export const auth = betterAuth({
  database: pool,
  secret: import.meta.env.BETTER_AUTH_SECRET,
  baseURL: import.meta.env.PUBLIC_SITE_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Sin esto, `/acceso` aguanta miles de intentos por minuto contra una
  // contraseña. El spec lo pide explícitamente. `/sign-in` y `/sign-up`
  // tienen además una regla especial más estricta (10 s / 3 intentos) que
  // trae Better Auth por defecto y que esta configuración no sustituye.
  //
  // `storage: "database"` es obligatorio en Vercel: cada petición puede caer
  // en una instancia distinta (o una instancia fría sin memoria previa), así
  // que el contador en memoria no sirve para nada ahí. Guardarlo en Postgres
  // hace que el límite sea el mismo cuente quien cuente.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    storage: "database",
  },
  user: {
    additionalFields: {
      telefono: { type: "string", required: false },
      rol: {
        type: "string",
        required: false,
        defaultValue: "cliente",
        input: false,
      },
    },
  },
});
