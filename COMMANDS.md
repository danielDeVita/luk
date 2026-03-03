# Developer Commands Reference (Docker-Only)

All commands run from the **project root**.

---

## Start / Stop

```bash
cp .env.example .env          # First time only
npm run docker:dev:build      # Build + start services
npm run docker:dev            # Start without rebuild
npm run docker:dev:down       # Stop services
npm run docker:clean          # Stop + remove volumes + local images
```

---

## URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| GraphQL | http://localhost:3001/graphql |

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
npm run docker:db:seed:manual-qa      # Manual QA seed inside backend container
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
docker compose -f docker-compose.dev.yml exec backend sh
docker compose -f docker-compose.dev.yml exec frontend sh
```
