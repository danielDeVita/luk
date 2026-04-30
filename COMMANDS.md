# LUK Developer Commands

All commands run from the **project root**.

---

## Local Infra Only

Recommended when you want to develop locally without depending on Neon or Render.

Local config is split by app ownership:

- Backend, social worker, and Prisma read [backend/.env](/Users/danieldevita/Desktop/p/luk/backend/.env).
- Frontend reads [frontend/.env.local](/Users/danieldevita/Desktop/p/luk/frontend/.env.local).
- The root [`.env`](/Users/danieldevita/Desktop/p/luk/.env) may exist as a temporary local backup, but runtime config should be edited in the app-specific files.

The local Docker PostgreSQL is exposed on `localhost:5433` to avoid conflicts with native PostgreSQL already using `5432`.

```bash
npm run docker:infra:up        # Start PostgreSQL + Redis only
npm run docker:infra:ps        # Check infra status
npm run docker:infra:logs      # Follow PostgreSQL + Redis logs
npm run docker:infra:down      # Stop PostgreSQL + Redis
```

Then run the app on your host machine:

```bash
cd backend && npx prisma db push
cd backend && npm run db:seed             # Seed canónico para QA manual y dev
cd backend && npm run start:dev

cd frontend && npm run dev
```

### Local QA without the live payment provider

In [backend/.env](/Users/danieldevita/Desktop/p/luk/backend/.env):

```bash
PAYMENTS_PROVIDER="mock"
ALLOW_MOCK_PAYMENTS="true"
MP_ACCESS_TOKEN=""
```

That enables the internal QA flow for Saldo LUK top-ups under `/checkout/mock/...`.

### Optional Social Worker

Only run it when you are working on social promotions or scheduled jobs:

```bash
cd backend && npm run build
cd backend && npm run start:social-worker
```

---

## Docker Dev Stack

```bash
cp backend/.env.example backend/.env                    # First time only
cp frontend/.env.local.example frontend/.env.local      # First time only
npm run docker:dev:build      # Build + start frontend, backend y social-worker
npm run docker:dev            # Start without rebuild
npm run docker:dev:down       # Stop services
npm run docker:clean          # Stop + remove volumes + local images
```

### Local QA sin el proveedor de pagos live

En [backend/.env](/Users/danieldevita/Desktop/p/luk/backend/.env):

```bash
PAYMENTS_PROVIDER="mock"
MP_ACCESS_TOKEN=""
```

Con eso, la carga de Saldo LUK abre una pantalla interna de QA en `/checkout/mock/...` y permite aprobar, dejar pendiente, rechazar y reintegrar cargas sin tocar Mercado Pago.

---

## URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| GraphQL | http://localhost:3001/graphql |
| Social Worker | Sin URL pública (proceso background) |

---

## Health Checks

```bash
docker compose -f docker-compose.dev.yml ps
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
```

---

## Database (Dockerized Backend)

```bash
npm run docker:db:push                # Prisma db push inside backend container
npm run docker:db:seed                # Canonical QA/dev seed inside backend container
```

## Database (Host Dev + Docker Infra)

```bash
cd backend && npx prisma db push
cd backend && npm run db:seed
cd backend && npx prisma studio
```

---

## Quality / Tests (Inside Containers)

```bash
docker compose -f docker-compose.dev.yml exec backend npm run lint
docker compose -f docker-compose.dev.yml exec frontend npm run lint

docker compose -f docker-compose.dev.yml exec backend npm run test
docker compose -f docker-compose.dev.yml exec frontend npm run test:unit -- --run

docker compose -f docker-compose.dev.yml exec backend npm run build
docker compose -f docker-compose.dev.yml exec frontend npm run build
```

---

## Load Testing (k6)

Requires [k6](https://k6.io) installed on host.

```bash
npm run k6:smoke
npm run k6:load
npm run k6:stress
```

---

## Debugging Helpers

```bash
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
docker compose -f docker-compose.dev.yml logs -f social-worker
docker compose -f docker-compose.dev.yml exec backend sh
docker compose -f docker-compose.dev.yml exec frontend sh
```

---

## Social Promotions Debugging

Useful when validating seller posts without waiting for the scheduled cron.

```bash
# List recent promotion posts
docker compose -f docker-compose.dev.yml exec backend node -e 'const { PrismaClient } = require("./node_modules/@prisma/client"); const prisma = new PrismaClient(); (async () => { const posts = await prisma.socialPromotionPost.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, network: true, status: true, submittedPermalink: true, canonicalPermalink: true, lastCheckedAt: true, nextCheckAt: true } }); console.log(JSON.stringify(posts, null, 2)); await prisma.$disconnect(); })().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });'

# Force validation of one post now
docker compose -f docker-compose.dev.yml exec social-worker node -e 'const { NestFactory } = require("@nestjs/core"); const { SocialWorkerModule } = require("./dist/social-worker.module"); const { SocialPromotionsService } = require("./dist/social-promotions/social-promotions.service"); (async () => { const app = await NestFactory.createApplicationContext(SocialWorkerModule, { logger: false }); const service = app.get(SocialPromotionsService); await service.validateSocialPromotionPost("POST_ID"); console.log(JSON.stringify({ validated: true, postId: "POST_ID" })); await app.close(); })().catch(async (e) => { console.error(e); process.exit(1); });'

# Inspect latest snapshots for one post
docker compose -f docker-compose.dev.yml exec backend node -e 'const { PrismaClient } = require("./node_modules/@prisma/client"); const prisma = new PrismaClient(); (async () => { const snapshots = await prisma.socialPromotionMetricSnapshot.findMany({ where: { socialPromotionPostId: "POST_ID" }, orderBy: { checkedAt: "desc" }, take: 5, select: { checkedAt: true, isAccessible: true, tokenPresent: true, likesCount: true, commentsCount: true, repostsOrSharesCount: true, viewsCount: true, failureReason: true, rawEvidenceMeta: true } }); console.log(JSON.stringify(snapshots, null, 2)); await prisma.$disconnect(); })().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });'
```
