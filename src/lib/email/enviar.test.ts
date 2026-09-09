import { describe, expect, it, vi, beforeEach } from "vitest";

const enviarMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: enviarMock };
  },
}));

beforeEach(() => {
  enviarMock.mockReset();
  vi.resetModules();
});

describe("enviarCorreo", () => {
  it("no revienta si falta la clave: devuelve error y no llama al proveedor", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { enviarCorreo } = await import("~/lib/email/enviar");

    const r = await enviarCorreo({
      para: "a@b.com",
      asunto: "Hola",
      texto: "Qué tal",
    });

    expect(r.ok).toBe(false);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("manda con el remitente de la configuración", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ORDER_FROM_EMAIL", "web@hornosanlorenzo.com");
    enviarMock.mockResolvedValue({ data: { id: "1" }, error: null });
    const { enviarCorreo } = await import("~/lib/email/enviar");

    const r = await enviarCorreo({
      para: "a@b.com",
      asunto: "Hola",
      texto: "Qué tal",
    });

    expect(r.ok).toBe(true);
    expect(enviarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "web@hornosanlorenzo.com",
        to: "a@b.com",
      }),
    );
  });
});
