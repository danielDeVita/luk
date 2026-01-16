# Raffle Platform - Deployment Guide

Last Updated: January 15, 2026

---

## Before Production

| Variable | Current Status | Action |
|----------|----------------|--------|
| `MP_CLIENT_ID` | Empty | Get from [MP Dashboard](https://www.mercadopago.com.ar/developers/panel/app) |
| `MP_CLIENT_SECRET` | Empty | Get from MP Dashboard |

---

## Railway Deployment

Railway hosts all 3 services (PostgreSQL + Backend + Frontend) in one project.

### Step 1: Create Project

1. Go to [railway.app](https://railway.app) and create account
2. Click "New Project"

### Step 2: Add PostgreSQL

1. Click "+ New" → "Database" → "PostgreSQL"
2. Railway auto-provisions the database
3. `DATABASE_URL` is automatically available to other services

### Step 3: Add Backend

1. Click "+ New" → "GitHub Repo" → Select your repo
2. Set **Root Directory**: `/backend`
3. Add environment variables (Settings → Variables):

```env
NODE_ENV=production
MP_ACCESS_TOKEN=<production-token>
MP_PUBLIC_KEY=<production-key>
MP_CLIENT_ID=<your-app-id>
MP_CLIENT_SECRET=<your-app-secret>
CLOUDINARY_CLOUD_NAME=<your-cloud>
CLOUDINARY_API_KEY=<your-key>
CLOUDINARY_API_SECRET=<your-secret>
RESEND_API_KEY=<your-key>
FRONTEND_URL=https://<your-frontend>.railway.app
BACKEND_URL=https://<your-backend>.railway.app
CORS_ORIGIN=https://<your-frontend>.railway.app
```

### Step 4: Add Frontend

1. Click "+ New" → "GitHub Repo" → Select your repo
2. Set **Root Directory**: `/frontend`
3. Add environment variables:

```env
NEXT_PUBLIC_GRAPHQL_URL=https://<your-backend>.railway.app/graphql
NEXT_PUBLIC_BACKEND_URL=https://<your-backend>.railway.app
NEXT_PUBLIC_MP_PUBLIC_KEY=<production-key>
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<your-cloud>
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Step 5: Configure MP Webhooks

1. Go to [MP Dashboard](https://www.mercadopago.com.ar/developers/panel/app) → Your App → Webhooks
2. Add production webhook URL: `https://<your-backend>.railway.app/mp/webhook`
3. Add redirect URL: `https://<your-backend>.railway.app/mp/connect/callback`

### Step 6: Enable CD Pipeline (Optional)

1. Get Railway token from [railway.app/account/tokens](https://railway.app/account/tokens)
2. Add GitHub Secrets (repo → Settings → Secrets):
   - `RAILWAY_TOKEN`
   - `BACKEND_URL`
   - `FRONTEND_URL`
3. Push to `main` branch to trigger auto-deploy

---

## Environment Variables Reference

### Required

| Variable | Where to Get |
|----------|--------------|
| `DATABASE_URL` | Railway auto-provides |
| `MP_ACCESS_TOKEN` | [MP Dashboard](https://www.mercadopago.com.ar/developers/panel/app) → Credenciales |
| `MP_PUBLIC_KEY` | MP Dashboard → Credenciales |
| `MP_CLIENT_ID` | MP Dashboard → Tu aplicacion |
| `MP_CLIENT_SECRET` | MP Dashboard → Tu aplicacion |
| `CLOUDINARY_*` | [Cloudinary Console](https://console.cloudinary.com/) |

### Optional

| Variable | Where to Get | Notes |
|----------|--------------|-------|
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Google OAuth login |
| `RESEND_API_KEY` | [Resend](https://resend.com/) | Transactional emails |
| `SENTRY_DSN` | [Sentry.io](https://sentry.io/) | Error tracking |
| `REDIS_URL` | Railway/Upstash | Caching (falls back to in-memory) |

---

## Pre-Launch Checklist

- [ ] Get `MP_CLIENT_ID` and `MP_CLIENT_SECRET`
- [ ] Switch to production MP credentials (remove `TEST-` prefix)
- [ ] Configure MP webhook URL in dashboard
- [ ] Configure MP redirect URL for OAuth
- [ ] Configure `RESEND_API_KEY` for email verification
- [ ] Test email verification flow (register → receive code → verify)
- [ ] Test seller onboarding flow (MP Connect + checklist)
- [ ] Test full raffle lifecycle: create → buy → draw → ship → confirm
- [ ] Enable database backups in Railway

---

## Test Cards (Development Only)

All cards expire **11/30**. Use any cardholder name.

### Credit Cards

| Card | Number | CVV |
|------|--------|-----|
| Mastercard | 5031 7557 3453 0604 | 123 |
| Visa | 4509 9535 6623 3704 | 123 |
| American Express | 3711 803032 57522 | 1234 |

### Debit Cards

| Card | Number | CVV |
|------|--------|-----|
| Mastercard Debito | 5287 3383 1025 3304 | 123 |
| Visa Debito | 4002 7686 9439 5619 | 123 |

### Test User Status (DNI field)

| Cardholder Name | Result | DNI |
|-----------------|--------|-----|
| APRO | Pago aprobado | 12345678 |
| OTHE | Rechazado por error general | 12345678 |
| CONT | Pendiente de pago | 12345678 |
| CALL | Rechazado - requiere autorizacion | 12345678 |

---

## Future Improvements

| Task | Description | Priority |
|------|-------------|----------|
| Infrastructure as Code | Terraform/Pulumi for reproducible infra | Low |
| Custom Domain | Configure DNS + SSL | Medium |

