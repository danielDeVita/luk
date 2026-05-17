# Solicitud a Mercado Pago

Usar este texto como base en `https://www.mercadopago.com.ar/developers/es/support/center/tickets`.

## Asunto

`Consulta de viabilidad - Saldo LUK y payouts a sellers por Mercado Pago`

## Mensaje sugerido

Hola, equipo de Mercado Pago.

Queremos confirmar por escrito si podemos usar Mercado Pago para dos operaciones separadas dentro de LUK: cargas de saldo interno de compradores y liquidaciones posteriores a vendedores conectados con Mercado Pago.

Sitio: `https://[tu-dominio]`

Modelo operativo:

- Mercado Pago procesa cargas de `Saldo LUK`.
- Mercado Pago también liquidaría payouts desde la cuenta de LUK hacia la billetera Mercado Pago conectada del seller.
- `1 Saldo LUK = $1 ARS`.
- El saldo sólo puede usarse dentro de LUK.
- En el checkout el concepto visible es `Carga de saldo LUK` y el descriptor corto es `LUK SALDO`.
- Mercado Pago no procesa compras directas de tickets, rifas, sorteos, premios ni vendedores.
- El checkout de Mercado Pago no recibe metadata de rifas, números de tickets, premios ni sellers.
- Mercado Pago sólo recibe las URLs técnicas de retorno/notificación del sitio; no recibe links profundos a sorteos ni a tickets específicos.
- Las compras de tickets se hacen después, dentro de LUK, debitando saldo interno ya acreditado.
- Los vendedores conectan su cuenta Mercado Pago por OAuth sólo para recibir liquidaciones.
- La liquidación al seller ocurre después de que la entrega queda confirmada y pasan 7 días sin disputa abierta.
- Los reembolsos de tickets vuelven al Saldo LUK.
- Los reintegros externos por Mercado Pago sólo aplican sobre saldo cargado y no usado.

Restricciones de producto:

- El Saldo LUK no expira.
- El Saldo LUK no es transferible entre usuarios.
- El comprador no puede retirarlo libremente como dinero; sólo puede solicitar reintegro de cargas no usadas cuando corresponda.
- El balance a liquidar del seller es interno y separado del saldo gastable del comprador hasta que LUK ejecuta el payout.

Solicitamos confirmación escrita sobre:

1. Si Mercado Pago puede utilizarse para este flujo de cargas de saldo interno.
2. Si Mercado Pago Payouts/OAuth puede utilizarse para transferir liquidaciones desde LUK a la billetera Mercado Pago del seller.
3. Qué categoría, documentación legal o configuración recomiendan para evitar interpretar la carga o el payout como compra directa de rifas.
4. Qué requisitos adicionales deberíamos cumplir para operar este modelo correctamente.

Podemos enviar capturas del flujo de carga, conexión OAuth del seller, términos, KYC, políticas de reintegro y ejemplos del payload técnico donde se ve que Mercado Pago no recibe datos de rifas ni tickets.

Quedamos atentos al número de caso y a cualquier requerimiento adicional.
