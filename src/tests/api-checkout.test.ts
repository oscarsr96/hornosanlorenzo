import { describe, expect, it, vi, beforeEach } from "vitest";

const crearPedidoIniciado = vi.fn();
const anotarSesionStripe = vi.fn();
vi.mock("~/lib/db/pedidos", () => ({
  crearPedidoIniciado,
  anotarSesionStripe,
}));

const priceOrder = vi.fn();
vi.mock("~/lib/pedido", async (original) => ({
  ...(await original<typeof import("~/lib/pedido")>()),
  priceOrder,
}));

const sessionsCreate = vi.fn();
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: sessionsCreate } };
  },
}));

const PEDIDO_VALORADO = {
  lines: [
    {
      slug: "croissant",
      name: "Croissant",
      qty: 1,
      unitPriceCents: 190,
      totalCents: 190,
    },
  ],
  subtotalCents: 190,
  shippingCents: 0,
  totalCents: 190,
  payload: {
    items: [{ slug: "croissant", qty: 1 }],
    mode: "recogida",
    dateISO: "2026-09-20",
    slot: "morning",
    storeId: "alcobendas",
    email: "cliente@example.com",
    phone: "666123456",
  },
};

const peticion = () =>
  new Request("https://ejemplo.test/api/checkout", {
    method: "POST",
    body: JSON.stringify(PEDIDO_VALORADO.payload),
  });

const contexto = () => ({
  request: peticion(),
  url: new URL("https://ejemplo.test/api/checkout"),
  locals: { usuario: null },
});

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  crearPedidoIniciado.mockReset().mockResolvedValue("pedido-1");
  anotarSesionStripe.mockReset().mockResolvedValue(undefined);
  priceOrder.mockReset().mockResolvedValue(PEDIDO_VALORADO);
  sessionsCreate
    .mockReset()
    .mockResolvedValue({ id: "cs_test_1", url: "https://stripe.test/pagar" });
});

describe("POST /api/checkout", () => {
  it("anota el pedido y manda su id en los metadatos de Stripe", async () => {
    const { POST } = await import("~/pages/api/checkout");
    const respuesta = await POST(contexto() as never);

    expect(respuesta.status).toBe(200);
    expect(crearPedidoIniciado).toHaveBeenCalledOnce();
    expect(sessionsCreate.mock.calls[0][0].metadata.pedidoId).toBe("pedido-1");
    expect(anotarSesionStripe).toHaveBeenCalledWith("pedido-1", "cs_test_1");
  });

  it("si Postgres falla, se cobra igual: no se puede perder una venta por eso", async () => {
    crearPedidoIniciado.mockRejectedValue(
      new Error("Connection terminated unexpectedly"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("~/pages/api/checkout");
    const respuesta = await POST(contexto() as never);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      url: "https://stripe.test/pagar",
    });
    // Sin pedido anotado, el metadato va vacío y el webhook lo reconstruirá.
    expect(sessionsCreate.mock.calls[0][0].metadata.pedidoId).toBe("");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
