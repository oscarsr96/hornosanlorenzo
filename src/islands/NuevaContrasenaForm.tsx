import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth/cliente";
import { MIN_PASSWORD, validaNuevaContrasena } from "~/lib/auth/validacion";

// Mismos tokens y patrón de campo/error que `AccesoForm.tsx`.
const label: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: "var(--color-ink-muted)",
  fontWeight: 500,
};

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.75rem 1rem",
  border: "1px solid var(--color-avellana)",
  borderRadius: 0,
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--color-leche)",
  marginTop: 8,
};

const errorTexto: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "var(--color-teja)",
};

const MENSAJE_GENERICO = "Algo ha fallado. Inténtalo de nuevo.";

const MENSAJE_ENLACE_ROTO =
  "Este enlace no es válido. Pide uno nuevo desde «¿Has olvidado tu contraseña?».";

/**
 * Lista cerrada, igual que en `AccesoForm.tsx`: el texto de Better Auth
 * viene en inglés y cualquier código que no esté aquí cae en el mensaje
 * genérico. `INVALID_TOKEN` cubre tanto un enlace caducado como uno ya
 * usado (Better Auth no distingue los dos casos con códigos distintos).
 */
const MENSAJES_ERROR: Record<string, string> = {
  INVALID_TOKEN:
    "Este enlace ha caducado o ya se ha usado. Pide uno nuevo desde «¿Has olvidado tu contraseña?».",
  PASSWORD_TOO_SHORT: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`,
  PASSWORD_TOO_LONG: "Esa contraseña es demasiado larga.",
};

function mensajeDeError(error: { code?: string } | null): string {
  if (!error?.code) return MENSAJE_GENERICO;
  return MENSAJES_ERROR[error.code] ?? MENSAJE_GENERICO;
}

export default function NuevaContrasenaForm() {
  // El sitio es estático y esta página no se prerrenderiza con el token: se
  // lee del `location.search` en cliente, después del primer render, para
  // que ni pase por el servidor de renderizado ni acabe en ningún log.
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
    setListo(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !token) return;

    setErrorServidor(null);

    const resultado = validaNuevaContrasena({ password, confirmar });
    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }
    setErrores({});
    setEnviando(true);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        setErrorServidor(mensajeDeError(error));
        setEnviando(false);
        return;
      }
      window.location.href = "/acceso?recuperada=1";
    } catch {
      setErrorServidor("No hemos podido conectar. Comprueba tu conexión.");
      setEnviando(false);
    }
  }

  // Antes de leer `location.search` no sabemos aún si hay token: no
  // enseñamos el aviso de enlace roto de más.
  if (!listo) return null;

  if (!token) {
    return (
      <p
        role="alert"
        style={{ maxWidth: "28rem", fontSize: 14, color: "var(--color-teja)" }}
      >
        {MENSAJE_ENLACE_ROTO}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ maxWidth: "28rem" }}>
      <div>
        <label style={label} htmlFor="nc-password">
          Contraseña nueva
        </label>
        <input
          id="nc-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errores.password}
          aria-describedby={errores.password ? "nc-password-error" : undefined}
          placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
          style={{
            ...field,
            borderColor: errores.password
              ? "var(--color-teja)"
              : "var(--color-avellana)",
          }}
        />
        {errores.password && (
          <p id="nc-password-error" role="alert" style={errorTexto}>
            {errores.password}
          </p>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={label} htmlFor="nc-confirmar">
          Repite la contraseña
        </label>
        <input
          id="nc-confirmar"
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          aria-invalid={!!errores.confirmar}
          aria-describedby={
            errores.confirmar ? "nc-confirmar-error" : undefined
          }
          placeholder="Otra vez"
          style={{
            ...field,
            borderColor: errores.confirmar
              ? "var(--color-teja)"
              : "var(--color-avellana)",
          }}
        />
        {errores.confirmar && (
          <p id="nc-confirmar-error" role="alert" style={errorTexto}>
            {errores.confirmar}
          </p>
        )}
      </div>

      {errorServidor && (
        <p
          role="alert"
          style={{
            marginTop: 16,
            padding: "0.75rem 1rem",
            border: "1px solid var(--color-teja)",
            color: "var(--color-teja)",
            fontSize: 13,
          }}
        >
          {errorServidor}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primario"
        disabled={enviando}
        style={{
          width: "100%",
          marginTop: 20,
          border: "none",
          opacity: enviando ? 0.6 : 1,
          cursor: enviando ? "not-allowed" : "pointer",
        }}
      >
        {enviando ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
