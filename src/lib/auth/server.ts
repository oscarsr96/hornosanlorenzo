import { betterAuth } from "better-auth";
import { pool } from "~/lib/db/pool";
import { preparaAltaUsuario } from "~/lib/auth/alta";
import { enviarCorreo } from "~/lib/email/enviar";

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
    // Ese enlace ES la contraseña mientras dura: quien lo tenga entra sin
    // más. Por eso solo se enseña por consola en desarrollo (para poder
    // probar sin tener Resend configurado en local) y, si el envío falla
    // en producción, el registro dice a quién no le ha llegado pero
    // JAMÁS el enlace ni el token — eso sería dejar tirada en los logs del
    // servidor la llave de cualquier cuenta.
    sendResetPassword: async ({ user, url }) => {
      const resultado = await enviarCorreo({
        para: user.email,
        asunto: "Cambiar tu contraseña — Horno San Lorenzo",
        texto: [
          `Hola${user.name ? `, ${user.name}` : ""}:`,
          "",
          "Has pedido cambiar la contraseña de tu cuenta. Abre este enlace:",
          url,
          "",
          "El enlace caduca en una hora y solo sirve una vez.",
          "Si no has sido tú, no hace falta que hagas nada.",
        ].join("\n"),
      });

      if (!resultado.ok) {
        if (import.meta.env.DEV) {
          console.warn(
            `[reset-password] correo no configurado: enlace para ${user.email}: ${url}`,
          );
        } else {
          console.error(
            `[reset-password] no se pudo enviar el correo de recuperación a ${user.email}`,
          );
        }
      }
    },
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
  // Ver `~/lib/auth/alta`: repite en el servidor la validación de teléfono
  // y nombre que en el navegador hace `validaRegistro`, para quien llame a
  // `/sign-up/email` sin pasar por el formulario.
  databaseHooks: {
    user: {
      create: {
        before: (user) => preparaAltaUsuario(user),
      },
    },
  },
});
