# Plan de Implementación: Promoción Social Verificable

## Estado del documento

Este archivo conserva el diseño y alcance funcional de la feature.

Implementación real a la fecha:

- ya existe soporte operativo en `Facebook`, `Instagram` y `X`;
- `Threads` sigue contemplado en diseño y contratos, pero no fue validado manualmente aún;
- el sistema ya persiste snapshots de métricas visibles en base de datos;
- el procesamiento corre en un `social-worker` separado;
- los refunds completos de compras bonificadas ya revierten el grant a `AVAILABLE`;
- los refunds parciales no revierten el grant;
- el admin ya cuenta con un log explícito de `REVERSION_BONIFICACION_PROMOCIONAL`;
- la documentación de estado actual vive en [social-promotions-implementation.md](./social-promotions-implementation.md).

## Resumen

Este documento define una futura feature para que un vendedor publique manualmente una rifa en redes sociales, comparta el `permalink` en Luk y el backend pueda:

- validar que la publicación existe;
- verificar que siga pública durante toda la duración de la rifa;
- capturar métricas públicas visibles;
- calcular un score promocional;
- convertir ese score en una `bonificación promocional` aplicable a una compra futura dentro de Luk.

La implementación debe incluir `Facebook`, `Instagram`, `X` y `Threads`.

En `Facebook` e `Instagram` personales no se usarán APIs oficiales en v1. La validación y lectura de métricas se hará a partir del `permalink público` y del contenido visible públicamente.

## Condición de trabajo: tests primero

Antes de implementar la feature real, se debe construir primero la capa de testing y validación automatizada. El orden obligatorio del trabajo será:

1. Contratos, fixtures y utilidades de test.
2. Tests unitarios.
3. Tests de integración.
4. Tests end-to-end del flujo principal.
5. Recién después, implementación productiva.

Esto no es opcional. La feature no debe empezar por código de negocio en producción sin que primero existan los tests que definan el comportamiento esperado.

## Objetivo de producto

Permitir promoción orgánica verificable sin depender de OAuth social ni de APIs oficiales de Meta/X en v1.

El flujo esperado es:

1. El vendedor entra a una rifa propia activa.
2. Presiona `Promocionar rifa`.
3. Elige red social.
4. Luk genera:
   - un `trackingUrl`;
   - un `promotionToken`;
   - un texto sugerido.
5. El vendedor publica manualmente en la red elegida.
6. El vendedor pega el `permalink` del post en Luk.
7. Luk valida el post.
8. Mientras la rifa sigue activa, Luk monitorea si el post sigue accesible y captura métricas públicas visibles.
9. Al cierre de la rifa, Luk liquida el score final.
10. Si corresponde, Luk genera una `bonificación promocional` para una compra futura.

## Estados del post promocional

- `PENDING_VALIDATION`: el usuario ya envió el permalink, pero todavía no terminó la validación inicial.
- `ACTIVE`: el post pasó la validación inicial y entra en monitoreo.
- `TECHNICAL_REVIEW`: hubo un fallo técnico o una lectura ambigua; no hay evidencia suficiente para descalificar.
- `DISQUALIFIED`: el post dejó de cumplir las reglas del programa.
- `SETTLED`: la rifa cerró y el score/beneficio del post ya fue resuelto.

## Reglas de elegibilidad

Para que un post califique:

- Debe ser público y permanecer accesible durante toda la rifa.
- Debe tener un `permalink` estable.
- Debe contener el `trackingUrl` o `promotionToken` generado por Luk.
- Debe ser una publicación persistente.
- Debe ser una publicación original.
- Debe presentarse en Luk dentro de las `24 horas` posteriores a la publicación.

No califican:

- stories;
- contenido efímero;
- cuentas privadas;
- grupos privados;
- publicaciones de terceros;
- posts sin permalink estable;
- posts donde no se pueda verificar el token o link de Luk.

Si el post se borra, se vuelve privado, cambia de URL o elimina el token/link de Luk antes del cierre de la rifa, pasa a `DISQUALIFIED`.

## Redes soportadas en v1

- Facebook
- Instagram
- X
- Threads

### Formatos elegibles en v1

- Facebook: post público de feed.
- Instagram: post o reel público.
- X: post público.
- Threads: post público.

## Qué se medirá

En v1 se medirá solo lo visible públicamente desde el permalink.

Métricas candidatas:

- `likesCount`
- `commentsCount`
- `repostsOrSharesCount`
- `viewsCount`
- `clicksAttributed`
- `registrationsAttributed`
- `ticketPurchasesAttributed`

No se promete obtener:

- reach;
- impressions internas;
- saves;
- métricas privadas de la red;
- identidad garantizada del dueño del perfil por vía oficial.

## Cómo se obtienen las métricas

Las métricas de esta feature salen de dos fuentes distintas:

### 1. Métricas públicas de la red social

Estas se obtienen abriendo el `permalink` del post como visitante público, sin login y sin usar API oficial de la red en v1.

El proceso será:

1. El vendedor publica manualmente.
2. El vendedor pega el permalink en Luk.
3. El backend crea el registro en `PENDING_VALIDATION`.
4. Un validador intenta acceder a esa URL.
5. Si la página carga correctamente:
   - detecta la red social;
   - canonicaliza la URL;
   - verifica que el post exista;
   - verifica que siga siendo público;
   - verifica que el `trackingUrl` o `promotionToken` de Luk esté presente;
   - intenta extraer las métricas visibles.
6. El resultado se guarda como snapshot.
7. Luego el cron repite el mismo proceso durante la vida de la rifa.

Para hacer esto, la implementación v1 debe usar dos capas:

- intento simple por `fetch` del HTML público;
- fallback a `headless browser` cuando la red renderiza contenido con JavaScript o el HTML simple no alcanza.

No se deben usar cookies de usuario ni sesiones autenticadas en redes sociales para esta feature.

### 2. Métricas propias de Luk

Estas no salen de la red social. Salen del sistema de tracking interno de Luk.

El proceso será:

1. Luk genera un `trackingUrl` único por draft/post promocional.
2. Ese link viaja dentro de la publicación del vendedor.
3. Cuando alguien hace click, Luk registra:
   - el click;
   - la visita atribuida;
   - el eventual registro;
   - la eventual compra de tickets.

Estas métricas son las más confiables del sistema porque no dependen de la red social.

## Qué puede aportar cada red en v1

Lo que sigue es `aspirable`, no garantizado al 100%, porque depende de que la red muestre esas métricas públicamente en ese momento y en ese formato.

### Facebook

Se puede aspirar a obtener:

- existencia del post;
- accesibilidad pública;
- caption/texto visible;
- reacciones visibles;
- comentarios visibles;
- shares visibles, si Facebook los muestra en ese post;
- views, solo en algunos videos si están visibles.

Limitaciones importantes:

- en perfiles personales puede ser inconsistente;
- algunas publicaciones públicas igual pueden mostrar fricción de acceso;
- algunas métricas pueden no aparecer visibles.

### Instagram

Se puede aspirar a obtener:

- existencia del post o reel;
- accesibilidad pública;
- caption visible;
- comentarios visibles;
- likes, solo si están visibles públicamente;
- plays/views en reels, si Instagram los muestra.

Limitaciones importantes:

- no contar con shares públicos confiables;
- no contar con saves;
- no contar con métricas de stories;
- likes pueden estar ocultos.

### X

Se puede aspirar a obtener:

- existencia del post;
- accesibilidad pública;
- texto visible;
- likes;
- replies;
- reposts;
- quotes, si están visibles;
- views, si la UI pública las expone.

Limitaciones importantes:

- algunas métricas pueden variar según UI o cambios del sitio;
- bookmarks no son públicos.

### Threads

Se puede aspirar a obtener:

- existencia del post;
- accesibilidad pública;
- texto visible;
- likes;
- replies;
- reposts/requotes, si están visibles;
- algunas views, si la interfaz pública las expone.

Limitaciones importantes:

- menor estabilidad histórica de la UI pública;
- algunas métricas pueden no estar visibles siempre.

## Separación explícita de métricas

Para el score y para el modelo mental del sistema, hay que separar siempre:

### Métricas de red social

- `likesCount`
- `commentsCount`
- `repostsOrSharesCount`
- `viewsCount`

### Métricas propias de Luk

- `clicksAttributed`
- `registrationsAttributed`
- `ticketPurchasesAttributed`

La implementación y el scoring no deben mezclar ambas fuentes como si fueran equivalentes. Las métricas sociales son señales públicas y frágiles; las métricas de Luk son señales internas y mucho más confiables.

## Score promocional

El score final debe tener tres componentes:

1. `baseScore`
   - por haber mantenido el post válido hasta el cierre.
2. `engagementScore`
   - por métricas públicas visibles.
3. `conversionScore`
   - por tráfico y conversiones reales dentro de Luk.

La conversión atribuida debe tener más peso que los likes o comentarios.

## Bonificación promocional

El score no se convierte en dinero retirable ni en una billetera abierta. Se convierte en una `bonificación promocional` con estas reglas:

- solo usable dentro de Luk;
- no transferible;
- no retirable;
- aplicable a una sola compra futura;
- solo para rifas de otros vendedores;
- con fecha de vencimiento;
- con tope máximo de descuento.

## Checkout y Mercado Pago

### Decisión principal

La bonificación promocional reduce el monto que se envía a Mercado Pago, pero el vendedor no absorbe ese descuento. Luk subsidia el descuento.

### Flujo

1. El usuario elige una bonificación disponible en checkout.
2. El backend calcula:
   - `grossSubtotal`
   - `discountApplied`
   - `mpChargeAmount`
3. El backend crea una reserva de la bonificación.
4. El backend genera la `Preference` de Mercado Pago por `mpChargeAmount`.
5. Si Mercado Pago aprueba el pago:
   - se consumen los tickets;
   - se marca la bonificación como usada;
   - se registra el subsidio promocional.
6. Si el pago falla o vence:
   - se libera la bonificación;
   - se libera la reserva de compra según el flujo actual.

### Refunds y robustez

Implementación actual:

- refund completo:
  - la `redemption` pasa a `REVERSED`;
  - el grant vuelve a `AVAILABLE`;
  - se registra una transacción `REVERSION_BONIFICACION_PROMOCIONAL`.
- refund parcial:
  - el grant no vuelve;
  - la `redemption` permanece `USED`.

Esto evita devolver un beneficio entero cuando el reembolso fue solo parcial.

### Implicancia contable

Debe quedar separado:

- el valor nominal de la compra;
- el monto descontado por Luk;
- el monto efectivamente cobrado por Mercado Pago.

El payout al vendedor debe seguir calculándose sobre el valor nominal de los tickets, y la diferencia debe registrarse como gasto promocional de plataforma.

## Autenticación y autorización

### Autenticación

Todas las operaciones de esta feature deben requerir usuario autenticado con `JWT`.

### Autorización

Solo el dueño de la rifa puede:

- iniciar un draft promocional;
- enviar el permalink;
- ver el detalle completo de sus propios posts promocionales.

Solo el dueño de una bonificación puede:

- verla;
- previsualizarla;
- aplicarla en checkout.

Solo un `ADMIN` puede:

- revisar casos en `TECHNICAL_REVIEW`;
- descalificar manualmente;
- aprobar manualmente si corresponde;
- revertir bonificaciones;
- ajustar parámetros del programa;
- pausar una red si el parser falla.

## Diseño técnico

### Backend

Crear un módulo nuevo: `social-promotions`.

Debe exponer GraphQL y seguir el mismo patrón del backend actual:

- resolver;
- service;
- entities;
- tests.

### Nuevas operaciones GraphQL

- `startSocialPromotionDraft(raffleId, network)`
- `submitSocialPromotionPost(draftId, permalink)`
- `mySocialPromotionPosts(raffleId?)`
- `myPromotionBonusGrants(status?)`
- `previewPromotionBonus(raffleId, cantidad, bonusGrantId)`
- extensión de `buyTickets(raffleId, cantidad, bonusGrantId?)`

### Nuevos modelos

#### `SocialPromotionDraft`

- `id`
- `raffleId`
- `sellerId`
- `network`
- `trackingUrl`
- `promotionToken`
- `suggestedCopy`
- `expiresAt`
- `createdAt`

#### `SocialPromotionPost`

- `id`
- `draftId`
- `raffleId`
- `sellerId`
- `network`
- `submittedPermalink`
- `canonicalPermalink`
- `canonicalPostId`
- `status`
- `publishedAt`
- `submittedAt`
- `validatedAt`
- `disqualifiedAt`
- `disqualificationReason`
- `lastCheckedAt`
- `nextCheckAt`

#### `SocialPromotionMetricSnapshot`

- `id`
- `socialPromotionPostId`
- `checkedAt`
- `isAccessible`
- `tokenPresent`
- `likesCount`
- `commentsCount`
- `repostsOrSharesCount`
- `viewsCount`
- `clicksAttributed`
- `registrationsAttributed`
- `ticketPurchasesAttributed`
- `rawEvidenceMeta`
- `parserVersion`
- `failureReason`

#### `PromotionScoreSettlement`

- `id`
- `socialPromotionPostId`
- `sellerId`
- `raffleId`
- `baseScore`
- `engagementScore`
- `conversionScore`
- `totalScore`
- `settledAt`
- `settlementStatus`

#### `PromotionBonusGrant`

- `id`
- `sellerId`
- `sourceSettlementId`
- `discountPercent`
- `maxDiscountAmount`
- `expiresAt`
- `status`
- `createdAt`
- `usedAt`

#### `PromotionBonusRedemption`

- `id`
- `promotionBonusGrantId`
- `buyerId`
- `raffleId`
- `reservationId`
- `grossSubtotal`
- `discountApplied`
- `mpChargeAmount`
- `mpPaymentId`
- `status`
- `createdAt`
- `resolvedAt`

### Ajustes a modelos existentes

- extender `TransactionType` para incluir subsidio promocional;
- agregar a `Transaction` campos explícitos para:
  - `grossAmount`
  - `promotionDiscountAmount`
  - `cashChargedAmount`
- agregar a `Payout` un campo para reflejar subsidio promocional de plataforma.

No reutilizar saldos o créditos de otros programas; la promoción social debe tener su propio ciclo de bonus.

## Validación y monitoreo

### Validación inicial

Al recibir un permalink, el backend debe validar:

- que el usuario sea dueño de la rifa;
- que la rifa esté activa;
- que la red sea válida;
- que no exista ya otro post para esa red y rifa;
- que la URL sea válida y canonicalizable;
- que el post exista;
- que sea público;
- que el token o link de Luk esté presente.

### Monitoreo periódico

Debe existir un cron nuevo con chequeo cada `6 horas`.

En cada chequeo se debe:

- volver a intentar acceder al permalink;
- confirmar que el post siga público;
- confirmar que el token o link siga presente;
- extraer métricas visibles;
- guardar un snapshot.

Si hay problema técnico de parser, timeout o inconsistencia temporal:

- pasar a `TECHNICAL_REVIEW`;
- reintentar luego.

Si hay problema de negocio confirmado:

- pasar a `DISQUALIFIED`.

Al cierre de la rifa:

- hacer un chequeo final;
- calcular el score;
- emitir `PromotionScoreSettlement`;
- generar `PromotionBonusGrant` si corresponde.

## Testing primero: detalle obligatorio

### Fase 1: fixtures y utilidades de prueba

Construir antes que nada:

- HTML fixtures representativos de posts públicos por red;
- fixtures de posts válidos, borrados, privados e inválidos;
- helpers para parsear métricas visibles;
- factories para drafts, posts, snapshots, grants y redemptions;
- mocks de Mercado Pago para compras con bonificación;
- utilidades para simular cron y cierre de rifa.

### Fase 2: tests unitarios

Crear tests unitarios para:

- canonicalización de URLs;
- detección de red social;
- verificación de token/link;
- extracción de métricas por red;
- transición de estados;
- cálculo de score;
- expiración de grants;
- cálculo de bonificación;
- validaciones de ownership y autorización.

### Fase 3: tests de integración

Crear tests de integración para:

- mutation `startSocialPromotionDraft`;
- mutation `submitSocialPromotionPost`;
- flujo de validación inicial;
- cron de monitoreo;
- generación de settlement;
- emisión de bonificación;
- aplicación de bonificación en `buyTickets`;
- webhook de Mercado Pago con compra bonificada;
- reversión de bonificación si el pago falla o se reembolsa.
- validación explícita de que refund total devuelve el grant y refund parcial no lo devuelve.

### Fase 4: tests end-to-end

Crear tests E2E para:

- seller publica y registra un post válido;
- el post se monitorea correctamente;
- el post se descalifica al borrarse o privatizarse;
- seller obtiene una bonificación al cierre;
- buyer usa la bonificación en checkout;
- el sistema no permite usar la bonificación en una rifa propia.

### Regla de implementación

No se debe implementar la lógica final de producción hasta que:

- existan los fixtures;
- existan tests rojos que describan el comportamiento esperado;
- esté definido el contrato de estados, score y redención;
- esté modelada la contabilidad con Mercado Pago.

## Credenciales y API keys necesarias

## Mercado Pago

Para esta feature, Mercado Pago sí sigue siendo obligatorio.

### Variables necesarias

Backend:

- `MP_ACCESS_TOKEN`
- `MP_CLIENT_ID`
- `MP_CLIENT_SECRET`
- `MP_WEBHOOK_SECRET`

Frontend:

- no se requiere una clave pública adicional de Mercado Pago en el frontend para la integración actual.

### Para qué sirve cada una

- `MP_ACCESS_TOKEN`: crear preferences, consultar pagos, operar con la API.
- `MP_CLIENT_ID`: OAuth/Connect de sellers.
- `MP_CLIENT_SECRET`: OAuth/Connect de sellers.
- `MP_WEBHOOK_SECRET`: validar firma de notificaciones.

### Cómo obtenerlas

1. Entrar a Mercado Pago Developers.
2. Ir a `Tus integraciones`.
3. Crear o abrir la aplicación existente.
4. Obtener credenciales de test y de producción.
5. Obtener `Client ID` y `Client Secret`.
6. Configurar webhooks/notificaciones.
7. Guardar el secreto de firma.

Referencias oficiales:

- https://beta.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/credentials
- https://www.mercadopago.com.uy/developers/es/docs/checkout-pro/create-application
- https://www.mercadopago.com.ar/developers/panel/app
- https://beta.mercadopago.com.co/developers/es/docs/checkout-pro/best-practices/credentials-best-practices/secure-credentials

## Meta y X

### v1

No se requieren API keys oficiales de:

- Meta / Facebook / Instagram
- X
- Threads

porque en v1 la validación será por `permalink público` y parsing del contenido visible públicamente.

### Futuro opcional

Si más adelante se quisiera migrar parte del sistema a APIs oficiales:

- Meta requerirá `App ID`, `App Secret`, permisos y probablemente review del app.
- X requerirá cuenta developer, billing y credenciales de app.

Referencias oficiales:

- Meta permissions: https://developers.facebook.com/docs/permissions
- Instagram content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
- Instagram insights: https://developers.facebook.com/docs/instagram-platform/insights
- X getting access: https://docs.x.com/x-api/getting-started/getting-access
- X apps: https://docs.x.com/fundamentals/developer-apps
- X pricing: https://docs.x.com/x-api/getting-started/pricing

## Variables de entorno nuevas

Backend:

- `SOCIAL_PROMOTION_ENABLED=true`
- `SOCIAL_PROMOTION_ALLOWED_NETWORKS=facebook,instagram,x,threads`
- `SOCIAL_PROMOTION_CHECK_CRON=0 */6 * * *`
- `SOCIAL_PROMOTION_FETCH_TIMEOUT_MS=30000`
- `SOCIAL_PROMOTION_MIN_MP_CHARGE=1`
- `SOCIAL_PROMOTION_TOKEN_TTL_HOURS=24`
- `SOCIAL_PROMOTION_DEFAULT_BONUS_TIER_JSON=...`

Opcionales para una fase posterior:

- `SOCIAL_PROMOTION_RENDERER_URL=`
- `SOCIAL_PROMOTION_RENDERER_TOKEN=`

## Cambios legales y de compliance

Se deben actualizar:

- términos y condiciones;
- política de privacidad;
- copy legal del producto.

Debe quedar claro que:

- Luk monitorea publicaciones públicas;
- la bonificación promocional no es dinero ni saldo retirable;
- el beneficio solo se usa dentro de Luk;
- las métricas capturadas son públicas y visibles.

Además, se debe revisar el wording actual que prohíbe o desalienta hablar de “créditos” para no entrar en contradicción con esta feature. La UI debe usar el término `bonificación promocional`.

## Riesgos aceptados

- Facebook e Instagram personales son más frágiles sin APIs oficiales.
- El HTML público de las redes puede cambiar.
- Algunas métricas visibles pueden desaparecer o ser inconsistentes.
- La bonificación promocional exige contabilidad clara para no distorsionar payouts.
- Esta feature requerirá observabilidad y revisión manual inicial en casos grises.

## Criterios de aceptación

- El vendedor puede registrar un post público válido de Facebook, Instagram, X o Threads.
- El sistema puede verificar que siga público durante la rifa.
- El sistema captura métricas públicas visibles cuando están disponibles.
- El sistema descalifica un post si deja de cumplir las reglas.
- El sistema liquida score al cierre.
- El sistema emite una bonificación promocional si corresponde.
- El usuario puede usar la bonificación en una compra futura de una rifa ajena.
- Mercado Pago cobra el total descontado.
- El payout al vendedor se calcula sobre valor nominal y el subsidio queda registrado.
- La implementación final se hace solo después de que exista la base completa de tests.
