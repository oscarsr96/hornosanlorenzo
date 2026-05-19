# Horno San Lorenzo — Web demo (pitch a posible cliente)

**Fecha:** 2026-05-19
**Autor:** Óscar Sánchez
**Estado:** Diseño aprobado — listo para plan de implementación

## 1. Contexto y objetivo

Horno San Lorenzo es una panadería/pastelería artesanal de Madrid (Alcobendas + Pozuelo) con web pública en https://www.hornosanlorenzo.com. La web actual es anticuada y su versión móvil es muy pobre.

**No son cliente todavía.** Esta es una **demo de pitch**: una versión moderna del sitio para presentársela en una reunión y convencerles de contratar el rediseño.

**Hook principal de la demo:** salto visual brutal + pedidos por WhatsApp sin backend. Sweet spot vistoso, útil y sin asustar con complejidad técnica.

## 2. Objetivos

- **Impactar visualmente** en móvil (donde su web actual flojea más) — Lighthouse mobile ≥ 95.
- **Demostrar el flujo de pedidos por WhatsApp** funcionando en vivo desde el móvil del cliente durante la reunión.
- **Sentirse "lista para ir online mañana"** — datos reales suyos (logo, tiendas, teléfonos), no genérica.
- **Cubrir las secciones de su web actual** (catálogo, servicios, tradición, noticias, tiendas, contacto) para que vean que no se pierde nada.
- Deployable a una URL pública compartible (`hornosanlorenzo-demo.vercel.app`).

## 3. No-objetivos

- No es un sitio en producción para ellos — es una demo para vender el contrato.
- Sin pasarela de pago real, sin Stripe.
- Sin cuenta de usuario / login.
- Sin CMS (Astro Content Collections con markdown es suficiente).
- Sin i18n — solo español.
- Sin tests automatizados (Lighthouse manual cubre lo crítico para esta fase).
- Sin auth, sin BD, sin API routes, sin backend.

## 4. Decisiones tomadas (resumen de brainstorming)

| #   | Pregunta                | Decisión                                                                                               |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Relación con el negocio | Posible cliente — demo de pitch                                                                        |
| 2   | Hook principal          | Salto visual + pedidos por WhatsApp                                                                    |
| 3   | Alcance                 | Home + Catálogo + Producto + Carrito + Tiendas + Contacto + Servicios + Tradición y Calidad + Noticias |
| 4   | Dirección visual        | **Warm Artisan** (crema, marrones cálidos, serif italic)                                               |
| 5   | Fotografía              | Unsplash genérica (sustituible por fotos suyas tras firma)                                             |
| 6   | Stack                   | Astro 5 + React islands + Tailwind v4 + Vercel                                                         |
| 7   | Personalización         | 100% real (logo, direcciones, teléfonos suyos públicos)                                                |
| 8   | Despliegue / WhatsApp   | Vercel público + el WhatsApp de Óscar en el botón → recibe el pedido en vivo durante la demo           |
| 9   | Idioma                  | Solo español                                                                                           |
| 10  | Cookie banner           | Sí, básico (LSSI compliance)                                                                           |
| 11  | Analytics               | Vercel Analytics (sin cookies)                                                                         |

## 5. Arquitectura de rutas

```
/                          Home (one-page con secciones que enlazan al resto)
/catalogo                  Listado de productos + filtros por categoría
/catalogo/[slug]           Detalle de producto
/carrito                   Resumen + selector tienda/día/franja + botón WhatsApp
/servicios                 Catering · Distribución hostelería · A domicilio
/tradicion-y-calidad       Historia desde 1986, valores, certificación
/noticias                  Listado de promociones estacionales
/noticias/[slug]           Detalle de cada noticia
/tiendas                   Las 2 ubicaciones (Alcobendas + Pozuelo) con mapa
/contacto                  Form (mailto) + datos + redes
/legal/aviso-legal
/legal/privacidad
/legal/cookies
```

11 rutas estáticas + 2 dinámicas (`/catalogo/[slug]`, `/noticias/[slug]`). **Todo prerender** en build (Astro `output: 'static'`). Sitemap autogenerado.

## 6. Stack técnico

```
astro                      ^5.x
@astrojs/react             ^4.x
@astrojs/sitemap           ^3.x
@astrojs/vercel            ^8.x (adapter static)
@vercel/analytics          latest
tailwindcss                ^4.x  (vía @tailwindcss/vite plugin)
react / react-dom          ^19.x
motion                     ^11.x (animaciones, ~3KB tree-shaken)
zod                        ^3.x  (content collection schemas)
@fontsource-variable/fraunces
@fontsource-variable/inter
```

**Node:** v24 · **Package manager:** pnpm · **Deploy:** Vercel Hobby

## 7. Flujo del carrito + WhatsApp

### Modelo de datos (cliente, localStorage)

```ts
// key: 'hsl-cart-v1'
type CartItem = {
  slug: string; // 'pan-de-pueblo'
  name: string; // 'Pan de pueblo'
  variantId?: string; // '500g' | '1kg' | undefined
  variantLabel?: string; // '500 g'
  qty: number;
  unitPriceCents: number;
};

type Cart = {
  items: CartItem[];
  updatedAt: string; // ISO 8601
};

type PickupInfo = {
  storeId: "alcobendas" | "pozuelo";
  dateISO: string; // 'YYYY-MM-DD'
  slot: "morning" | "afternoon";
  name?: string;
  notes?: string;
};
```

### Flujo de UX

1. `/catalogo/[slug]`: usuario elige variante (si aplica) + cantidad → `[Añadir al pedido]` → toast `✓ Añadido` + badge del header incrementa.
2. `/carrito`: ve items, edita qty, ve subtotal. Selecciona:
   - 📍 Tienda de recogida (radio: Alcobendas / Pozuelo)
   - 📅 Día (date picker, hoy +1 a +7, validado contra horarios de la tienda)
   - 🕘 Franja (radio: mañana / tarde)
   - 👤 Nombre (opcional, recomendado)
   - 📝 Notas (opcional)
3. `[Pedir por WhatsApp]` (botón verde, sticky en móvil) → valida (≥1 item + tienda + día) → construye texto → `window.location = 'https://wa.me/<numero>?text=<urlencoded>'`.

### Mensaje generado (ejemplo)

```
Hola Horno San Lorenzo 👋

Quería hacer un pedido:

• 2× Pan de pueblo (1 kg) — 6,50 €
• 1× Tarta de zanahoria — 18,00 €
• 6× Croissants de mantequilla — 9,00 €

Total estimado: 33,50 €

📍 Recogida: Tienda Pozuelo (Avda. Europa 28)
📅 Día: viernes 22/05/2026
🕘 Franja: mañana
👤 Nombre: Óscar Sánchez

¿Me confirmáis disponibilidad y hora exacta?
```

### Micro-copy crítico (bajo el botón)

> _Al pulsar se abre WhatsApp con el pedido escrito. El horno te confirma disponibilidad, precio final y hora exacta antes de prepararlo. Aún no estás comprando._

Blinda legalmente (no es contrato de compraventa) y reduce fricción mental.

### Edge cases

- **Carrito vacío:** "Tu pedido está vacío" + CTA `Ver catálogo`.
- **Items obsoletos en localStorage** (slug ya no existe): filtrar al cargar, mostrar aviso discreto.
- **Validación previa al WhatsApp:** mínimo 1 item + tienda + día. Resto opcional. Botón deshabilitado si falta algo, con tooltip explicativo.

### Funcionalidad excluida (intencional)

- Sin pasarela de pago, sin Stripe.
- Sin cuenta de usuario.
- Sin tracking del pedido (sucede 100% en WhatsApp).
- Sin sincronización entre dispositivos (solo localStorage).
- Sin mínimo de pedido, sin condicionar productos según tienda (decidido: KISS en demo).

## 8. Sistema visual — Warm Artisan

### Tokens de color

| Token           | Hex       | Uso                                              |
| --------------- | --------- | ------------------------------------------------ |
| `--bg-cream`    | `#f4ecdf` | Fondo primario (hero, secciones cálidas)         |
| `--bg-paper`    | `#fffdf8` | Fondo secundario (cards, contenido)              |
| `--ink`         | `#2b1d12` | Texto principal (contraste 12.5:1 sobre cream ✓) |
| `--ink-muted`   | `#6b4f3a` | Texto secundario                                 |
| `--accent`      | `#a07551` | Acento (links, iconos)                           |
| `--accent-dark` | `#7a5a3e` | Hover de acento                                  |
| `--hot`         | `#c9242a` | "Brasa" — **solo** promos/temporada/CTA urgente  |
| `--line`        | `#e6dccb` | Bordes sutiles                                   |
| `--wa`          | `#25D366` | **Solo** botón "Pedir por WhatsApp"              |
| `--success`     | `#5a7d3c` | Toast "añadido"                                  |

### Tipografía

- **Display + headings:** Fraunces Variable (italic en hero, regular en h2/h3) — Google Fonts, self-hosted via `@fontsource-variable/fraunces`.
- **Body + UI:** Inter Variable — self-hosted via `@fontsource-variable/inter`.

Tamaños base (mobile-first, escalan en `md:`):

| Estilo          | Mobile                                | Desktop     |
| --------------- | ------------------------------------- | ----------- |
| Display (hero)  | 40px / 1.0 / Fraunces italic          | 72px / 0.95 |
| H1              | 28px / 1.1 / Fraunces                 | 40px        |
| H2              | 22px / 1.2 / Fraunces                 | 28px        |
| H3              | 18px / 1.3 / Inter 600                | 20px        |
| Body            | 16px / 1.55 / Inter 400               | 17px        |
| Small           | 13px / 1.5 / Inter                    | 13px        |
| Label uppercase | 11px / Inter 600 / letter-spacing 3px | 11px        |

### Componentes visuales (reglas)

- **Radius:** 10–12px en cards, 999px (pill) en botones/badges. Ni cuadrado austero ni redondito de juguete.
- **Sombras:** suaves y cálidas (`shadow-stone-300/40`). Nunca azul.
- **Espaciado:** generoso. Secciones con `py-16` mobile / `py-24` desktop.
- **Hover:** scale 1.02 en cards, oscurecer en botones. Sin bounces ni rotaciones.
- **Imágenes:** full-bleed en hero, encuadre cercano en productos. `aspect-ratio` siempre seteado (evita CLS).

### Animaciones

- **Fade + slide-up** en cards al entrar en viewport (IntersectionObserver + `motion`).
- **Hover scale 1.02** en `ProductCard`.
- **Toast slide-in** desde abajo.
- **View transitions** nativas de Astro 5 entre páginas (header/footer persisten).
- **TODAS** respetan `prefers-reduced-motion: reduce` (desactivadas).

## 9. Modelo de contenido

### Content Collection: `src/content/products/*.md`

```yaml
---
slug: pan-de-pueblo
name: Pan de pueblo
category: panes # panes | bolleria | tartas | salado | temporada
priceCents: 325
unit: "500 g"
variants: # opcional
  - { id: "500g", label: "500 g", priceCents: 325 }
  - { id: "1kg", label: "1 kg", priceCents: 600 }
image: /images/productos/pan-de-pueblo.jpg
imageAlt: "Pan de pueblo recién horneado, partido por la mitad"
shortDescription: Masa madre, fermentación lenta de 18h. Corteza crujiente, miga alveolada.
allergens: [gluten] # gluten | huevo | leche | frutos-secos | soja | sesamo
featured: true # aparece en home
seasonal: false
order: 10
---
(cuerpo markdown — descripción extendida, elaboración, sugerencias)
```

**Catálogo demo (~20-22 productos):**

- Panes (6): pueblo, integral, candeal, hogaza, cereales, baguette
- Bollería (6): croissant mantequilla, napolitana chocolate, ensaimada, palmera, suizo, magdalena
- Tartas (5): zanahoria, queso, sacher, manzana, chocolate
- Salado (3): empanada gallega, quiche lorraine, hojaldre jamón y queso
- Temporada (2-3): roscón de Reyes, torrijas, panettone (con flag `seasonal: true`)

### Content Collection: `src/content/noticias/*.md`

```yaml
---
slug: roscon-reyes-2026
title: Roscón de Reyes 2026 — reservas abiertas
date: 2025-12-15
excerpt: Como cada año, pero mejor. Nata, trufa, crema o sin nada — tú eliges.
image: /images/noticias/roscon-2026.jpg
imageAlt: "Roscón de Reyes con nata, decorado con fruta escarchada"
tags: [temporada, navidad, reservas]
---
(cuerpo markdown — la noticia tal cual)
```

**Noticias demo (4-5):** Roscón Reyes 2026, San Valentín, Día del Padre (corbata de hojaldre), San Lorenzo (10-ago, patrón del horno), Navidad.

### `src/data/stores.ts`

```ts
export const stores = [
  {
    id: "alcobendas",
    name: "Central — Alcobendas",
    address: "C/ Valgrande 21, Nave 2-k, 28108 Alcobendas",
    phone: "916613932",
    email: "info@hornosanlorenzo.com",
    hoursText: "Lun–Sáb 7:00–14:00 · Dom cerrado",
    openDays: [1, 2, 3, 4, 5, 6], // 0=Sun ... 6=Sat
    mapsEmbed: "https://www.google.com/maps/embed?...",
    mapsLink: "https://maps.google.com/?q=...",
    coords: { lat: 40.5468, lng: -3.6394 },
    image: "/images/tiendas/alcobendas.jpg",
  },
  {
    id: "pozuelo",
    name: "Tienda Pozuelo",
    address:
      "Avda. Europa 28, entrada por C/ América, 28223 Pozuelo de Alarcón",
    phone: "916059056",
    email: "pasteleriapozuelo@hornosanlorenzo.com",
    hoursText: "Lun–Dom 8:00–14:30 y 17:00–20:30",
    openDays: [0, 1, 2, 3, 4, 5, 6],
    mapsEmbed: "...",
    mapsLink: "...",
    coords: { lat: 40.4378, lng: -3.809 },
    image: "/images/tiendas/pozuelo.jpg",
  },
] as const;
```

### `src/data/site.ts`

```ts
export const site = {
  name: "Horno San Lorenzo",
  tagline: "Pan de pueblo, hecho a mano. Desde 1986.",
  founded: 1986,
  url: import.meta.env.PUBLIC_SITE_URL,
  whatsapp: import.meta.env.PUBLIC_WHATSAPP_NUMBER, // formato wa.me, sin '+'
  social: {
    instagram: "https://instagram.com/hornosanlorenzo_1986",
    facebook: "https://facebook.com/hornosanlorenzo",
  },
  email: "info@hornosanlorenzo.com",
  ogImage: "/og-image.jpg",
};
```

### `src/data/services.ts`

```ts
export const services = [
  {
    id: "domicilio",
    title: "Servicio a domicilio",
    desc: "...",
    icon: "truck",
  },
  {
    id: "catering",
    title: "Catering para eventos",
    desc: "...",
    icon: "party",
  },
  {
    id: "horeca",
    title: "Distribución a hostelería",
    desc: "...",
    icon: "store",
  },
];
```

## 10. Componentes y frontera Astro/React

### Componentes Astro (servidor, cero JS)

```
src/layouts/
  BaseLayout.astro          ─ <head>, fonts, view transitions, ToastHost, CookieBanner
  MarketingLayout.astro     ─ BaseLayout + Header + Footer
  LegalLayout.astro         ─ BaseLayout + título + breadcrumb

src/components/
  Header.astro              ─ logo + nav + <CartBadge> (island)
  Footer.astro              ─ enlaces, redes, contacto, copyright
  SEO.astro                 ─ meta tags (title, description, og, twitter, JSON-LD)
  Hero.astro                ─ home hero full-bleed con CTA
  SectionLabel.astro        ─ "Nº 01 — Pan" labels
  PromoBanner.astro         ─ banner rojo brasa de temporada
  MapEmbed.astro            ─ iframe Google Maps + placeholder si cookies rechazadas
  ProductCard.astro         ─ tarjeta + <AddToCart> (island)
  StoreCard.astro           ─ info tienda + mapa
  ServiceCard.astro         ─ servicio (catering/hostelería/domicilio)
  NewsCard.astro            ─ tarjeta noticia
```

### Islas React (cliente)

```
src/islands/
  CartBadge.tsx
  AddToCart.tsx
  CategoryFilter.tsx
  CartPage.tsx
  ToastHost.tsx
  ContactForm.tsx
  CookieBanner.tsx
```

| Isla             | Directiva             | Justificación                                        |
| ---------------- | --------------------- | ---------------------------------------------------- |
| `CartBadge`      | `client:only="react"` | Lee de localStorage — SSR daría conteo 0 con flicker |
| `AddToCart`      | `client:visible`      | Botón inactivo hasta hidratar; barato                |
| `CategoryFilter` | `client:visible`      | Filtro `/catalogo`, sincroniza `?cat=panes` en URL   |
| `CartPage`       | `client:only="react"` | Página `/carrito` entera depende de localStorage     |
| `ToastHost`      | `client:load`         | Global, escucha eventos `'toast'`. Mínimo (~2KB)     |
| `ContactForm`    | `client:visible`      | Validación + mailto                                  |
| `CookieBanner`   | `client:idle`         | No bloquea LCP                                       |

**Total: 7 islas.** Resto = HTML estático.

### Estado del carrito

Sin Zustand / Redux / Context provider. Tres piezas:

```
src/lib/cart.ts                       ← funciones puras (load, save, add, remove, buildMessage)
src/lib/whatsapp.ts                   ← buildUrl, openWhatsApp
src/hooks/useCart.ts                  ← hook React: estado + escucha 'cart-update'
```

Cada mutación dispara `window.dispatchEvent(new CustomEvent('cart-update'))`. `CartBadge` y `CartPage` se re-renderizan. Bonus: `'storage'` listener sincroniza entre pestañas gratis.

## 11. SEO

- **Per-página:** title, description, canonical, og:title, og:description, og:image, twitter:card via componente `<SEO />`.
- **Structured data (JSON-LD):**
  - `Organization` site-wide en `BaseLayout`
  - `LocalBusiness` (type `Bakery`) — uno por tienda en `/tiendas` y home
  - `Product` en cada `/catalogo/[slug]`
  - `Article` en cada `/noticias/[slug]`
  - `BreadcrumbList` en páginas de detalle
- **Local SEO:** meta `geo.region` (ES-M), `geo.placename` por tienda, `ICBM` lat/long. `name`/`address`/`telephone` consistentes con (futuro) Google My Business.
- **Sitemap:** auto via `@astrojs/sitemap`.
- **robots.txt:** permite todo + `Sitemap:` URL.

## 12. Performance

### Targets Lighthouse mobile (4G simulado)

| Métrica        | Target              |
| -------------- | ------------------- |
| Performance    | ≥ 95                |
| Accessibility  | 100                 |
| Best Practices | 100                 |
| SEO            | 100                 |
| LCP            | < 1.5s              |
| CLS            | < 0.05              |
| TBT            | < 100ms             |
| JS Home        | < 15 KB transferido |
| JS `/carrito`  | < 50 KB transferido |

### Tácticas

- Astro `<Image>` → AVIF + WebP responsive (srcset por densidad y breakpoint)
- Fonts self-hosted (`@fontsource-variable/*`) con `font-display: swap` + `size-adjust`
- CSS crítico inline (Astro default)
- `<link rel="preload">` para el hero image (LCP)
- Imágenes con `width`/`height` siempre (evita CLS)
- View transitions Astro 5 (sin coste extra de JS)
- `motion` tree-shaken (~3KB)
- Lazy-load iframes (Maps) con `loading="lazy"`

## 13. Accesibilidad (WCAG 2.2 AA)

- Contraste verificado: Espresso `#2b1d12` sobre Cream `#f4ecdf` = **12.5:1** ✓
- `lang="es"` en `<html>`
- Skip-to-content link (primer focusable)
- Landmarks semánticos (`<header>`, `<nav>`, `<main>`, `<footer>`)
- Focus rings visibles — no eliminamos outlines
- `<label>` asociado a cada input
- `alt` en todas las imágenes (vacío `""` si decorativa)
- `aria-label` en botones icon-only
- `prefers-reduced-motion: reduce` respetado
- Tap targets ≥ 44×44px en móvil

## 14. Cookies y legal

### Cookie banner (LSSI España)

- Banner inferior en primer load (sticky bottom, mobile-friendly): **Aceptar / Rechazar / Más info**
- Decisión en `localStorage` (`hsl-cookie-consent` = `'accepted' | 'rejected'`)
- Si **rechaza** → no se cargan iframes de Google Maps; se muestra placeholder con texto "Acepta cookies para ver el mapa, o [cómo llegar →]" que enlaza a Google Maps en pestaña externa.
- Vercel Analytics es first-party + sin cookies → no requiere consent.
- `/legal/cookies` explica qué se usa y por qué.

### Páginas legales

Plantillas estándar con placeholders para datos legales (razón social, CIF) — a rellenar cuando firmen contrato.

- `/legal/aviso-legal` — datos del titular, condiciones de uso
- `/legal/privacidad` — datos del formulario de contacto, base legal (consentimiento), retención, derechos GDPR
- `/legal/cookies` — técnicas (estrictamente necesarias) + Vercel Analytics (sin cookies, first-party) + Google Maps (terceros, requiere consent)

## 15. Analytics

- **Vercel Analytics** vía `@vercel/analytics/astro`
- Cero cookies, GDPR-friendly
- No requiere banner
- Dashboard en Vercel sirve para enseñar tráfico en directo durante la demo ("mirad qué fácil ver datos")

## 16. Deployment

### Variables de entorno (Vercel dashboard)

```
PUBLIC_WHATSAPP_NUMBER=34666XXXXXX        # nº de Óscar (formato wa.me, sin '+')
PUBLIC_SITE_URL=https://hornosanlorenzo-demo.vercel.app
```

### Build & deploy

```bash
pnpm install
pnpm build               # Astro genera /dist estático
vercel deploy --prod     # o autodeploy en push a main
```

- **Hosting:** Vercel Hobby (gratis)
- **Dominio:** `hornosanlorenzo-demo.vercel.app` (o personalizado opcional)
- **Preview deploys** por rama (GitHub conectado)
- **Sin password protection** (decisión Q7-B — WhatsApp dirigido a Óscar, riesgo cero)
- **Repo GitHub:** privado, `oscarsr96/hornosanlorenzo-demo`
- **Git author email:** `oscarsr96@hotmail.com` (requisito del team Vercel `oscarsr96s-projects`)

### CI

No hay GitHub Actions; los preview deploys de Vercel hacen smoke check al build. Para la demo es suficiente.

## 17. Estructura del repo

```
hornosanlorenzo/
├── .env.example
├── .gitignore
├── astro.config.mjs
├── tailwind.config.ts            (o config inline via @tailwindcss/vite)
├── package.json
├── tsconfig.json
├── README.md
├── public/
│   ├── images/{productos,noticias,tiendas,hero,og}/
│   ├── favicon.svg
│   └── robots.txt
├── docs/
│   └── superpowers/specs/2026-05-19-hornosanlorenzo-demo-design.md  ← este doc
└── src/
    ├── content/
    │   ├── config.ts             ← Zod schemas
    │   ├── products/*.md         (~20 productos)
    │   └── noticias/*.md         (~5 noticias)
    ├── data/
    │   ├── site.ts
    │   ├── stores.ts
    │   └── services.ts
    ├── layouts/
    │   ├── BaseLayout.astro
    │   ├── MarketingLayout.astro
    │   └── LegalLayout.astro
    ├── components/               (Astro, server-rendered)
    ├── islands/                  (React, client)
    │   ├── CartBadge.tsx
    │   ├── AddToCart.tsx
    │   ├── CategoryFilter.tsx
    │   ├── CartPage.tsx
    │   ├── ToastHost.tsx
    │   ├── ContactForm.tsx
    │   └── CookieBanner.tsx
    ├── lib/
    │   ├── cart.ts
    │   ├── whatsapp.ts
    │   └── format.ts             ← formatPrice, formatDate
    ├── hooks/useCart.ts
    ├── styles/global.css         ← @theme tokens + base
    └── pages/                    ← rutas
```

## 18. Definición de "hecho"

La demo está lista para presentar cuando:

1. Las 11 rutas estáticas + 2 dinámicas renderizan sin errores
2. El catálogo tiene ≥20 productos con imágenes reales (Unsplash) y descripciones plausibles
3. El flujo carrito → WhatsApp funciona en móvil real (probado en iPhone + Android)
4. Lighthouse mobile en home ≥ 95 / 100 / 100 / 100
5. La web pasa axe-core sin errores críticos
6. Cookie banner funcional + páginas legales presentes
7. Deploy en `hornosanlorenzo-demo.vercel.app` accesible
8. Vercel Analytics enviando eventos
9. README.md con instrucciones de cómo correr local y cómo desplegar

## 19. Riesgos y mitigaciones

| Riesgo                                             | Mitigación                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cliente nota que las fotos no son suyas            | Etiqueta "Fotos representativas" pequeña en footer demo. Mencionar en la presentación: "estas fotos las sustituimos por las vuestras cuando firmemos". |
| Cliente pide cambios visuales en la propia reunión | Los tokens están en `--variables CSS` → cambios rápidos en `global.css`. Demostrar agilidad es parte del pitch.                                        |
| Pedido WhatsApp llega vacío o roto en la demo      | Probar exhaustivamente antes. Tener un `fallback` si `wa.me` no abre (link de copia al portapapeles + abre `mailto:`).                                 |
| Performance no llega al objetivo                   | Auditar con Chrome DevTools Performance antes de presentar. El stack elegido (Astro estático) hace casi imposible bajar de 90.                         |
| Dominio `hornosanlorenzo-demo.vercel.app` ocupado  | Plan B: `horno-san-lorenzo.vercel.app` o `hsl-demo.vercel.app`.                                                                                        |

## 20. Pasos siguientes

1. Aprobar este spec.
2. Generar plan de implementación detallado (writing-plans skill).
3. Ejecutar plan en sub-agents paralelos por componente.
4. Sesión de QA manual (Lighthouse + axe + flujo móvil real).
5. Deploy a Vercel + verificar Analytics.
6. Preparar la presentación al cliente.
