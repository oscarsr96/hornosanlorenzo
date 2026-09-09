import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const enviarCorreoMock = vi.fn();
vi.mock("~/lib/email/enviar", () => ({
  enviarCorreo: enviarCorreoMock,
}));

beforeEach(() => {
  enviarCorreoMock.mockReset();
  vi.resetModules();
  vi.unstubAllEnvs();
});

function stripeConLineItems(
  items: { quantity: number; description: string }[],
) {
  return {
    checkout: {
      sessions: {
        listLineItems: vi.fn().mockResolvedValue({ data: items }),
      },
    },
  } as unknown as Stripe;
}

function sesionPagada(): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    amount_total: 2500,
    metadata: { modalidad: "recogida", dia: "sábado", franja: "mañana" },
    customer_details: { email: "cliente@example.com" },
  } as unknown as Stripe.Checkout.Session;
}

describe("notify — configuración de correo incompleta", () => {
  it("si falta una variable (aunque las otras dos estén), no llama a enviarCorreo y registra el pedido completo", async () => {
    // RESEND_API_KEY y ORDER_FROM_EMAIL configuradas; falta la del obrador.
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ORDER_NOTIFICATION_EMAIL", "");
    vi.stubEnv("ORDER_FROM_EMAIL", "web@hornosanlorenzo.com");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { notify } = await import("~/pages/api/webhook");
    await notify(
      stripeConLineItems([{ quantity: 1, description: "Tarta" }]),
      sesionPagada(),
    );

    // Ni el correo al obrador ni el del cliente se intentan: es todo o nada.
    expect(enviarCorreoMock).not.toHaveBeenCalled();

    // El pedido queda registrado para que no se pierda.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [mensaje] = warnSpy.mock.calls[0] as [string];
    expect(mensaje).toContain("Pedido pagado");
    expect(mensaje).toContain("cs_test_123");

    warnSpy.mockRestore();
  });
});

describe("notify — envío al obrador rechazado con configuración completa", () => {
  it("si el aviso al obrador falla (proveedor), no manda la confirmación al cliente y registra el pedido", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ORDER_NOTIFICATION_EMAIL", "obrador@hornosanlorenzo.com");
    vi.stubEnv("ORDER_FROM_EMAIL", "web@hornosanlorenzo.com");

    // El envío al obrador (la única llamada que debería producirse) falla
    // en el proveedor, aunque toda la configuración está bien puesta.
    enviarCorreoMock.mockResolvedValue({
      ok: false,
      error: "No se pudo enviar el correo.",
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { notify } = await import("~/pages/api/webhook");
    await notify(
      stripeConLineItems([{ quantity: 1, description: "Tarta" }]),
      sesionPagada(),
    );

    // Solo se intenta el correo al obrador; el del cliente nunca se llama,
    // porque afirmaría algo falso («ya anotado en el obrador»).
    expect(enviarCorreoMock).toHaveBeenCalledTimes(1);
    expect(enviarCorreoMock).toHaveBeenCalledWith(
      expect.objectContaining({ para: "obrador@hornosanlorenzo.com" }),
    );

    // El pedido queda registrado para que no se pierda.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [mensaje] = warnSpy.mock.calls[0] as [string];
    expect(mensaje).toContain("Pedido pagado");
    expect(mensaje).toContain("cs_test_123");

    warnSpy.mockRestore();
  });
});
