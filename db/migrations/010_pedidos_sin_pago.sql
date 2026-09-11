-- Mientras Stripe no tenga claves, pulsar «Pagar» anota el pedido igualmente
-- para que el obrador lo vea llegar al panel, pero con un estado propio:
-- 'sin_pago' no es 'pagado' y el panel lo tiene que decir a gritos. Cuando
-- Stripe esté configurado esta rama deja de usarse sola; el estado se queda
-- para que el histórico de pruebas siga siendo legible.
alter table pedidos drop constraint if exists pedidos_estado_check;
alter table pedidos
  add constraint pedidos_estado_check
  check (estado in ('iniciado', 'pagado', 'sin_pago'));
