# Raffle Platform - Deployment Guide

Last Updated: January 16, 2026

---

## Deployment Stack

| Service | Provider | Cost |
|---------|----------|------|
| Database | [Neon](https://neon.tech) (PostgreSQL) | Free tier |
| Backend | [Render](https://render.com) (Docker) | Free tier |
| Frontend | [Render](https://render.com) (Docker) | Free tier |

**Total Cost: $0** (within free tier limits)

---

## Before You Start

### Required Credentials

| Variable | Where to Get |
|----------|--------------|
| `MP_ACCESS_TOKEN` | [MP Dashboard](https://www.mercadopago.com.ar/developers/panel/app) → Credenciales |
| `MP_PUBLIC_KEY` | MP Dashboard → Credenciales |
| `MP_CLIENT_ID` | MP Dashboard → Tu aplicacion |
| `MP_CLIENT_SECRET` | MP Dashboard → Tu aplicacion |
| `CLOUDINARY_*` | [Cloudinary Console](https://console.cloudinary.com/) |
| `RESEND_API_KEY` | [Resend](https://resend.com/) |
| `ENCRYPTION_KEY` | Run: `openssl rand -hex 32` |

---

## Step 1: Create Neon Database (5 min)

### 1.1 Create Account & Project

1. Go to https://neon.tech and sign up with GitHub
2. Click "Create Project"
3. Settings:
   - **Project name**: `raffle-marketplace`
   - **Region**: `AWS São Paulo (sa-east-1)` (closest to Argentina)
   - **Postgres version**: 16
4. Click "Create Project"

### 1.2 Get Connection String

After creation, copy the connection string:

```
postgresql://neondb_owner:password@ep-xxx-xxx-123456.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

**Save this** - you'll need it for Render.

### 1.3 Configure Settings

1. Go to Project Settings → Compute
2. Enable "Autosuspend" after 5 min (saves compute hours)
3. Free tier: 100 compute hours/month, 10GB storage

---

## Step 2: Deploy Backend on Render (10 min)

### 2.1 Create Service

1. Go to https://dashboard.render.com
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `raffle-backend`
   - **Region**: Oregon (US West) - free tier available
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Instance Type**: Free

### 2.2 Set Environment Variables

In the "Environment" section, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://...` (your Neon connection string) |
| `JWT_SECRET` | Click "Generate" or run `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Run `openssl rand -hex 32` locally |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_URL` | `https://raffle-frontend.onrender.com` |
| `BACKEND_URL` | `https://raffle-backend.onrender.com` |
| `CORS_ORIGIN` | `https://raffle-frontend.onrender.com` |
| `MP_ACCESS_TOKEN` | Your Mercado Pago access token |
| `MP_PUBLIC_KEY` | Your Mercado Pago public key |
| `MP_CLIENT_ID` | Your Mercado Pago client ID |
| `MP_CLIENT_SECRET` | Your Mercado Pago client secret |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
| `RESEND_API_KEY` | Your Resend API key |
| `EMAIL_FROM` | `noreply@yourdomain.com` |
| `GRAPHQL_PLAYGROUND` | `false` |
| `GRAPHQL_DEBUG` | `false` |

### 2.3 Deploy

1. Click "Create Web Service"
2. Wait for build (~5-10 minutes)
3. Note your URL: `https://raffle-backend.onrender.com`

---

## Step 3: Deploy Frontend on Render (10 min)

### 3.1 Create Service

1. Click "New" → "Web Service"
2. Connect same GitHub repository
3. Configure:
   - **Name**: `raffle-frontend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Runtime**: Docker
   - **Instance Type**: Free

### 3.2 Set Environment Variables

These are baked into the frontend at build time:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_GRAPHQL_URL` | `https://raffle-backend.onrender.com/graphql` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://raffle-backend.onrender.com` |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Your Mercado Pago public key |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` (optional) |

### 3.3 Deploy

1. Click "Create Web Service"
2. Wait for build (~5-10 minutes)
3. Your app is live at: `https://raffle-frontend.onrender.com`

---

## Step 4: Run Database Migrations (5 min)

The backend automatically runs migrations on startup, but for the first deployment:

### Option A: Using Render Shell

1. Go to backend service on Render
2. Click "Shell" tab
3. Run: `npx prisma db push`

### Option B: Run Locally

```bash
cd backend
DATABASE_URL="your-neon-connection-string" npx prisma db push
```

### Seed Initial Data (Optional)

```bash
DATABASE_URL="your-neon-connection-string" npx prisma db seed
```

---

## Step 5: Configure Mercado Pago (5 min)

Update webhook URLs in [MP Developer Dashboard](https://www.mercadopago.com.ar/developers/panel):

1. Go to your application → Webhooks
2. **Webhook URL**: `https://raffle-backend.onrender.com/mp/webhook`
3. **Redirect URL** (for OAuth): `https://raffle-backend.onrender.com/mp/connect/callback`

---

## Step 6: Verify Deployment (5 min)

### Test Backend

```bash
# Health check
curl https://raffle-backend.onrender.com/health

# Should return: {"status":"ok","database":"connected",...}
```

### Test Frontend

1. Open `https://raffle-frontend.onrender.com` in browser
2. Should see the homepage
3. Try registering a new user

### Check Logs

- Render dashboard → Your service → "Logs" tab

---

## Free Tier Limitations

### Render

- Services **spin down after 15 minutes** of inactivity
- First request after sleep: ~30-100 seconds (cold start)
- 750 hours/month per service

### Neon

- **Autosuspend after 5 minutes** of inactivity
- Cold start: ~500ms
- 100 compute hours/month
- 10GB storage

### Workaround: Prevent Cold Starts

Use [UptimeRobot](https://uptimerobot.com) (free) to ping your services every 14 minutes:

1. Create free account
2. Add monitor: `https://raffle-backend.onrender.com/health`
3. Interval: 5 minutes

---

## Environment Variables Reference

### Backend (Required)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Min 32 chars, used for auth tokens |
| `ENCRYPTION_KEY` | 64 hex chars, for encrypting MP tokens |
| `MP_ACCESS_TOKEN` | Mercado Pago API token |
| `MP_PUBLIC_KEY` | Mercado Pago public key |
| `MP_CLIENT_ID` | For MP Connect OAuth |
| `MP_CLIENT_SECRET` | For MP Connect OAuth |
| `CLOUDINARY_*` | Image uploads |
| `RESEND_API_KEY` | Email sending |
| `FRONTEND_URL` | For CORS and redirects |
| `BACKEND_URL` | For webhook URLs |

### Backend (Optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `SENTRY_DSN` | Error tracking |
| `REDIS_URL` | Caching (falls back to in-memory) |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_GRAPHQL_URL` | Backend GraphQL endpoint |
| `NEXT_PUBLIC_BACKEND_URL` | Backend base URL |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | For MP Checkout |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | For image display |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics (optional) |

---

## Pre-Launch Checklist

- [ ] Get `MP_CLIENT_ID` and `MP_CLIENT_SECRET` from MP Dashboard
- [ ] Switch to production MP credentials (remove `TEST-` prefix)
- [ ] Configure MP webhook URL: `https://your-backend.onrender.com/mp/webhook`
- [ ] Configure MP redirect URL: `https://your-backend.onrender.com/mp/connect/callback`
- [ ] Configure `RESEND_API_KEY` for email verification
- [ ] Test email verification flow (register → receive code → verify)
- [ ] Test seller onboarding flow (MP Connect + checklist)
- [ ] Test full raffle lifecycle: create → buy → draw → ship → confirm
- [ ] Set up UptimeRobot to prevent cold starts
- [ ] Enable Neon point-in-time recovery (free tier: 7 days)

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

## Troubleshooting

### Backend won't start

1. Check logs in Render dashboard
2. Verify `DATABASE_URL` is correct (Neon connection string)
3. Ensure Neon database is not paused

### Frontend can't connect to backend

1. Check `NEXT_PUBLIC_GRAPHQL_URL` is correct
2. Verify `CORS_ORIGIN` in backend matches frontend URL
3. Backend might be sleeping - wait for cold start

### Database connection timeout

1. Neon might be paused - first request wakes it up
2. Check Neon dashboard for compute usage
3. Verify connection string includes `?sslmode=require`

### MP webhook not working

1. Verify webhook URL in MP Dashboard
2. Check backend logs for incoming requests
3. Ensure backend is awake (not sleeping)

---

## Rollback

### Render

1. Go to service → "Events" tab
2. Find previous successful deploy
3. Click "Rollback"

### Neon

1. Go to Neon dashboard → Branches
2. Use point-in-time recovery (last 7 days on free tier)

---

## Upgrading from Free Tier

When you need better performance:

| Service | Free | Paid | Cost |
|---------|------|------|------|
| Render Backend | 512MB, sleeps | 512MB, always-on | ~$7/month |
| Render Frontend | 512MB, sleeps | 512MB, always-on | ~$7/month |
| Neon Database | 100 CU-hours | Unlimited | ~$15/month |

**Total paid tier: ~$29/month** for always-on services.

---

## Future Improvements

| Task | Description | Priority |
|------|-------------|----------|
| Infrastructure as Code | Terraform/Pulumi for reproducible infra | Low |
| Custom Domain | Configure DNS + SSL | Medium |
