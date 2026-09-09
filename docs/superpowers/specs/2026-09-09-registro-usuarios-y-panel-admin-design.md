# Horno San Lorenzo — Registro de usuarios y panel de administración

**Fecha:** 2026-09-09
**Autor:** Óscar Sánchez
**Estado:** Diseño aprobado — listo para plan de implementación

## 1. Contexto y objetivo

El sitio está en producción como web estática: Astro 5 con `output: "static"`, contenido en Markdown (Content Collections), rutas `/api` bajo demanda para el cobro, y despliegue en Vercel. No hay base de datos, no hay sesiones y `/acceso` es un formulario que acaba en un `mailto:`.

Se quiere:

1. **Registro de usuarios con acceso real** — hoy no existe.
2. **Un acceso de administración** que permita cambiar la web sin pasar por un despliegue manual.

**Reabre una decisión cerrada.** En el rebrand de agosto-septiembre de 2026 se decidió «pedidos por correo + panel de Stripe, sin base de datos: para el volumen de una panadería basta y no añade una pieza que mantener», y el alta de particulares se dejó **sin contraseña** porque no había dónde guardarla. Este documento cambia ambas cosas de forma consciente: el hecho nuevo es que se quiere un panel de administración, y un panel necesita usuarios, papeles y contenido editable.

## 2. Objetivos

- Que una persona sin conocimientos técnicos entre en `/admin` con **su correo y su contraseña** y cambie precios, fichas, fotos y noticias, viendo el resultado en la web sin esperar a nadie.
- Que el admin vea **los pedidos que entran** sin abrir el correo ni el panel de Stripe.
- Que un cliente particular se registre y **no tenga que repetir sus datos** en cada pedido.
- Que el precio siga calculándose **en servidor**, con la misma garantía de hoy: el navegador nunca manda un importe.
- Que **mudar la aplicación a Google Cloud el día de mañana sea un cambio de configuración, no una reescritura**. Requisito añadido el 9 de septiembre de 2026, después de la primera versión de este diseño.

## 3. No-objetivos

- No se toca la decisión de que **solo particulares pagan online**. Hostelería y empresas siguen a factura mensual, sin precios por cuenta.
- El registro **no es obligatorio para comprar**: el checkout sigue funcionando como invitado.
- Sin roles intermedios (editor, repartidor). Dos papeles: `cliente` y `admin`.
- Sin recuperación de carritos, listas de deseos ni programa de puntos.
- Sin panel de métricas ni informes de ventas. Para eso está Stripe.
- Sin edición de estructura: las secciones de la carta y las categorías siguen en código.
- No desbloquea cobrar. El checkout de Stripe sigue sin claves y con las condiciones de compra en borrador.

## 4. Decisiones tomadas

| #   | Pregunta                          | Decisión                                                                                  |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Alcance del admin                 | Todo: noticias, precios y disponibilidad, fichas y fotos, y ver los pedidos                |
| 2   | Qué gana el cliente registrándose | No repetir sus datos: contacto y direcciones guardadas, checkout relleno                   |
| 3   | CMS sobre git (Decap / Sveltia)   | **Descartado.** El admin no ve commits, pero necesitaría una cuenta de GitHub para entrar  |
| 4   | Backend con panel (Payload…)      | **Descartado.** Segunda aplicación que mantener y aun así hay que reescribir el catálogo   |
| 5   | Base de datos                     | **Postgres a secas**, con proveedor gestionado (Supabase o Neon) y cadena de conexión      |
| 6   | Acceso del admin                  | **Correo y contraseña**, con recuperación por correo                                       |
| 7   | Acceso del cliente                | **También correo y contraseña**: un solo sistema, dos papeles                              |
| 8   | Identidad de acceso               | El correo. Sin nombre de usuario aparte                                                    |
| 9   | Renderizado                       | El catálogo pasa a servidor con caché revalidable; `/admin` y `/cuenta`, siempre en vivo   |
| 10  | Autenticación                     | **Better Auth** sobre nuestras propias tablas de Postgres, no el servicio del proveedor    |
| 11  | Portabilidad                      | Nada específico de un proveedor fuera de tres módulos de adaptación (§5.4)                 |

## 5. Arquitectura

### 5.1 Piezas

| Pieza                     | Qué aporta                                                             | Su equivalente en Google Cloud   |
| ------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| Postgres gestionado       | Clientes, direcciones, catálogo, noticias, pedidos y sesiones           | Cloud SQL for PostgreSQL         |
| Better Auth (`pg.Pool`)   | Correo y contraseña, recuperación y sesiones, en tablas nuestras        | Se muda con la base de datos     |
| Almacén de ficheros       | Fotos de producto y de noticias, tras una interfaz propia               | Cloud Storage                    |
| Astro + Vercel            | Sigue siendo el sitio. Cambia el modo de renderizado, no el stack       | Cloud Run                        |
| Stripe                    | Igual que hoy. El webhook pasa además a escribir el pedido              | Igual                            |
| Resend                    | Correos de pedido y de recuperación de contraseña                       | Igual                            |

### 5.2 Renderizado

Hoy `output: "static"` con `prerender = false` en las rutas de `/api`. Pasa a:

- **Catálogo, fichas, noticias y home** — en servidor, con caché en Vercel e **invalidación bajo demanda** cuando el admin publica un cambio. Así un cambio de precio se ve al momento sin renunciar a que la página vaya rápida y se indexe.
- **`/admin` y `/cuenta`** — siempre en vivo, sin caché, con la sesión comprobada en servidor antes de pintar nada.
- **`/api/*`** — como hoy.

### 5.3 Portabilidad a Google Cloud

El requisito de poder mudarse manda sobre la comodidad. Tres reglas lo sostienen:

1. **La base de datos se usa como Postgres a secas.** Conexión por cadena de conexión y SQL versionado en `db/migrations/`. Nada de la API REST del proveedor, ni de sus extensiones propias. Mudarse a Cloud SQL es cambiar `DATABASE_URL` y restaurar un volcado.
2. **La autenticación es nuestra.** Better Auth guarda usuarios, sesiones y contraseñas en **nuestras tablas**, dentro de la misma base de datos. No se usa el servicio de autenticación del proveedor: es la pieza que peor se muda, porque cambia el formato del token y obliga a reemitir contraseñas.
3. **Los permisos se comprueban en nuestro código de servidor**, no en políticas de fila atadas a la función `auth.uid()` de un proveedor concreto. Se puede añadir RLS después usando una variable de sesión propia, que funciona en cualquier Postgres.

Solo tres módulos saben con quién hablan, y son los únicos que se tocan en una mudanza:

| Módulo                  | Qué encapsula                                        |
| ----------------------- | ---------------------------------------------------- |
| `src/lib/db/pool.ts`    | La conexión a Postgres                               |
| `src/lib/storage/*`     | Subir, borrar y servir ficheros                       |
| `src/lib/email/*`       | El envío de correo (hoy Resend)                       |

**El navegador nunca habla con la base de datos.** Todo pasa por nuestras rutas `/api`. Esto no es solo portabilidad: es lo que permite que el precio y los permisos se decidan en servidor.

### 5.4 Dónde vive cada cosa después del cambio

| Dato                                     | Hoy                     | Después              |
| ---------------------------------------- | ----------------------- | -------------------- |
| Fichas de producto y variantes           | `src/content/products/` | Base de datos        |
| Noticias                                 | `src/content/noticias/` | Base de datos        |
| Fotos de producto                        | `public/images/`        | Supabase Storage     |
| Secciones de la carta y categorías       | `src/data/`             | Igual, en código     |
| Tiendas, horarios y zona de reparto      | `src/data/`, `src/lib/` | Igual, en código     |
| Reglas de plazo, envío y pedido mínimo   | `src/lib/entrega.ts`    | Igual, en código     |

Lo que cambia una vez al año se queda en código, donde se revisa en un *pull request*. Lo que cambia cada semana se va a la base de datos.

## 6. Modelo de datos

Better Auth crea y mantiene sus propias tablas —`user`, `session`, `account`,
`verification`— con la contraseña ya cifrada. El resto son nuestras:

```
user                (Better Auth) id, email, name, emailVerified, createdAt
                    + campos añadidos: telefono, rol  ← ambos con `input: false`,
                      para que nadie pueda darse de alta pidiendo rol de admin
session, account,
verification        (Better Auth) sesiones, credenciales y tokens de un solo uso
direcciones         id, user_id, alias, calle, postal_code, predeterminada
productos           id, slug, name, category, seccion, price_cents, consultar,
                    short_description, allergens[], orden, image_path, image_alt,
                    activo, agotado, updated_at
variantes           id, producto_id, variant_id, label, price_cents, orden
noticias            id, slug, titulo, cuerpo, fecha, image_path, publicada
pedidos             id, user_id?, stripe_session_id, mode, fecha_entrega, slot?,
                    store_id?, address?, postal_code?, email, telefono, nombre?,
                    notas?, subtotal_cents, envio_cents, total_cents, estado, created_at
lineas_pedido       id, pedido_id, slug, nombre, variante_label?, qty, unit_price_cents
```

Tres decisiones del modelo que conviene no perder:

- **`rol` vive en la tabla de usuarios y se lee en servidor** en cada petición que importa. Va marcado como campo no rellenable desde el cliente.
- **Las líneas del pedido guardan el precio cobrado**, no una referencia al producto. Si mañana sube el precio, el pedido viejo sigue diciendo lo que costó. Un pedido es un documento histórico, no una consulta.
- **`user_id` es opcional en `pedidos`.** El checkout de invitado sigue existiendo y sus pedidos también se guardan.

## 7. Acceso y permisos

**Autenticación.** Better Auth con correo y contraseña, sobre nuestras tablas de Postgres. El cifrado de la contraseña, las sesiones, los tokens de recuperación y el límite de intentos los pone la librería: **no escribimos criptografía a mano**, que es donde se cometen los errores. Los correos de recuperación salen por Resend, que ya está en el proyecto.

**Autorización en nuestro servidor.** Un middleware de Astro resuelve la sesión en cada petición y la deja en `context.locals`. A partir de ahí:

- un `cliente` solo lee y escribe **sus** filas de usuario, direcciones y pedidos;
- un `admin` lee y escribe todo;
- el catálogo y las noticias son de lectura pública y solo un `admin` los escribe.

La comprobación vive en el código de servidor, no en el navegador, y **no depende de ninguna función propia del proveedor**. Si más adelante se quiere doble cinturón con políticas de fila, se escriben contra una variable de sesión propia, que funciona en cualquier Postgres.

**Protección de rutas.** `/admin` comprueba la sesión y el papel **en servidor** antes de responder. Sin sesión, redirección a la pantalla de acceso; con sesión de cliente, un 404 honesto — no confirmar que la ruta existe.

**Alta de administradores.** No hay registro público de admins. El primero se crea a mano desde el panel de Supabase; a partir de ahí, un admin puede dar de alta a otro.

## 8. El panel

Cuatro pantallas dentro del sitio, con el sistema visual de la marca — mismos tokens, mismo filete, sin radios ni sombras.

- **Productos.** Listado con buscador y filtro por sección. Editar precio, descripción, alérgenos y variantes; marcar **agotado**; **activar o desactivar** una ficha; subir foto; crear ficha nueva. Un producto desactivado desaparece del catálogo y deja de poder comprarse; uno agotado se ve pero no se puede añadir al carrito.
- **Noticias.** Escribir, editar, publicar y despublicar.
- **Pedidos.** Lo que ha entrado, del más reciente al más antiguo: día, modalidad, destino, teléfono, líneas e importe. Es lo que hoy hay que ir a buscar al correo.
- **Clientes.** La lista con nombre, correo y teléfono, para conocerlos y poder llamar.

Cada guardado que afecta a la web pública **invalida la caché** de las páginas tocadas.

## 9. Qué pasa con el checkout

El flujo del pedido no cambia de forma para quien compra. Por dentro:

- `priceOrder` (`src/lib/pedido.ts`) sigue siendo la única autoridad sobre el precio, pero lee el producto **de la base de datos** en vez de la colección de contenido. Rechaza además lo desactivado y lo agotado.
- Si hay sesión, el resumen viene relleno con el nombre, el teléfono y la dirección predeterminada, y el pedido se ata al `profile_id`.
- El webhook de Stripe (`/api/webhook`), además de avisar por correo, **escribe el pedido y sus líneas**.

Las reglas de plazo, zona de reparto, código postal y teléfono no se tocan: siguen en `src/lib/entrega.ts` y se siguen comprobando en servidor.

## 10. Migración

1. Script que lee los 98 Markdown de `src/content/products/` y los vuelca a `productos` y `variantes`. El frontmatter ya está validado con zod, así que el esquema de las tablas sale del esquema que ya existe.
2. Mismo volcado para `src/content/noticias/`.
3. Las fotos de `public/images/productos` y `public/images/noticias` suben a Storage; `image_path` guarda la referencia.
4. **Verificación antes de retirar nada**: el número de fichas, precios y variantes de la base de datos tiene que coincidir con el de los ficheros, producto a producto.
5. Solo entonces se retiran las colecciones de contenido del repo.

El paso 4 no es burocracia: es la diferencia entre migrar y perder la carta.

## 11. Riesgos y deuda que crea

- **Datos personales.** Aparecen obligaciones de RGPD reales que hoy no existen: la política de privacidad no cubre cuentas, y hace falta borrado de cuenta a petición.
- **Un panel es una superficie de ataque.** Quien entre en `/admin` puede cambiar precios. De ahí el límite de intentos y que el papel se compruebe en la base de datos.
- **Copias de seguridad.** Hoy el contenido está en git y se recupera solo. En base de datos hay que activarlas y probarlas. Con la mudanza en el horizonte, el volcado hay que saber restaurarlo, no solo tenerlo.
- **La autenticación pasa a ser responsabilidad nuestra**, aunque el trabajo fino lo haga la librería. A cambio de esa responsabilidad se gana que mudarse no obligue a reemitir las contraseñas de nadie.
- **El mantenimiento sube de categoría.** Deja de ser una web estática y pasa a ser una aplicación con sesiones y estado.
- **El trabajo grueso no es el panel**, es reescribir la capa de catálogo —rejilla, filtros, buscador, secciones y fichas— para que lea de la base de datos. Es el cambio más grande que ha tenido el proyecto.

## 12. Pendientes que este trabajo no resuelve

Siguen abiertos y anotados en `tasks/todo.md`: alérgenos de las 100 fichas, claves de Stripe y Resend, condiciones de compra sin revisión legal, horario real de la tienda de Alcobendas, y los rangos de código postal de reparto sin confirmar con el obrador.
