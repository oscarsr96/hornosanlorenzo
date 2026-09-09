import { describe, expect, it } from "vitest";
import { getCollection } from "astro:content";
import { earliestDate } from "~/lib/entrega";
import { priceOrder, OrderError, type OrderPayload } from "~/lib/pedido";

/**
 * `priceOrder` es la pieza del dinero: el checkout entero se apoya en que
 * el precio y el destinatario del pedido salen del servidor, nunca del
 * navegador. Estas pruebas fijan esa intención.
 *
 * `now` y `dateISO` van fijados a mano con `earliestDate`, no con una fecha
 * cualquiera: así la prueba no depende de qué día de la semana se ejecute
 * ni de las reglas de plazo cambiando con el tiempo.
 */

const AHORA = new Date("2026-03-10T10:00:00");
const FECHA_RECOGIDA = earliestDate("recogida", AHORA, {
  storeId: "alcobendas",
});

async function productoDeCatalogoSencillo() {
  // Cualquier producto con precio de venta online, sin variantes: así el
  // total esperado sale de un único priceCents, sin tener que replicar aquí
  // la lógica de variantes.
  const catalogo = await getCollection("products");
  const producto = catalogo.find(
    (p) =>
      typeof p.data.priceCents === "number" &&
      !p.data.consultar &&
      !p.data.variants?.length,
  );
  if (!producto) {
    throw new Error(
      "No hay ningún producto sencillo (sin variantes) en el catálogo de pruebas.",
    );
  }
  return producto;
}

function pedidoBase(
  producto: Awaited<ReturnType<typeof productoDeCatalogoSencillo>>,
): OrderPayload {
  return {
    items: [{ slug: producto.id, qty: 2 }],
    mode: "recogida",
    dateISO: FECHA_RECOGIDA,
    slot: "morning",
    storeId: "alcobendas",
    email: "cliente@example.com",
    phone: "666123456",
  };
}

describe("priceOrder", () => {
  it("rechaza un código postal fuera de la zona de reparto", async () => {
    const payload: OrderPayload = {
      items: [{ slug: "lo-que-sea", qty: 1 }],
      mode: "domicilio",
      dateISO: FECHA_RECOGIDA,
      address: "Calle Falsa 123",
      // Ningún rango de `admiteCP` llega a 28900: fuera de zona a propósito.
      postalCode: "28900",
      email: "cliente@example.com",
      phone: "666123456",
    };

    await expect(priceOrder(payload, { now: AHORA })).rejects.toBeInstanceOf(
      OrderError,
    );
  });

  it("ignora un importe que venga del navegador: el precio sale del catálogo", async () => {
    const producto = await productoDeCatalogoSencillo();
    const payload = pedidoBase(producto);

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
    expect(pedido.lines[0].unitPriceCents).toBe(producto.data.priceCents);
    expect(pedido.subtotalCents).toBe((producto.data.priceCents ?? 0) * 2);
    expect(pedido.totalCents).not.toBe(1);
  });

  it("no acepta el userId desde el cuerpo de la petición", async () => {
    const producto = await productoDeCatalogoSencillo();
    const payload = pedidoBase(producto);

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
