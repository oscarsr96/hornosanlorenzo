import { useEffect, useMemo, useRef, useState } from "react";
import { stores, type StoreId } from "~/data/stores";
import { formatPriceCents, formatDateISO } from "~/lib/format";
import {
  MODE_COPY,
  PICKUP_NEXT_DAY_THRESHOLD_CENTS,
  earliestDate,
  earliestSelectableDate,
  fromISO,
  isClosed,
  toISO,
  type DeliveryMode,
} from "~/lib/entrega";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  type OrderInfo,
} from "~/lib/whatsapp";
import type { Cart } from "~/lib/cart";

const PHONE = import.meta.env.PUBLIC_WHATSAPP_NUMBER;

type Step = "dia" | "opcion" | "direccion" | "tienda" | "resumen";

type Props = {
  cart: Cart;
  totalCents: number;
  onClose: () => void;
};

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/** Lunes de la semana en la que cae el día 1 del mes. */
function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

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

export default function CheckoutFlow({ cart, totalCents, onClose }: Props) {
  const [step, setStep] = useState<Step>("dia");
  const [history, setHistory] = useState<Step[]>([]);

  const [dateISO, setDateISO] = useState("");
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [address, setAddress] = useState("");
  const [storeId, setStoreId] = useState<StoreId>("alcobendas");
  const [slot, setSlot] = useState<OrderInfo["slot"]>("morning");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const minISO = useMemo(() => earliestSelectableDate(today), [today]);
  const [cursor, setCursor] = useState(() => {
    const d = fromISO(minISO);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const go = (next: Step) => {
    setHistory((h) => [...h, step]);
    setStep(next);
  };

  const back = () => {
    setNotice(null);
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) setStep(prev);
      return h.slice(0, -1);
    });
  };

  /** El día se elige antes que la modalidad, así que al elegir envío hay que validar. */
  function chooseMode(next: DeliveryMode) {
    const min = earliestDate(next, today);
    setMode(next);
    if (dateISO < min) {
      setDateISO(min);
      setNotice(
        `Para ${MODE_COPY[next].label.toLowerCase()} la fecha más próxima es el ${formatDateISO(min)}. Hemos ajustado tu pedido.`,
      );
    } else {
      setNotice(null);
    }
    go(next === "domicilio" ? "direccion" : "tienda");
  }

  const emailOk = /.+@.+\..+/.test(email.trim());
  const canPay = Boolean(mode && dateISO) && emailOk && !sending;

  /** Solo se mandan referencias y cantidades: el precio lo pone el servidor. */
  async function pay() {
    if (!mode || !dateISO || !emailOk || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({
            slug: i.slug,
            variantId: i.variantId,
            qty: i.qty,
          })),
          mode,
          dateISO,
          slot,
          storeId: mode === "recogida" ? storeId : undefined,
          address: mode === "domicilio" ? address.trim() : undefined,
          name: name.trim() || undefined,
          notes: notes.trim() || undefined,
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "No hemos podido abrir el pago.");
        setSending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("No hemos podido conectar. Comprueba tu conexión.");
      setSending(false);
    }
  }

  /** Vía alternativa: dejar el pedido escrito en WhatsApp sin pagar online. */
  function sendByWhatsApp() {
    if (!mode || !dateISO) return;
    const order: OrderInfo = {
      mode,
      dateISO,
      storeId: mode === "recogida" ? storeId : undefined,
      address: mode === "domicilio" ? address.trim() : undefined,
      slot,
      name: name.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    window.location.href = buildWhatsAppUrl(
      PHONE,
      buildWhatsAppMessage(cart, order),
    );
  }

  const TITLES: Record<Step, string> = {
    dia: "Selecciona qué día quieres el pedido",
    opcion: "Selecciona una opción",
    direccion: "Introduce tu dirección",
    tienda: "¿En qué tienda lo recoges?",
    resumen: "Revisa tu pedido",
  };

  const cells = monthGrid(cursor.year, cursor.month);
  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(cursor.year, cursor.month, 1));
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const canGoPrevMonth =
    new Date(cursor.year, cursor.month, 1) >
    new Date(fromISO(minISO).getFullYear(), fromISO(minISO).getMonth(), 1);

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(50, 40, 32, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[step]}
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--color-leche)",
          border: "1px solid var(--color-avellana)",
          outline: "none",
        }}
      >
        <header
          style={{
            background: "var(--color-moka)",
            color: "var(--color-leche)",
            padding: "1rem 1.25rem",
            fontFamily: "var(--font-display)",
            fontSize: 18,
            textAlign: "center",
          }}
        >
          {TITLES[step]}
        </header>

        <div style={{ padding: "1.25rem" }}>
          {notice && (
            <p
              style={{
                marginBottom: 16,
                padding: "0.75rem 1rem",
                border: "1px solid var(--color-avellana)",
                background: "var(--color-latte)",
                fontSize: 13,
                color: "var(--color-ink-muted)",
              }}
            >
              {notice}
            </p>
          )}

          {step === "dia" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCursor((c) =>
                      c.month === 0
                        ? { year: c.year - 1, month: 11 }
                        : { ...c, month: c.month - 1 },
                    )
                  }
                  disabled={!canGoPrevMonth}
                  aria-label="Mes anterior"
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid var(--color-avellana)",
                    background: "transparent",
                    cursor: canGoPrevMonth ? "pointer" : "not-allowed",
                    opacity: canGoPrevMonth ? 1 : 0.35,
                  }}
                >
                  ‹
                </button>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 17,
                  }}
                >
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCursor((c) =>
                      c.month === 11
                        ? { year: c.year + 1, month: 0 }
                        : { ...c, month: c.month + 1 },
                    )
                  }
                  aria-label="Mes siguiente"
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid var(--color-avellana)",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  ›
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 2,
                }}
              >
                {WEEKDAYS.map((w) => (
                  <span key={w} style={{ ...label, textAlign: "center", padding: "6px 0" }}>
                    {w}
                  </span>
                ))}
                {cells.map((date, i) => {
                  if (!date) return <span key={`empty-${i}`} />;
                  const iso = toISO(date);
                  const disabled = iso < minISO || isClosed(date);
                  const selected = iso === dateISO;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      onClick={() => setDateISO(iso)}
                      style={{
                        height: 40,
                        border: selected
                          ? "1px solid var(--color-caramelo)"
                          : "1px solid transparent",
                        background: selected
                          ? "var(--color-caramelo)"
                          : "transparent",
                        color: selected
                          ? "var(--color-leche)"
                          : disabled
                            ? "var(--color-avellana)"
                            : "var(--color-moka)",
                        cursor: disabled ? "not-allowed" : "pointer",
                        fontSize: 14,
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <p style={{ marginTop: 14, fontSize: 12, color: "var(--color-ink-muted)" }}>
                Obrador y reparto propio de lunes a sábado. Los domingos no hay servicio.
              </p>

              <button
                type="button"
                className="btn btn-primario"
                disabled={!dateISO}
                onClick={() => go("opcion")}
                style={{
                  width: "100%",
                  marginTop: 16,
                  opacity: dateISO ? 1 : 0.5,
                  cursor: dateISO ? "pointer" : "not-allowed",
                  border: "none",
                }}
              >
                Continuar
              </button>
            </>
          )}

          {step === "opcion" && (
            <div style={{ display: "grid", gap: 12 }}>
              {(["domicilio", "recogida"] as DeliveryMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => chooseMode(m)}
                  style={{
                    textAlign: "left",
                    padding: "1rem 1.25rem",
                    border: "1px solid var(--color-avellana)",
                    background: "var(--color-latte)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                    }}
                  >
                    {MODE_COPY[m].label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--color-ink-muted)",
                    }}
                  >
                    {MODE_COPY[m].body}
                  </span>
                </button>
              ))}
              <p style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
                Pedidos superiores a {formatPriceCents(PICKUP_NEXT_DAY_THRESHOLD_CENTS)} pueden
                pasar al día siguiente en recogida.
              </p>
            </div>
          )}

          {step === "direccion" && (
            <>
              <label style={label} htmlFor="cf-address">
                Dirección de entrega
              </label>
              <input
                id="cf-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Introduce la dirección"
                style={field}
              />
              <button
                type="button"
                className="btn btn-primario"
                disabled={address.trim().length < 6}
                onClick={() => go("resumen")}
                style={{
                  width: "100%",
                  marginTop: 16,
                  border: "none",
                  opacity: address.trim().length < 6 ? 0.5 : 1,
                  cursor: address.trim().length < 6 ? "not-allowed" : "pointer",
                }}
              >
                Seleccionar
              </button>
              <p style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
                <a
                  href="/hosteleria-y-empresas#alta"
                  style={{ textDecoration: "underline", color: "var(--color-caramelo)" }}
                >
                  Ya soy cliente
                </a>
              </p>
            </>
          )}

          {step === "tienda" && (
            <div style={{ display: "grid", gap: 12 }}>
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStoreId(s.id);
                    go("resumen");
                  }}
                  style={{
                    textAlign: "left",
                    padding: "1rem 1.25rem",
                    border: "1px solid var(--color-avellana)",
                    background: "var(--color-latte)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                    }}
                  >
                    {s.shortName}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 13,
                      color: "var(--color-ink-muted)",
                    }}
                  >
                    {s.address} · {s.hoursText}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === "resumen" && mode && (
            <>
              <dl
                style={{
                  display: "grid",
                  gap: 10,
                  margin: 0,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--color-avellana)",
                }}
              >
                <div>
                  <dt style={label}>Modalidad</dt>
                  <dd style={{ margin: 0 }}>{MODE_COPY[mode].label}</dd>
                </div>
                <div>
                  <dt style={label}>Día</dt>
                  <dd style={{ margin: 0 }}>{formatDateISO(dateISO)}</dd>
                </div>
                <div>
                  <dt style={label}>{mode === "domicilio" ? "Dirección" : "Tienda"}</dt>
                  <dd style={{ margin: 0 }}>
                    {mode === "domicilio"
                      ? address
                      : stores.find((s) => s.id === storeId)?.shortName}
                  </dd>
                </div>
                <div>
                  <dt style={label}>Total estimado</dt>
                  <dd
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                    }}
                  >
                    {formatPriceCents(totalCents)}
                  </dd>
                </div>
              </dl>

              <div style={{ marginTop: 16 }}>
                <span style={label}>Franja</span>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {([
                    { id: "morning", label: "Mañana" },
                    { id: "afternoon", label: "Tarde" },
                  ] as const).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSlot(s.id)}
                      aria-pressed={slot === s.id}
                      style={{
                        minHeight: 40,
                        padding: "0 1rem",
                        border: "1px solid var(--color-avellana)",
                        background:
                          slot === s.id ? "var(--color-caramelo)" : "transparent",
                        color:
                          slot === s.id ? "var(--color-leche)" : "var(--color-moka)",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={label} htmlFor="cf-email">
                  Tu email *
                </label>
                <input
                  id="cf-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Para enviarte la confirmación"
                  style={field}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={label} htmlFor="cf-name">
                  Tu nombre (opcional)
                </label>
                <input
                  id="cf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={field}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={label} htmlFor="cf-notes">
                  Notas (opcional)
                </label>
                <textarea
                  id="cf-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alergias, indicaciones, lo que necesites"
                  style={field}
                />
              </div>

              {error && (
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
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={pay}
                disabled={!canPay}
                style={{
                  width: "100%",
                  marginTop: 20,
                  minHeight: 48,
                  background: "var(--color-caramelo)",
                  color: "var(--color-leche)",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canPay ? "pointer" : "not-allowed",
                  opacity: canPay ? 1 : 0.55,
                }}
              >
                {sending
                  ? "Abriendo el pago…"
                  : `Pagar ${formatPriceCents(totalCents)}`}
              </button>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--color-ink-muted)",
                  textAlign: "center",
                }}
              >
                Pago seguro con tarjeta, Apple Pay o Google Pay. Al pagar aceptas
                las{" "}
                <a
                  href="/legal/condiciones-de-compra"
                  style={{ textDecoration: "underline" }}
                >
                  condiciones de compra
                </a>
                .
              </p>
              <p style={{ marginTop: 12, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={sendByWhatsApp}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 12,
                    color: "var(--color-ink-muted)",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Prefiero encargarlo por WhatsApp y pagar en tienda
                </button>
              </p>
            </>
          )}
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            padding: "0 1.25rem 1.25rem",
          }}
        >
          {history.length > 0 && (
            <button
              type="button"
              onClick={back}
              style={{
                minHeight: 40,
                padding: "0 1rem",
                border: "1px solid var(--color-avellana)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              ‹ Volver
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 40,
              padding: "0 1rem",
              border: "1px solid var(--color-avellana)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            ✕ Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
