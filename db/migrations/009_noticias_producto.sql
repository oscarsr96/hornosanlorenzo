-- Una noticia de «Este mes» puede enlazar UN producto de la carta: la tarjeta
-- enseña su precio y el mismo botón de añadir que el catálogo, y el cobro no
-- cambia (el carrito recibe una línea de producto normal). El precio no se
-- copia: se lee de la ficha, así que un cambio en el panel se ve a la vez en
-- la carta y en Este mes.
--
-- `on delete set null`, no `cascade`: borrar una ficha de la carta no puede
-- llevarse por delante una noticia publicada; se queda sin botón y ya.
alter table noticias
  add column if not exists producto_id uuid references productos(id) on delete set null;
