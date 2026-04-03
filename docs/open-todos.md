# TODOs Abiertos

Este documento consolida los pendientes operativos y de salida a producción que hoy están dispersos en:

- [aws-migration-plan.md](./aws-migration-plan.md)
- [mercado-pago-approval-request.md](./mercado-pago-approval-request.md)
- [backend/README.md](../backend/README.md)
- [frontend/README.md](../frontend/README.md)

No intenta reemplazar esos documentos. Sirve como checklist única para ordenar qué falta hacer.

## P0. Bloqueantes Antes Del Primer Entorno Real

- [ ] Definir el dominio principal del proyecto.
  Impacta en `Route 53`, `ACM`, subdominios `app.<dominio>` y `api.<dominio>`, approval request de Mercado Pago y configuración real de Turnstile.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md), [mercado-pago-approval-request.md](./mercado-pago-approval-request.md)

- [ ] Definir si habrá hostname de `staging` antes de producción.
  Si no existe `staging`, Turnstile debe seguir apagado fuera de QA local con test keys.
  Fuente: [frontend/README.md](../frontend/README.md), [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Crear el widget real de Cloudflare Turnstile cuando exista un hostname real o estable.
  Cargar:
  `NEXT_PUBLIC_TURNSTILE_ENABLED`
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  `TURNSTILE_ENABLED`
  `TURNSTILE_SECRET_KEY`
  Hasta entonces, mantenerlo desactivado o usar test keys sólo para QA local.
  Fuente: [frontend/README.md](../frontend/README.md), [backend/README.md](../backend/README.md)

- [ ] Restaurar Prisma Migrate para un flujo productivo real.
  Incluye:
  recrear `backend/prisma/migrations`
  generar baseline migration desde el schema actual
  usar `prisma migrate dev` para cambios futuros
  usar `prisma migrate deploy` en release/deploy
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md), [backend/README.md](../backend/README.md)

- [ ] Dejar de usar `prisma db push` como mecanismo de arranque de servicios productivos.
  Hay que alinear:
  `backend/Dockerfile`
  `backend/Dockerfile.social-worker`
  `docker-compose.yml`
  Incidente ya observado en Render:
  el backend no pudo bootear porque `db push` frenó el arranque ante cambios destructivos (`referral_balance`, enum `THREADS`) y luego volvió a frenarse al detectar tablas backup no versionadas en `public`.
  La conclusión práctica es que los cambios de schema deben ejecutarse en un paso controlado de release, no en el `CMD` del contenedor.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Formalizar la política de secretos para entornos reales.
  `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, `MP_ACCESS_TOKEN`, `TURNSTILE_SECRET_KEY` y demás secretos deben venir desde `SSM Parameter Store`, no del repo ni de imágenes.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Preparar la aprobación formal de Mercado Pago con datos reales.
  Falta reemplazar el placeholder `https://[tu-dominio]` por dominio real y adjuntar URLs reales de rifas, capturas y datos societarios/fiscales aplicables.
  Fuente: [mercado-pago-approval-request.md](./mercado-pago-approval-request.md)

## P1. Infraestructura AWS Para El Primer Deploy Real

- [ ] Crear o cerrar cuenta/región principal de AWS.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Modelar la infraestructura con `AWS CDK` en una carpeta `infra/`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Preparar DNS y TLS.
  Incluye:
  `Route 53`
  `ACM`
  definición de `app.<dominio>` y `api.<dominio>`
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Crear repositorios en `ECR`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Desplegar `frontend`, `backend` y `worker` en `ECS Fargate`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Crear `RDS PostgreSQL Single-AZ`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Configurar `CloudWatch` para logs y monitoreo básico.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Configurar `SSM Parameter Store` para configuración y secretos.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

## P2. Migraciones De Proveedores

- [ ] Migrar uploads de `Cloudinary` a `S3`.
  Recomendación ya decidida: guardar `object key` en vez de URL rígida.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Migrar emails de `Brevo` a `SES`.
  Antes de operar en serio falta:
  verificar dominio o subdominio
  configurar `SPF`
  configurar `DKIM`
  definir `DMARC`
  sacar la cuenta de `sandbox`
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Actualizar variables, callbacks OAuth y webhooks al nuevo entorno.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md), [backend/README.md](../backend/README.md)

## P3. Validación Antes Del Lanzamiento

- [ ] Actualizar términos, privacidad y copy legal para social promotions.
  Debe quedar explícito que Luk monitorea publicaciones públicas y que la bonificación promocional no es dinero ni saldo retirable.
  Fuente: [social-promotions-implementation.md](./social-promotions-implementation.md)

- [ ] Revisar wording de producto para usar consistentemente `bonificación promocional`.
  Evitar términos como `saldo` o `créditos` si generan ambigüedad regulatoria o de producto.
  Fuente: [social-promotions-implementation.md](./social-promotions-implementation.md)

- [ ] Probar login por email/password en entorno real.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Probar Google OAuth con URLs finales.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md), [backend/README.md](../backend/README.md)

- [ ] Probar GraphQL desde frontend real.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Probar pagos y webhooks.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Probar uploads de imágenes sobre `S3`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Probar envío de emails sobre `SES`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Probar `social-worker`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Revalidar Turnstile con hostname real.
  Verificar que el widget esté creado en Cloudflare con el hostname final y que frontend/backend usen el par site key/secret key correcto.
  Fuente: [frontend/README.md](../frontend/README.md), [backend/README.md](../backend/README.md)

## P4. Para Después De Tener Tracción

- [ ] Agregar `CloudFront`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Agregar `Redis`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Reemplazar `PubSub` en memoria por backend compartido.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Pasar backend a múltiples réplicas.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Pasar `RDS` a `Multi-AZ`.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

- [ ] Crear `staging` permanente.
  Fuente: [aws-migration-plan.md](./aws-migration-plan.md)

## Decisiones Ya Tomadas

Esto ya está resuelto y no debería volver a abrirse salvo cambio explícito:

- AWS-only real para la siguiente etapa
- un solo entorno real al inicio
- `prod` alcanza para la primera fase
- `S3` sin `CloudFront` al inicio
- `SES` como reemplazo de `Brevo`
- `Parameter Store` en lugar de `Secrets Manager` por ahora
- `Redis` fuera de la primera fase
- Docker se mantiene como estándar de despliegue

## Próximo Paso Recomendado

Si hubiera que elegir un único orden de ejecución hoy, sería este:

1. Definir dominio y subdominios.
2. Restaurar Prisma Migrate y alinear arranque sin `db push`.
3. Modelar la infraestructura base en AWS (`CDK` + `ECR` + `ECS` + `RDS` + `SSM`).
4. Crear widget real de Turnstile y cargar keys.
5. Preparar aprobación de Mercado Pago con URLs reales.
6. Migrar `Cloudinary -> S3` y `Brevo -> SES`.
7. Hacer validación end-to-end en entorno real.
