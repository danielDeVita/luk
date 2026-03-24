# Solicitud a Mercado Pago

Usar este texto como base en `https://www.mercadopago.com.ar/developers/es/support/center/tickets`.

## Asunto

`Solicitud de aprobacion expresa por escrito para procesamiento de pagos - rifas/sorteos`

## Mensaje sugerido

Hola, equipo de Mercado Pago.

Solicitamos la aprobacion expresa por escrito para utilizar los servicios de procesamiento de pagos de Mercado Pago en nuestro sitio de rifas y sorteos.

Sitio: `https://[tu-dominio]`

Modelo de negocio:
- Publicamos rifas y sorteos de bienes o experiencias.
- Los usuarios compran tickets para participar en una rifa puntual.
- No vendemos fichas, saldo, creditos, monedas virtuales ni ningun valor utilizable fuera de nuestro propio sitio.
- Exigimos mayoria de edad, aceptacion de terminos, KYC verificado, cuenta Mercado Pago conectada y direccion cargada antes de publicar una rifa.

Medidas visibles implementadas:
- Descargo de legalidad en home, busqueda, detalle de rifa y flujo de compra.
- Terminos y politica de privacidad accesibles desde todo el sitio.
- Bloqueo de publicaciones vinculadas a apuestas, casinos, fichas, saldo o creditos.

Medidas tecnicas implementadas en checkout:
- Enviamos el checkout por `checkout/preferences` con categoria de industria `lottery`.
- Enriquecemos el payload con datos del comprador cuando estan disponibles: email, nombre, apellido, identificacion, telefono y direccion operativa.
- Enviamos tambien senales de contexto para evaluacion de riesgo, como fecha de registro, tipo de autenticacion, si es la primera compra online y fecha de ultima compra completada.
- Mantenemos referencia externa, URLs de retorno y webhook para trazabilidad e idempotencia del flujo.

Solicitamos confirmacion escrita sobre:
1. Si la operatoria descripta puede ser aprobada para procesamiento de pagos.
2. Que requisitos documentales, legales o tecnicos adicionales debemos cumplir.
3. Si necesitan URLs puntuales, capturas o documentacion societaria para evaluar el caso.

Adjuntamos:
- URL principal del sitio.
- 3 a 5 URLs de rifas.
- Capturas del registro +18, KYC, terminos y flujo de compra.
- Datos societarios y fiscales aplicables.

Quedamos atentos al numero de caso y a cualquier requerimiento adicional.
