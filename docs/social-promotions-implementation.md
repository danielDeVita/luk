# Social Promotions: Estado Actual

## Resumen

La feature de promoción social verificable ya está implementada en el proyecto.

Hoy permite:

- generar drafts promocionales por rifa;
- publicar manualmente en redes sociales;
- registrar el `permalink` del post;
- validar que el post siga público;
- guardar snapshots de métricas visibles;
- atribuir clicks, registros y compras dentro de Luk;
- emitir bonificaciones promocionales para compras futuras.
- notificar activamente por email e in-app cuando se emite una bonificación.
- revertir grants cuando una compra bonificada recibe un refund completo.

## Redes con validación real comprobada

- `Facebook`
- `Instagram`
- `X`

`Threads` sigue soportado a nivel de contratos, UI y parser, pero todavía no fue probado manualmente en este entorno.

## Arquitectura real

La solución corre en dos procesos:

### Backend

Responsable de:

- GraphQL y endpoints REST;
- creación de drafts promocionales;
- registro de permalinks;
- lectura de posts y snapshots para la UI;
- integración de bonificaciones con checkout y Mercado Pago;
- persistencia de métricas atribuidas dentro de Luk.

### Social Worker

Proceso separado, sin endpoints públicos.

Responsable de:

- validar posts pendientes;
- volver a chequear posts activos;
- usar `fetch` y fallback a Playwright cuando hace falta;
- guardar snapshots;
- liquidar promociones cerradas y emitir bonificaciones.

## Estrategia de validación

Por cada post promocional:

1. se intenta cargar el contenido público con `fetch`;
2. si el HTML no alcanza o no aparecen métricas visibles, se reintenta con `Playwright`;
3. el parser evalúa:
   - accesibilidad pública,
   - presencia del `trackingUrl` o `promotionToken`,
   - métricas visibles;
4. se guarda un snapshot en base de datos.

## Métricas persistidas

Las métricas viven en `SocialPromotionMetricSnapshot` y se guardan por chequeo.

Campos principales:

- `likesCount`
- `commentsCount`
- `repostsOrSharesCount`
- `viewsCount`
- `isAccessible`
- `tokenPresent`
- `failureReason`
- `rawEvidenceMeta`
- `clicksAttributed`
- `registrationsAttributed`
- `ticketPurchasesAttributed`

El estado operativo del post vive en `SocialPromotionPost`.

Campos clave:

- `status`
- `canonicalPermalink`
- `lastCheckedAt`
- `nextCheckAt`
- `validatedAt`
- `disqualificationReason`

## Estados activos

- `PENDING_VALIDATION`
- `ACTIVE`
- `TECHNICAL_REVIEW`
- `DISQUALIFIED`
- `SETTLED`

## Qué ya funciona bien

- seller CTA `Promocionar y medir`
- flujo de draft + permalink
- assets descargables para publicaciones sociales
- soporte visual especial para Instagram
- métricas visibles en seller dashboard
- revalidación manual y automática por worker
- extracción bilingüe de señales visibles en español e inglés
- notificación activa al seller cuando gana un grant
- reversión robusta de grants en refunds completos
- no reversión de grants en refunds parciales
- log admin explícito de reversiones de grants

## Reversión de grants por refund

Cuando una compra usó una `bonificación promocional`:

- si el pago recibe un `refund completo`, el grant vuelve a `AVAILABLE`;
- la `redemption` pasa a `REVERSED`;
- se crea una transacción contable `REVERSION_BONIFICACION_PROMOCIONAL`;
- el admin puede auditar esa reversión desde `/admin`, en la pestaña `Promoción Social`.

Si el refund es parcial:

- el grant no vuelve;
- la `redemption` permanece `USED`;
- no se genera reversión del beneficio.

El log admin de reversiones muestra:

- comprador;
- rifa;
- monto del grant devuelto;
- monto del refund;
- `mpPaymentId`;
- `grantId`;
- `redemptionId`;
- tipo de refund.

## Limitaciones actuales

- se usan señales públicas, no métricas internas oficiales de las redes;
- `Threads` aún no fue validado manualmente;
- `X` y `Facebook` pueden exigir Playwright para conseguir métricas visibles;
- algunas métricas pueden seguir viniendo como `null` si la red no las expone públicamente;
- el admin muestra cola de `TECHNICAL_REVIEW` y log de reversiones, pero no un historial completo de todos los posts promocionales.

## Comandos útiles

Ver [COMMANDS.md](../COMMANDS.md), especialmente la sección `Social Promotions Debugging`.
