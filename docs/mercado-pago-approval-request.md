# Solicitud a Mercado Pago

Usar este texto como base en `https://www.mercadopago.com.ar/developers/es/support/center/tickets`.

## Asunto

`Consulta de viabilidad - Mercado Pago sólo para cargas de saldo interno LUK`

## Mensaje sugerido

Hola, equipo de Mercado Pago.

Queremos confirmar por escrito si podemos usar Mercado Pago exclusivamente para que usuarios carguen saldo interno dentro de LUK.

Sitio: `https://[tu-dominio]`

Modelo operativo:

- Mercado Pago sólo procesa cargas de `Saldo LUK`.
- `1 Saldo LUK = $1 ARS`.
- El saldo sólo puede usarse dentro de LUK.
- Mercado Pago no procesa compras directas de tickets, rifas, sorteos, premios ni vendedores.
- El checkout de Mercado Pago no recibe metadata de rifas, números de tickets, premios, sellers ni links a sorteos.
- Las compras de tickets se hacen después, dentro de LUK, debitando saldo interno ya acreditado.
- Los reembolsos de tickets vuelven al Saldo LUK.
- Los reintegros externos por Mercado Pago sólo aplican sobre saldo cargado y no usado.

Restricciones de producto:

- El Saldo LUK no expira.
- El Saldo LUK no es transferible entre usuarios.
- El comprador no puede retirarlo libremente como dinero; sólo puede solicitar reintegro de cargas no usadas cuando corresponda.
- El balance a liquidar del seller es interno y separado del saldo gastable del comprador.

Solicitamos confirmación escrita sobre:

1. Si Mercado Pago puede utilizarse para este flujo de cargas de saldo interno.
2. Qué categoría, documentación legal o configuración recomiendan para evitar interpretar la carga como compra directa de rifas.
3. Qué requisitos adicionales deberíamos cumplir para operar este modelo correctamente.

Podemos enviar capturas del flujo de carga, términos, KYC, políticas de reintegro y ejemplos del payload técnico donde se ve que Mercado Pago no recibe datos de rifas ni tickets.

Quedamos atentos al número de caso y a cualquier requerimiento adicional.
