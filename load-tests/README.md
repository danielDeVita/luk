# LUK Load Testing Suite

Performance testing for LUK using [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Quick Start

```bash
# 1. Start the backend locally
cd backend && npm run start:dev

# 2. Run smoke test (validates all endpoints work)
npm run k6:smoke

# 3. Run load test (standard traffic simulation)
npm run k6:load

# 4. Run stress test (find breaking point)
npm run k6:stress
```

## Test Scenarios

### Individual Scenarios

| Scenario | Description | VUs | Duration |
|----------|-------------|-----|----------|
| `01-health` | Health endpoints | 50 | 30s |
| `02-browse-homepage` | Browse raffle listings | 100 | 2 min |
| `03-search-filters` | Full-text search + filters | 50 | 2 min |
| `04-raffle-detail` | View raffle + increment views | 80 | 2 min |
| `05-auth-flow` | Login/register (throttled) | 5 | 1 min |
| `06-buy-tickets` | Purchase flow (auth required) | 20 | 2 min |

Run individual scenarios:

```bash
npm run k6:health
npm run k6:browse
npm run k6:search
npm run k6:detail
npm run k6:auth
npm run k6:buy
```

### Combined Tests

| Test | Description | Max VUs | Duration |
|------|-------------|---------|----------|
| `smoke` | Quick validation | 1 | 30s |
| `load` | Normal traffic | 50 | 5 min |
| `stress` | Find breaking point | 200 | 17 min |

## Testing Against Deployed Environment

Override the target URL:

```bash
# Against staging
TARGET_URL=https://api-staging.example.com npm run k6:load

# Against production (be careful!)
TARGET_URL=https://api.example.com npm run k6:smoke
```

## Test Users

Tests require authenticated users. Before running load tests, create test users manually through the app registration flow or via the GraphQL API. The test helpers in `helpers/auth.js` expect:

| Role | Environment Variable | Default |
|------|---------------------|---------|
| Admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | admin@rifas.com |
| Seller | `SELLER_EMAIL`, `SELLER_PASSWORD` | vendedor@test.com |
| Buyer | `BUYER_EMAIL`, `BUYER_PASSWORD` | comprador@test.com |

Configure via environment variables or update `helpers/data.js`.

## Thresholds

Default thresholds (adjust in `config/options.js`):

| Metric | Target |
|--------|--------|
| p95 response time | < 500ms |
| p99 response time | < 1000ms |
| Error rate | < 1% |

## Output Options

### JSON Output

```bash
k6 run --out json=results.json load-tests/load.js
```

### InfluxDB (for Grafana dashboards)

```bash
k6 run --out influxdb=http://localhost:8086/k6 load-tests/load.js
```

### Cloud (k6 Cloud)

```bash
k6 cloud load-tests/load.js
```

## Interpreting Results

### Good Results
- p95 < 500ms
- Error rate < 1%
- No timeouts

### Warning Signs
- p95 > 500ms but < 1000ms
- Error rate 1-5%
- Occasional timeouts

### Problems
- p95 > 1000ms
- Error rate > 5%
- Connection errors
- Timeouts

## File Structure

```
load-tests/
├── config/
│   └── options.js          # Shared configuration
├── helpers/
│   ├── graphql.js          # GraphQL request helper
│   ├── auth.js             # Authentication helpers
│   └── data.js             # Test data generators
├── scenarios/
│   ├── 01-health.js        # Health endpoints
│   ├── 02-browse-homepage.js
│   ├── 03-search-filters.js
│   ├── 04-raffle-detail.js
│   ├── 05-auth-flow.js
│   └── 06-buy-tickets.js
├── smoke.js                # Quick validation
├── load.js                 # Standard load test
├── stress.js               # Stress test
└── README.md
```

## Tips

1. **Always run smoke test first** - Validates endpoints work before running longer tests
2. **Create test users** - Register users through the app or via GraphQL before running tests
3. **Monitor resources** - Watch CPU/memory during tests
4. **Don't stress production** - Use staging or a copy
5. **Check rate limits** - Auth endpoints have throttling (low VUs for auth tests)
