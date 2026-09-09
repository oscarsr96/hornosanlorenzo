import { useState } from "react";
import { authClient } from "~/lib/auth/cliente";
import { validaRecuperar } from "~/lib/auth/validacion";

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

// La respuesta es siempre esta, exista o no la cuenta: decir que un correo
// no está dado de alta convertiría esta pantalla en una forma cómoda de
// averiguar quién es cliente de la tienda.
const MENSAJE_ENVIADO =
  "Si ese correo tiene cuenta, te hemos enviado un enlace para cambiar la contraseña.";

const MENSAJE_GENERICO = "Algo ha fallado. Inténtalo de nuevo.";

export default function RecuperarForm() {
  const [email, setEmail] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    setErrorServidor(null);

    const resultado = validaRecuperar({ email });
    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }
    setErrores({});
    setEnviando(true);

    try {
      // El propio servidor ya responde igual exista o no la cuenta (mira
      // `requestPasswordReset` en Better Auth); aun así el mensaje que
      // enseña esta pantalla no depende de la respuesta, para no acabar
      // filtrando esa diferencia si algún día cambia.
      await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/acceso/nueva-contrasena",
      });
      setEnviado(true);
    } catch {
      setErrorServidor(MENSAJE_GENERICO);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <p role="status" style={{ maxWidth: "28rem", fontSize: 14 }}>
        {MENSAJE_ENVIADO}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ maxWidth: "28rem" }}>
      <div>
        <label style={label} htmlFor="rf-email">
          Correo
        </label>
        <input
          id="rf-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errores.email}
          aria-describedby={errores.email ? "rf-email-error" : undefined}
          placeholder="tu@correo.com"
          style={{
            ...field,
            borderColor: errores.email
              ? "var(--color-teja)"
              : "var(--color-avellana)",
          }}
        />
        {errores.email && (
          <p id="rf-email-error" role="alert" style={errorTexto}>
            {errores.email}
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
        {enviando ? "Enviando…" : "Enviar enlace"}
      </button>

      <p style={{ marginTop: 12, fontSize: 13, textAlign: "center" }}>
        <a
          href="/acceso"
          style={{
            color: "var(--color-ink-muted)",
            textDecoration: "underline",
          }}
        >
          Volver a entrar
        </a>
      </p>
    </form>
  );
}
