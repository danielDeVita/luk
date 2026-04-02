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

## 2. Preconditions para crear una rifa

Un seller sólo puede crear una rifa si cumple todo esto:

- `mpConnectStatus = CONNECTED`
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

La compra no escribe tickets pagados directamente. Primero reserva, luego confirma cuando el pago queda aprobado.

### Reserva

1. El buyer debe tener dirección de envío.
2. Se toma lock de la rifa dentro de una transacción `Serializable`.
3. Se valida:
   - que la rifa siga `ACTIVA`;
   - que no sea propia;
   - que no esté oculta;
   - que no exceda el límite del 50% de tickets por buyer;
   - que haya disponibilidad.
4. Se crean tickets `RESERVADO`.

### Compra aleatoria vs elegida

- `RANDOM`: el sistema elige números disponibles.
- `CHOOSE_NUMBERS`: el buyer manda números concretos.

En compra elegida:

- no se permiten repetidos;
- si otro comprador tomó el número antes de confirmar la transacción, falla con “ya no está disponible”;
- existe además unicidad por `(raffleId, numeroTicket)` en DB.

### Bonificación promocional

Si el buyer aplica un `bonusGrantId`:

1. se previsualiza el descuento sobre el subtotal base;
2. se reserva un `PromotionBonusRedemption`;
3. el monto enviado a checkout se reduce por ese descuento;
4. el seller no absorbe ese descuento: lo subsidia plataforma.

### Confirmación del pago

Cuando el provider confirma aprobación:

1. los tickets reservados pasan a `PAGADO`;
2. se crea `Transaction` de `COMPRA_TICKET`;
3. si hubo descuento promocional, se crea también `SUBSIDIO_PROMOCIONAL_PLATAFORMA`;
4. si había bonificación reservada, pasa a `USED`;
5. se registra atribución de compra para social promotions;
6. se verifica si la rifa quedó completa para sortearla.

### Pago pendiente o rechazado

- `pending`: la reserva puede quedar retenida según el provider/mock flow.
- `rejected` o expiración: la reserva se libera y los tickets no quedan pagados.

### Reembolso

Si la compra se revierte completamente:

- los tickets pasan a `REEMBOLSADO`;
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
- `raffle.estado -> FINALIZADA`

### Auto-confirmación

Un cron puede auto-confirmar y liberar fondos si:

- pasaron 7 días desde el sorteo;
- la rifa sigue sin confirmación final;
- no hay disputa activa que lo bloquee.

## 6. Social promotions

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

Sobre el subtotal base:

```text
uncappedDiscount = grossSubtotal * discountPercent / 100
maximumAllowedDiscount = grossSubtotal - minMpCharge
discountApplied = min(uncappedDiscount, maxDiscountAmount, maximumAllowedDiscount)
mpChargeAmount = grossSubtotal - discountApplied
```

Con esto:

- Mercado Pago nunca recibe un monto menor que el mínimo configurado;
- el descuento promocional no reduce el valor nominal del seller;
- el subsidio queda registrado como transacción de plataforma.

## 7. Invariantes importantes

- Un seller no puede crear rifas sin KYC verificado, MP Connect y dirección.
- Un buyer no puede comprar tickets de su propia rifa.
- La reserva de tickets es la fuente de verdad previa al pago.
- La DB no permite duplicar un mismo número dentro de una rifa.
- El payout no debe liberarse si la entrega no está confirmada o si hay disputa activa incompatible.
- La bonificación de social promotion no es un wallet general: es un grant con ciclo propio.
- `ENCRYPTION_KEY` debe mantenerse estable entre entornos porque protege PII y tokens sensibles.

## 8. Cómo usar este documento

Usalo cuando necesites responder preguntas como:

- “¿Qué dispara el sorteo?”
- “¿Cuándo una compra pasa de reservada a pagada?”
- “¿Qué bloquea un payout?”
- “¿Cómo se aplica una bonificación promocional?”
- “¿Qué cron puede cerrar o confirmar una rifa?”

Para detalles de implementación, el siguiente paso siempre es abrir el servicio responsable.
