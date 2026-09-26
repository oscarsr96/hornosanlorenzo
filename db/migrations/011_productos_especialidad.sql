-- Etiqueta de especialidad de la carta: «Especialidad desde 1986» en la
-- mayoría, «Especialidad» o «Especialidad niños» en alguna. Texto y no
-- booleano porque la carta usa las tres. `null` = sin etiqueta.
alter table productos
  add column if not exists especialidad text;
