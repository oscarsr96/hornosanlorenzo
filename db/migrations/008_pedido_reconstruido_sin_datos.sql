-- Un pedido reconstruido desde Stripe (el cobro salió bien pero Postgres
-- estaba caído al anotarlo) puede no saber la modalidad ni el día de entrega.
-- Hasta ahora `crearPedidoReconstruido` los rellenaba con 'recogida' y
-- `current_date` porque las dos columnas eran `not null`, y el panel enseñaba
-- eso como si fuera un hecho: un envío a domicilio para el 24 de diciembre
-- aparecía como «10/09/2026 · Recogida en tienda». No es que faltara detalle,
-- es que el detalle era falso, y encima discrepaba del correo al obrador, que
-- sí lleva los datos buenos.
--
-- Se permite el nulo para que «no lo sé» se pueda escribir tal cual y el
-- panel lo enseñe como «sin datos». Los pedidos normales
-- (`crearPedidoIniciado`) siguen rellenando las dos columnas siempre: esto no
-- afloja ninguna regla de negocio, solo deja de obligar a inventarse un dato.
--
-- El CHECK de `mode` no hay que tocarlo: en SQL un CHECK se cumple cuando su
-- expresión da NULL, así que `mode in ('domicilio','recogida')` sigue
-- rechazando cualquier texto que no sea uno de los dos y acepta el nulo.
alter table pedidos alter column mode drop not null;
alter table pedidos alter column fecha_entrega drop not null;
