import { describe, expect, it, vi, beforeEach } from "vitest";
import { earliestDate } from "~/lib/entrega";
import type { ProductoVendible } from "~/lib/db/productos";

/**
 * `priceOrder` es la pieza del dinero: el checkout entero se apoya en que
 * el precio y el destinatario del pedido salen del servidor, nunca del
 * navegador. Estas pruebas fijan esa intención.
 *
 * El catálogo ya no sale de la colección de contenido, sino de la tabla
 * `productos` a través de `productosParaPedido`. Se dobla ese import: así
 * las pruebas no dependen de qué haya cargado en la base de pruebas ese
 * día, y siguen siendo tan rápidas como cuando leían Markdown.
 */
const productosParaPedido = vi.fn();
vi.mock("~/lib/db/productos", () => ({ productosParaPedido }));

const { priceOrder } = await import("~/lib/pedido");
type OrderPayload = import("~/lib/pedido").OrderPayload;

/** Un producto sencillo, sin variantes, con precio de venta online. */
const SENCILLO: ProductoVendible = {
  slug: "tarta-de-queso",
  name: "Tarta de queso",
  priceCents: 1850,
  consultar: false,
  activo: true,
  agotado: false,
  variantes: [],
};

const catalogo = (...productos: ProductoVendible[]) =>
  new Map(productos.map((p) => [p.slug, p]));

/**
 * `now` y `dateISO` van fijados a mano con `earliestDate`, no con una fecha
 * cualquiera: así la prueba no depende de qué día de la semana se ejecute
 * ni de las reglas de plazo cambiando con el tiempo.
 */
const AHORA = new Date("2026-03-10T10:00:00");
const FECHA_RECOGIDA = earliestDate("recogida", AHORA, {
  storeId: "alcobendas",
});
const FECHA_DOMICILIO = earliestDate("domicilio", AHORA);

beforeEach(() => {
  productosParaPedido.mockReset().mockResolvedValue(catalogo(SENCILLO));
});

const pedidoBase = (): OrderPayload => ({
  items: [{ slug: SENCILLO.slug, qty: 2 }],
  mode: "recogida",
  dateISO: FECHA_RECOGIDA,
  slot: "morning",
  storeId: "alcobendas",
  email: "cliente@example.com",
  phone: "666123456",
});

describe("priceOrder", () => {
  it("rechaza un código postal fuera de la zona de reparto", async () => {
    // El pedido tiene que ser válido en todo salvo el código postal: un
    // slug inventado también lo habría rechazado (por «producto no
    // disponible»), pero entonces la prueba seguiría en verde aunque se
    // rompiera del todo la validación de zona. Con un producto real y una
    // fecha válida para domicilio, lo único que puede fallar es el CP.
    const payload: OrderPayload = {
      items: [{ slug: SENCILLO.slug, qty: 1 }],
      mode: "domicilio",
      dateISO: FECHA_DOMICILIO,
      address: "Calle Falsa 123",
      // Ningún rango de `admiteCP` llega a 28900: fuera de zona a propósito.
      postalCode: "28900",
      email: "cliente@example.com",
      phone: "666123456",
    };

    // No basta con comprobar que lanza `OrderError`: cualquier otro motivo
    // de rechazo (fecha, producto, teléfono...) también es un `OrderError`
    // y dejaría pasar la prueba aunque `admiteCP` se rompiera. Se afirma
    // sobre el motivo, no solo sobre el tipo.
    await expect(priceOrder(payload, { now: AHORA })).rejects.toMatchObject({
      message: expect.stringContaining(
        "No repartimos en el código postal 28900",
      ),
    });
  });

  it("rechaza una fecha de recogida anterior a la primera disponible", async () => {
    const payload: OrderPayload = {
      ...pedidoBase(),
      // Lunes, muy anterior a cualquier `earliestDate` posible para 2026:
      // no depende de a qué hora se ejecute la prueba.
      dateISO: "2020-01-06",
    };

    await expect(priceOrder(payload, { now: AHORA })).rejects.toThrow(
      /fecha elegida no está disponible/i,
    );
  });

  it("rechaza un teléfono que no parece válido", async () => {
    const payload: OrderPayload = { ...pedidoBase(), phone: "123456789" };

    await expect(priceOrder(payload, { now: AHORA })).rejects.toThrow(
      /teléfono de contacto no parece válido/i,
    );
  });

  it("rechaza un producto que no existe en el catálogo", async () => {
    const payload: OrderPayload = {
      ...pedidoBase(),
      items: [{ slug: "no-existe", qty: 1 }],
    };

    await expect(priceOrder(payload, { now: AHORA })).rejects.toThrow(
      /ya no está disponible/i,
    );
  });

  it("rechaza una variante que no existe", async () => {
    const payload: OrderPayload = {
      ...pedidoBase(),
      items: [{ slug: SENCILLO.slug, variantId: "no-existe", qty: 1 }],
    };

    await expect(priceOrder(payload, { now: AHORA })).rejects.toThrow(
      /opción elegida.*ya no está disponible/i,
    );
  });

  it("un producto a consultar no tiene precio de venta online", async () => {
    productosParaPedido.mockResolvedValue(
      catalogo({ ...SENCILLO, consultar: true, priceCents: null }),
    );

    await expect(priceOrder(pedidoBase(), { now: AHORA })).rejects.toThrow(
      /se encarga hablando con el obrador/i,
    );
  });

  it("ignora un importe que venga del navegador: el precio sale del catálogo", async () => {
    const payload = pedidoBase();

    // El tipo `OrderPayload` no tiene ningún campo de precio —a propósito—,
    // pero si algo lo colara (un fallo del esquema de validación, por
    // ejemplo), `priceOrder` tampoco debe hacerle caso. Se fuerza el tipo
    // para simular justo ese escenario.
    const payloadConPrecioFalso = {
      ...payload,
      priceCents: 1,
      totalCents: 1,
      unitPriceCents: 1,
    } as unknown as OrderPayload;

    const pedido = await priceOrder(payloadConPrecioFalso, { now: AHORA });

    expect(pedido.lines).toHaveLength(1);
    expect(pedido.lines[0].unitPriceCents).toBe(SENCILLO.priceCents);
    expect(pedido.subtotalCents).toBe((SENCILLO.priceCents ?? 0) * 2);
    expect(pedido.totalCents).not.toBe(1);
  });

  it("no acepta el userId desde el cuerpo de la petición", async () => {
    const payload = pedidoBase();

    // Igual que el precio: el tipo no declara `userId`, pero si se colara
    // en el cuerpo no debe suplantar al de la sesión.
    const payloadConUserIdFalso = {
      ...payload,
      userId: "usuario-ajeno",
    } as unknown as OrderPayload;

    const sinSesion = await priceOrder(payloadConUserIdFalso, { now: AHORA });
    expect(sinSesion.userId).toBeUndefined();

    const conSesion = await priceOrder(payloadConUserIdFalso, {
      now: AHORA,
      userId: "usuario-de-la-sesion",
    });
    expect(conSesion.userId).toBe("usuario-de-la-sesion");
  });
});

describe("priceOrder — estados de venta", () => {
  it("un producto desactivado no se puede comprar, y se dice sin tecnicismos", async () => {
    productosParaPedido.mockResolvedValue(
      catalogo({ ...SENCILLO, activo: false }),
    );
    await expect(priceOrder(pedidoBase(), { now: AHORA })).rejects.toThrow(
      /ya no está disponible/i,
    );
  });

  it("un producto agotado tampoco, y con un mensaje distinto", async () => {
    productosParaPedido.mockResolvedValue(
      catalogo({ ...SENCILLO, agotado: true }),
    );
    await expect(priceOrder(pedidoBase(), { now: AHORA })).rejects.toThrow(
      /se ha agotado/i,
    );
  });

  it("el precio sale del catálogo, nunca de lo que mande el navegador", async () => {
    // El payload no tiene ni un campo de precio, y aun así el total es exacto.
    const order = await priceOrder(pedidoBase(), { now: AHORA });
    expect(order.subtotalCents).toBe(3700);
    expect(order.lines[0].unitPriceCents).toBe(1850);
  });

  it("solo pide a la base de datos los productos del carrito", async () => {
    await priceOrder(pedidoBase(), { now: AHORA });
    expect(productosParaPedido).toHaveBeenCalledWith([SENCILLO.slug]);
  });
});
