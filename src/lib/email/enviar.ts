import { Resend } from "resend";

/**
 * Único punto de salida de correo. Cambiar de proveedor es reescribir este
 * fichero; nada más en el proyecto importa `resend`.
 *
 * Sin clave no lanza: devuelve `ok: false`. Un correo que no sale no puede
 * tumbar un pedido que ya está pagado.
 */
export type Correo = { para: string; asunto: string; texto: string };

export async function enviarCorreo({
  para,
  asunto,
  texto,
}: Correo): Promise<{ ok: boolean; error?: string }> {
  const clave = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const remitente =
    import.meta.env.ORDER_FROM_EMAIL ?? process.env.ORDER_FROM_EMAIL;

  if (!clave || !remitente) {
    console.error("[email] sin RESEND_API_KEY o ORDER_FROM_EMAIL: no se envía");
    return { ok: false, error: "Correo no configurado." };
  }

  const { error } = await new Resend(clave).emails.send({
    from: remitente,
    to: para,
    subject: asunto,
    text: texto,
  });

  if (error) {
    console.error("[email] el proveedor rechazó el envío", error);
    return { ok: false, error: "No se pudo enviar el correo." };
  }

  return { ok: true };
}
