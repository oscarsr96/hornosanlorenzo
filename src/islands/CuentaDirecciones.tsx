import { useState } from "react";
import { admiteCP, municipioDeCP, ZONA_REPARTO_COPY } from "~/lib/entrega";

export type DireccionGuardada = {
  id: string;
  alias: string;
  calle: string;
  postalCode: string;
  predeterminada: boolean;
};

type Props = {
  direccionesIniciales: DireccionGuardada[];
};

// Mismos tokens y patrón de campo/error que `CuentaDatos.tsx` y
// `AccesoForm.tsx`: nada nuevo aquí, solo se reutiliza lo que ya fija la
// rama para campos, errores en teja y botones.
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

type Errores = { alias?: string; calle?: string; postalCode?: string };

function valida(alias: string, calle: string, postalCode: string): Errores {
  const errores: Errores = {};
  if (!alias.trim()) errores.alias = "Dale un nombre a la dirección.";
  if (calle.trim().length < 6) errores.calle = "Escribe la calle y el número.";
  if (!admiteCP(postalCode)) {
    errores.postalCode = `No repartimos en el ${postalCode || "código postal indicado"}. ${ZONA_REPARTO_COPY}`;
  }
  return errores;
}

async function llamar(
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; direccion?: DireccionGuardada }> {
  try {
    const respuesta = await fetch("/api/cuenta/direcciones", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      return { ok: false, error: cuerpo?.error ?? MENSAJE_GENERICO };
    }
    return { ok: true, direccion: cuerpo?.direccion };
  } catch {
    return {
      ok: false,
      error: "No hemos podido conectar. Comprueba tu conexión.",
    };
  }
}

export default function CuentaDirecciones({ direccionesIniciales }: Props) {
  const [direcciones, setDirecciones] = useState(direccionesIniciales);
  const [alias, setAlias] = useState("");
  const [calle, setCalle] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const cpCompleto = postalCode.length === 5;
  const cpValido = admiteCP(postalCode);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;

    setErrorServidor(null);

    const erroresValidacion = valida(alias, calle, postalCode);
    if (Object.keys(erroresValidacion).length) {
      setErrores(erroresValidacion);
      return;
    }
    setErrores({});
    setGuardando(true);

    const resultado = await llamar("POST", {
      alias: alias.trim(),
      calle: calle.trim(),
      postalCode,
      predeterminada: direcciones.length === 0,
    });

    setGuardando(false);
    if (!resultado.ok || !resultado.direccion) {
      setErrorServidor(resultado.error ?? MENSAJE_GENERICO);
      return;
    }

    setDirecciones((actuales) =>
      resultado.direccion!.predeterminada
        ? [
            resultado.direccion!,
            ...actuales.map((d) => ({ ...d, predeterminada: false })),
          ]
        : [...actuales, resultado.direccion!],
    );
    setAlias("");
    setCalle("");
    setPostalCode("");
  }

  async function onMarcarPredeterminada(id: string) {
    if (ocupada) return;
    setErrorServidor(null);
    setOcupada(id);

    const resultado = await llamar("PATCH", { id });

    setOcupada(null);
    if (!resultado.ok) {
      setErrorServidor(resultado.error ?? MENSAJE_GENERICO);
      return;
    }

    setDirecciones((actuales) =>
      actuales.map((d) => ({ ...d, predeterminada: d.id === id })),
    );
  }

  async function onBorrar(id: string) {
    if (ocupada) return;
    if (!window.confirm("¿Borrar esta dirección?")) return;

    setErrorServidor(null);
    setOcupada(id);

    const resultado = await llamar("DELETE", { id });

    setOcupada(null);
    if (!resultado.ok) {
      setErrorServidor(resultado.error ?? MENSAJE_GENERICO);
      return;
    }

    setDirecciones((actuales) => actuales.filter((d) => d.id !== id));
  }

  return (
    <div style={{ maxWidth: "28rem" }}>
      {direcciones.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {direcciones.map((d) => (
            <li
              key={d.id}
              style={{
                border: "1px solid var(--color-avellana)",
                padding: "0.75rem 1rem",
                marginTop: 12,
              }}
            >
              <p style={{ fontWeight: 600 }}>
                {d.alias}
                {d.predeterminada && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "var(--color-ink-muted)",
                    }}
                  >
                    Predeterminada
                  </span>
                )}
              </p>
              <p
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "var(--color-ink-muted)",
                }}
              >
                {d.calle} · {d.postalCode}
              </p>
              <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
                {!d.predeterminada && (
                  <button
                    type="button"
                    onClick={() => onMarcarPredeterminada(d.id)}
                    disabled={ocupada === d.id}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: 13,
                      textDecoration: "underline",
                      cursor: ocupada === d.id ? "not-allowed" : "pointer",
                      opacity: ocupada === d.id ? 0.6 : 1,
                    }}
                  >
                    Marcar predeterminada
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onBorrar(d.id)}
                  disabled={ocupada === d.id}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 13,
                    textDecoration: "underline",
                    color: "var(--color-teja)",
                    cursor: ocupada === d.id ? "not-allowed" : "pointer",
                    opacity: ocupada === d.id ? 0.6 : 1,
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} noValidate style={{ marginTop: 20 }}>
        <div>
          <label style={label} htmlFor="cdir-alias">
            Nombre de la dirección
          </label>
          <input
            id="cdir-alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Casa, oficina…"
            aria-invalid={!!errores.alias}
            aria-describedby={errores.alias ? "cdir-alias-error" : undefined}
            style={{
              ...field,
              borderColor: errores.alias
                ? "var(--color-teja)"
                : "var(--color-avellana)",
            }}
          />
          {errores.alias && (
            <p id="cdir-alias-error" role="alert" style={errorTexto}>
              {errores.alias}
            </p>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={label} htmlFor="cdir-calle">
            Calle y número
          </label>
          <input
            id="cdir-calle"
            value={calle}
            onChange={(e) => setCalle(e.target.value)}
            placeholder="Calle de Alcalá 100"
            aria-invalid={!!errores.calle}
            aria-describedby={errores.calle ? "cdir-calle-error" : undefined}
            style={{
              ...field,
              borderColor: errores.calle
                ? "var(--color-teja)"
                : "var(--color-avellana)",
            }}
          />
          {errores.calle && (
            <p id="cdir-calle-error" role="alert" style={errorTexto}>
              {errores.calle}
            </p>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={label} htmlFor="cdir-cp">
            Código postal
          </label>
          <input
            id="cdir-cp"
            inputMode="numeric"
            maxLength={5}
            value={postalCode}
            onChange={(e) =>
              setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
            placeholder="28001"
            aria-invalid={cpCompleto && !cpValido}
            aria-describedby="cdir-cp-aviso"
            style={{
              ...field,
              borderColor:
                cpCompleto && !cpValido
                  ? "var(--color-teja)"
                  : "var(--color-avellana)",
            }}
          />
          <p
            id="cdir-cp-aviso"
            role={errores.postalCode ? "alert" : undefined}
            style={{
              marginTop: 8,
              fontSize: 12,
              color:
                cpCompleto && !cpValido
                  ? "var(--color-teja)"
                  : "var(--color-ink-muted)",
            }}
          >
            {cpCompleto && !cpValido
              ? `No repartimos en el ${postalCode}. ${ZONA_REPARTO_COPY}`
              : cpValido
                ? `Repartimos en ${municipioDeCP(postalCode)}.`
                : ZONA_REPARTO_COPY}
          </p>
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
          disabled={guardando}
          style={{
            marginTop: 20,
            border: "none",
            opacity: guardando ? 0.6 : 1,
            cursor: guardando ? "not-allowed" : "pointer",
          }}
        >
          {guardando ? "Añadiendo…" : "Añadir dirección"}
        </button>
      </form>
    </div>
  );
}
