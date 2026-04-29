# LUK Domain Flows

Este documento explica los flujos de negocio más importantes de LUK y cómo se conectan entre módulos. No reemplaza al código ni al schema GraphQL: sirve para entender estados, transiciones e invariantes.

## Archivos clave

- `backend/src/auth/auth.service.ts`
- `backend/src/tickets/tickets.service.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/raffles/raffles.service.ts`
- `backend/src/disputes/disputes.service.ts`
- `backend/src/payouts/payouts.service.ts`
- `backend/src/tasks/raffle-tasks.service.ts`
- `backend/src/social-promotions/social-promotions.service.ts`
- `backend/prisma/schema.prisma`

## 1. Auth y activación de cuenta

### Registro

1. `register` crea el usuario con `emailVerified = false`.
2. Se genera un código de verificación de 6 dígitos con vencimiento corto.
3. La respuesta devuelve `requiresVerification = true`.

### Verificación de email

1. `verifyEmail` valida que el código exista, no esté usado y no haya expirado.
2. Si el código es válido:
   - marca el código como usado;
   - marca el usuario como verificado;
   - envía notificaciones de bienvenida;
   - si llegó `promotionToken`, registra atribución de social promotion.
3. Recién ahí se emiten `accessToken` y `refreshToken`.

### Login

1. Busca usuario por email.
2. Bloquea cuentas borradas, baneadas o creadas sólo con Google.
3. Valida password.
4. Si las credenciales son válidas, el login puede terminar en tres salidas:
   - `requiresVerification = true` si el usuario todavía no verificó su email;
   - `requiresTwoFactor = true` + `twoFactorChallengeToken` si el usuario tiene 2FA activo;
   - emisión directa de tokens si no hay pasos pendientes.
5. Cuando no hay bloqueos adicionales:
   - limpia intentos fallidos por IP;
   - emite nuevos tokens;
   - registra actividad de login.

El login con email/contraseña bloquea explícitamente a usuarios con `emailVerified = false` y reanuda el paso de verificación de email. Google OAuth se considera una fuente confiable de verificación y marca el email como verificado.

### Login con email no verificado

1. El backend devuelve `requiresVerification = true`.
2. El frontend reanuda inline el paso de verificación sin obligar al usuario a volver al registro.
3. `verifyEmail` sigue siendo el paso que emite `accessToken` y `refreshToken`.

### Login con 2FA

1. Si el usuario ya activó 2FA, el backend devuelve `requiresTwoFactor = true` y `twoFactorChallengeToken`.
2. El frontend pasa a un paso inline de segundo factor.
3. `completeTwoFactorLogin` acepta:
   - código TOTP de la app autenticadora; o
   - `recoveryCode`.
4. Recién cuando ese paso se valida se emiten `accessToken` y `refreshToken`.

### Activación y desactivación de 2FA

1. Desde configuración de cuenta, el usuario puede iniciar un setup de 2FA.
2. El setup devuelve secreto, QR y `setupToken`.
3. La activación exige confirmar con un código TOTP válido.
4. Al activarse, se generan recovery codes de un solo uso.
5. La desactivación exige password actual y además:
   - un código TOTP válido; o
   - un recovery code válido.
6. Activar 2FA, desactivarlo o ingresar con un recovery code dispara alertas de seguridad por email e in-app.

## 2. Preconditions para crear una rifa

Un seller sólo puede crear una rifa si cumple todo esto:

- `sellerPaymentAccountStatus = CONNECTED`
- tiene dirección de envío configurada
- `kycStatus = VERIFIED`
- no excede el límite reputacional de rifas activas
- la fecha límite está en el futuro

Si cualquiera de esas condiciones falla, la rifa no se crea.

## 3. Lifecycle de rifa

Estados principales en `RaffleStatus`:

- `ACTIVA`
- `COMPLETADA`
- `SORTEADA`
- `EN_ENTREGA`
- `FINALIZADA`
- `CANCELADA`

### Flujo normal

1. La rifa nace en `ACTIVA`.
2. Mientras está activa se venden tickets y se reservan/pagan compras.
3. Si llega al 100% de tickets pagados:
   - pasa a `COMPLETADA`;
   - se intenta sortear inmediatamente.
4. El sorteo crea `DrawResult`, fija `winnerId`, guarda `fechaSorteoReal` y deja la rifa en `SORTEADA`.
5. El seller puede marcar el premio como enviado:
   - la rifa pasa a `EN_ENTREGA`;
   - `deliveryStatus` pasa a `SHIPPED`.
6. El ganador confirma recepción:
   - `deliveryStatus` pasa a `CONFIRMED`;
   - se intenta procesar el payout;
   - cuando el payout se completa, la rifa pasa a `FINALIZADA`.

### Flujo por vencimiento

Un cron revisa rifas vencidas cada 5 minutos:

- si la rifa venció y vendió al menos el mínimo requerido, se sortea;
- si no llegó al mínimo, se cancela y se reembolsa.

### Flujo por cancelación

Una rifa puede terminar en `CANCELADA` por:

- cancelación explícita;
- vencimiento sin umbral mínimo;
- algunos casos operativos de refund/cancelación.

En ese caso, los tickets pagados deben ser reembolsados y la consistencia de payout debe mantenerse.

## 4. Lifecycle de compra de tickets

### Regla general

La compra de tickets usa Saldo LUK interno. Mercado Pago no procesa rifas ni tickets: sólo procesa cargas de saldo previas. Si el buyer no tiene saldo suficiente, la compra falla antes de emitir tickets y no se reserva nada.

### Carga de Saldo LUK

1. El buyer inicia la carga desde `/dashboard/wallet`.
2. La carga se procesa con el provider configurado (`mercado_pago` o `mock` en QA/local).
3. Se crea una `CreditTopUpSession` con referencia del provider y monto solicitado.
4. Cuando el provider aprueba la operación, LUK acredita el Saldo LUK una sola vez.
5. La idempotencia se apoya en la sesión/evento del provider y en el estado final de la carga.
6. Mercado Pago sólo recibe datos de la carga de saldo; no recibe metadata de rifas, tickets, sellers, premios ni números.
7. Los refunds externos aplican sólo sobre saldo cargado y no usado. Los refunds por tickets, cancelaciones o disputas vuelven al Saldo LUK interno.

### Compra con saldo

1. El buyer debe tener dirección de envío.
2. Se toma lock de la rifa dentro de una transacción `Serializable`.
3. Se valida:
   - que la rifa siga `ACTIVA`;
   - que no sea propia;
   - que no esté oculta;
   - que no exceda el límite del 50% de tickets por buyer;
   - que haya disponibilidad.
4. Se verifica saldo disponible.
5. Se emiten tickets reales directamente en estado `PAGADO`.
6. Se debita el Saldo LUK del buyer y se acredita el payable interno del seller.

### Compra aleatoria vs elegida

- `RANDOM`: el sistema elige números disponibles.
- `CHOOSE_NUMBERS`: el buyer manda números concretos.

En compra elegida:

- no se permiten repetidos;
- si otro comprador tomó el número antes de confirmar la transacción, falla con “ya no está disponible”;
- existe además unicidad por `(raffleId, numeroTicket)` en DB.

### Pack simple global

En compra `RANDOM`, LUK aplica un incentivo global siempre activo:

- `5 -> 6` tickets
- `10 -> 12` tickets

Reglas del pack:

1. sólo aplica en compra aleatoria;
2. los tickets bonus son tickets reales:
   - cuentan para completar la rifa;
   - cuentan para el límite del 50% por buyer;
3. el seller cobra sobre el valor bruto completo de todos los tickets emitidos;
4. la diferencia entre bruto y cobrado la subsidia plataforma;
5. no acumula con `bonusGrantId` de social promotions.

Si la cantidad base califica pero el pack no puede cumplirse completo por:

- falta de stock; o
- límite del 50% por buyer,

la compra degrada a compra normal:

- se emite sólo la cantidad base;
- no hay bonus;
- no se bloquea la compra si la cantidad base sigue siendo válida.

### Bonificación promocional

Si el buyer aplica un `bonusGrantId`:

1. se previsualiza el descuento sobre el subtotal base;
2. se reserva un `PromotionBonusRedemption` dentro de la compra con saldo;
3. el saldo debitado se reduce por ese descuento;
4. el seller no absorbe ese descuento: lo subsidia plataforma.

### Registro de compra

En la misma transacción serializable:

1. se crea `Transaction` de `COMPRA_TICKET`;
2. si hubo pack simple, se crea también `SUBSIDIO_PACK_PLATAFORMA`;
3. si hubo descuento promocional, se crea también `SUBSIDIO_PROMOCIONAL_PLATAFORMA`;
4. el seller sigue cobrando sobre el bruto completo, no sobre el saldo efectivamente debitado al buyer;
5. si había bonificación reservada, pasa a `USED`;
6. se registra atribución de compra para social promotions;
7. buyer y seller reciben las notificaciones normales de compra/venta, enriquecidas si hubo pack simple;
8. se verifica si la rifa quedó completa para sortearla.

### Reembolso

Si la compra se revierte completamente:

- los tickets pasan a `REEMBOLSADO`;
- el monto vuelve al Saldo LUK del buyer, no al provider externo;
- si la compra había incluido pack simple, también se revierten los tickets bonus porque forman parte de la misma compra confirmada;
- si hubo bonificación promocional usada, se puede reinstalar como disponible;
- se registra `REVERSION_BONIFICACION_PROMOCIONAL` cuando corresponde.

## 5. Delivery, disputa y payout

### Envío

Después de `SORTEADA`, el seller puede marcar la rifa como enviada sólo si:

- es el seller de esa rifa;
- la rifa está `SORTEADA` o `EN_ENTREGA`;
- `deliveryStatus = PENDING`.

Eso mueve:

- `estado -> EN_ENTREGA`
- `deliveryStatus -> SHIPPED`

### Disputa

El ganador puede abrir disputa si:

- la rifa está `SORTEADA`; o
- la rifa está `EN_ENTREGA` y `deliveryStatus = SHIPPED`.

Al abrirse:

- se crea la `Dispute`;
- `deliveryStatus -> DISPUTED`;
- se notifican seller y buyer.

Estados de disputa:

- `ABIERTA`
- `ESPERANDO_RESPUESTA_VENDEDOR`
- `EN_MEDIACION`
- `RESUELTA_COMPRADOR`
- `RESUELTA_VENDEDOR`
- `RESUELTA_PARCIAL`

### Confirmación de entrega y liberación de fondos

Si el ganador confirma recepción:

1. `deliveryStatus -> CONFIRMED`
2. se incrementa reputación del seller
3. se intenta procesar payout

El payout sólo puede liberarse si:

- no se liberó antes;
- no hay disputa activa incompatible;
- la entrega está confirmada;
- la rifa está en un estado válido para release.

Cuando el payout termina bien:

- `Payout.status -> COMPLETED`
- `raffle.paymentReleasedAt` se completa
- se debita el payable interno del seller y la liquidación externa queda como proceso manual/provider-neutral en esta fase
- `raffle.estado -> FINALIZADA`

### Auto-confirmación

Un cron puede auto-confirmar y liberar fondos si:

- pasaron 7 días desde el sorteo;
- la rifa sigue sin confirmación final;
- no hay disputa activa que lo bloquee.

## 6. Reseñas y reputación

### Reseñas públicas de vendedores

La reputación pública productizada es del seller, no del buyer:

1. sólo el ganador de una rifa puede dejar reseña;
2. la entrega debe estar confirmada (`deliveryStatus = CONFIRMED`);
3. existe una sola reseña por rifa;
4. la reseña contiene `rating` de 1 a 5 y comentario opcional;
5. al crearse, se recalcula la reputación del seller;
6. el seller recibe email y notificación in-app en modo best effort.

El perfil público del seller muestra promedio, cantidad de reseñas y últimas reseñas públicas. Si admin modera una reseña, se oculta sólo el comentario; el rating se mantiene y sigue contando para el promedio.

### Señales internas de compradores

La reputación de compradores queda limitada al admin:

- tickets comprados;
- rifas ganadas;
- compras completadas;
- disputas abiertas como comprador;
- flags internos determinísticos como `HIGH_DISPUTE_RATE`, `NEW_WITH_DISPUTE`, `HEAVY_BUYER` y `WINNER_WITH_HISTORY`.

Estas señales no se exponen en perfiles públicos ni a sellers. Sirven para soporte, moderación y riesgo operativo.

## 7. Social promotions

La feature de social promotions no da “saldo libre”; genera bonificaciones puntuales que luego pueden usarse en compras.

### Flujo del post

1. El seller crea un draft:
   - red;
   - `promotionToken`;
   - `trackingUrl`.
2. El seller envía el permalink del post público.
3. El sistema valida:
   - que el post sea accesible;
   - que el token o tracking URL estén presentes;
   - que la red coincida;
   - que haya métricas utilizables.
4. Si hace falta, reintenta con Playwright para obtener métricas visibles.

Estados del post:

- `PENDING_VALIDATION`
- `ACTIVE`
- `TECHNICAL_REVIEW`
- `DISQUALIFIED`
- `SETTLED`

### Atribución

Un `promotionToken` puede generar eventos de:

- click
- registration
- purchase

Esos eventos se usan para scorear el post.

### Settlement y score

Cuando el post se liquida:

- se toma el snapshot más reciente;
- se calcula un `totalScore`;
- si entra en un tier, se emite un `PromotionBonusGrant`.
- si se emite el grant, el seller recibe email y notificación in-app.

Fórmula actual:

```text
baseScore = 10

engagementScore =
  likes * 0.01 +
  comments * 0.25 +
  reposts/shares * 0.5 +
  views * 0.001

conversionScore =
  clicksAttributed * 0.1 +
  registrationsAttributed * 3 +
  ticketPurchasesAttributed * 1.5

totalScore = baseScore + engagementScore + conversionScore
```

Tiers default:

- `>= 60`: `15%`, tope `15000`
- `>= 30`: `10%`, tope `10000`
- `>= 10`: `5%`, tope `5000`

### Uso de la bonificación

Un `PromotionBonusGrant`:

- pertenece al seller que ganó ese beneficio;
- se usa cuando ese seller compra tickets en la rifa de otro seller;
- no puede aplicarse en una rifa propia;
- vence;
- pasa por estados:
  - `AVAILABLE`
  - `RESERVED`
  - `USED`
  - `EXPIRED`
  - `REVERSED`

La redención asociada al checkout pasa por:

- `RESERVED`
- `USED`
- `RELEASED`
- `REVERSED`
- `EXPIRED`

### Cálculo del descuento

Sobre el subtotal base de la compra con Saldo LUK:

```text
uncappedDiscount = grossSubtotal * discountPercent / 100
discountApplied = min(uncappedDiscount, maxDiscountAmount, grossSubtotal)
creditDebited = grossSubtotal - discountApplied
```

Con esto:

- la pasarela externa no participa en la compra de tickets;
- el descuento promocional no reduce el valor nominal del seller;
- el subsidio queda registrado como transacción de plataforma.

## 8. Invariantes importantes

- Un seller no puede crear rifas sin KYC verificado, cuenta de cobros lista y dirección.
- Un buyer no puede comprar tickets de su propia rifa.
- El Saldo LUK disponible es la fuente de verdad previa a emitir tickets.
- La DB no permite duplicar un mismo número dentro de una rifa.
- El payout no debe liberarse si la entrega no está confirmada o si hay disputa activa incompatible.
- La bonificación de social promotion no es un wallet general: es un grant con ciclo propio.
- Mercado Pago sólo carga Saldo LUK; no recibe metadata de rifas, tickets, sellers, premios ni números.
- La reputación pública se expone para sellers; las señales de comprador son admin-only.
- `ENCRYPTION_KEY` debe mantenerse estable entre entornos porque protege PII y tokens sensibles.

## 9. Seed canónico QA/dev

El seed de desarrollo (`backend/prisma/seed.ts`) está pensado para QA manual determinístico. Incluye sellers con niveles reputacionales distintos, señales internas de compradores para admin, reseñas públicas y moderadas, preguntas/respuestas de rifas, disputas en los estados principales, compras mock, refunds, payouts, social promotion fixtures, escenarios de pack simple y fixtures de paginación para búsqueda y selector de números.

No expone reputación de compradores al público ni a sellers; esas señales quedan limitadas al admin.

## 10. Cómo usar este documento

Usalo cuando necesites responder preguntas como:

- “¿Qué dispara el sorteo?”
- “¿Cuándo una compra pasa de reservada a pagada?”
- “¿Qué bloquea un payout?”
- “¿Cómo se aplica una bonificación promocional?”
- “¿Qué cron puede cerrar o confirmar una rifa?”

Para detalles de implementación, el siguiente paso siempre es abrir el servicio responsable.
