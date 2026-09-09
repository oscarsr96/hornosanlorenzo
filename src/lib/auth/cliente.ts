import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "~/lib/auth/server";

// `inferAdditionalFields<typeof auth>()` es solo tipos: el cliente conoce así
// el campo `telefono` del registro sin duplicar su definición ni tirar del
// servidor (el pool de Postgres) al bundle del navegador.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
