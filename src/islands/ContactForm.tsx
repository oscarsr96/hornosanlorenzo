import { useState } from "react";
import { site } from "~/data/site";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  const canSend =
    name.trim() &&
    email.includes("@") &&
    message.trim().length >= 10 &&
    accepted;

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSend) return;
    const body = `Nombre: ${name}\nEmail: ${email}\nTeléfono: ${phone}\n\n${message}`;
    const subject = `Consulta desde la web — ${name}`;
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "0.75rem 1rem",
    border: "1px solid var(--color-line)",
    borderRadius: 12,
    fontSize: 14,
    fontFamily: "inherit",
    marginTop: 6,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "var(--color-ink-muted)",
    fontWeight: 600,
  };

  return (
    <form onSubmit={send} style={{ display: "grid", gap: 16, maxWidth: 540 }}>
      <div>
        <label style={labelStyle} htmlFor="cn-name">
          Nombre *
        </label>
        <input
          id="cn-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="cn-email">
          Email *
        </label>
        <input
          id="cn-email"
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="cn-phone">
          Teléfono
        </label>
        <input
          id="cn-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="cn-msg">
          Mensaje *
        </label>
        <textarea
          id="cn-msg"
          required
          rows={5}
          minLength={10}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ ...inputStyle, borderRadius: 12 }}
        />
      </div>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: 13,
          color: "var(--color-ink-muted)",
        }}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          required
          style={{ marginTop: 4 }}
        />
        <span>
          He leído la{" "}
          <a href="/legal/privacidad" style={{ textDecoration: "underline" }}>
            política de privacidad
          </a>{" "}
          y acepto el tratamiento de mis datos para responder a mi consulta.
        </span>
      </label>
      <button
        type="submit"
        disabled={!canSend}
        style={{
          background: canSend ? "var(--color-ink)" : "var(--color-ink-muted)",
          color: "var(--color-cream)",
          border: "none",
          padding: "0.875rem 1.5rem",
          borderRadius: 9999,
          fontSize: 15,
          fontWeight: 700,
          cursor: canSend ? "pointer" : "not-allowed",
        }}
      >
        Enviar
      </button>
      <p
        style={{
          fontSize: 12,
          color: "var(--color-ink-muted)",
          fontStyle: "italic",
        }}
      >
        Al enviar se abrirá tu app de correo con el mensaje preparado. También
        puedes escribir directamente a {site.email}.
      </p>
    </form>
  );
}
