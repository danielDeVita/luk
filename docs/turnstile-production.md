# Cloudflare Turnstile En Produccion

Esta guia define como activar Cloudflare Turnstile en LUK sin romper login ni registro.

## Recomendacion

- Local diario: mantener Turnstile apagado.
- QA local puntual: usar las test keys oficiales de Cloudflare.
- Staging con URL publica estable: activar Turnstile si el hostname esta configurado en Cloudflare.
- Produccion: activar Turnstile con widget real y dominio definitivo.

Turnstile real necesita un hostname autorizado en Cloudflare Hostname Management. El hostname puede ser un dominio propio, por ejemplo `app.luk.app` o `www.luk.app`, o el hostname publico de Render si ese entorno es estable, por ejemplo `luk-frontend.onrender.com`.

Para salida a produccion conviene usar dominio propio. El hostname de Render sirve para staging, QA publico o una prevalidacion, pero no deberia ser el hostname final si el producto se va a operar con dominio propio.

## Variables

Frontend, publicas y embebidas en el build de Next.js:

```env
NEXT_PUBLIC_TURNSTILE_ENABLED="true"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="site-key-publica"
```

Backend, privadas y runtime:

```env
TURNSTILE_ENABLED="true"
TURNSTILE_SECRET_KEY="secret-key-privada"
```

Reglas:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` es publica y puede estar en el browser.
- `TURNSTILE_SECRET_KEY` nunca debe ir al frontend, al repo, a capturas ni a logs.
- Frontend y backend deben estar alineados: si el backend exige Turnstile, el frontend debe renderizar el widget y enviar `captchaToken`.
- Si cambian `NEXT_PUBLIC_*` en Render, hay que redeployar el frontend porque Next.js las embebe durante el build.

## Crear Widget Real

1. Entrar a Cloudflare Dashboard.
2. Ir a `Turnstile`.
3. Seleccionar `Add widget`.
4. Usar un nombre descriptivo, por ejemplo `luk-production` o `luk-staging`.
5. En `Hostname management`, cargar el hostname exacto:
   - produccion con dominio propio: `app.luk.app`, `www.luk.app`, etc.
   - staging/render: `luk-frontend.onrender.com` o el hostname publico correspondiente.
6. Elegir modo `Managed`.
7. Crear el widget.
8. Copiar `site key` y `secret key`.
9. Guardar `secret key` solo en el backend.

Fuente oficial: https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/

## Configurar Render

Backend service:

```env
TURNSTILE_ENABLED="true"
TURNSTILE_SECRET_KEY="<secret-key-real>"
```

Frontend service:

```env
NEXT_PUBLIC_TURNSTILE_ENABLED="true"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="<site-key-real>"
```

Despues de guardar variables:

1. Redeployar backend.
2. Redeployar frontend.
3. Abrir `/auth/login` y `/auth/register`.
4. Confirmar que el widget aparece.
5. Resolver el widget y verificar que login/registro envian `captchaToken`.
6. Confirmar en backend que no hay rechazos de Turnstile en logs.

Si el widget no aparece o falla, revisar primero:

- el hostname exacto en Cloudflare;
- que el frontend tenga la site key correcta;
- que el backend tenga la secret key del mismo widget;
- que el frontend haya sido redeployado despues de cambiar `NEXT_PUBLIC_*`.

## Local Y QA

Para desarrollo local normal:

```env
NEXT_PUBLIC_TURNSTILE_ENABLED="false"
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
TURNSTILE_ENABLED="false"
TURNSTILE_SECRET_KEY=""
```

Para QA local puntual con test keys oficiales:

```env
NEXT_PUBLIC_TURNSTILE_ENABLED="true"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_ENABLED="true"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
```

Estas keys pasan validacion y funcionan en `localhost`. Para probar errores, usar las test keys de fallo documentadas por Cloudflare.

Fuente oficial: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

## Checklist De Validacion

Turnstile apagado:

- Login y registro no muestran widget.
- Backend no exige `captchaToken`.

Test keys:

- Login y registro muestran widget.
- Submit queda bloqueado hasta obtener token.
- Backend acepta el token con test secret.

Keys reales:

- El widget aparece en el hostname autorizado.
- Login y registro funcionan despues del challenge.
- El widget no se usa desde hostnames no autorizados.
- No se mezclan site keys y secret keys entre staging y produccion.

## Hostnames

Cloudflare requiere configurar hostnames para controlar donde puede ejecutarse un widget real. Usar FQDNs completos, por ejemplo `app.luk.app`, no URLs completas con `https://`.

Fuente oficial: https://developers.cloudflare.com/turnstile/concepts/hostname-management/
