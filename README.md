# Ashok Inn - Booking App site

A production-ready MERN hotel booking app with customer + admin flows, JWT auth, Google login, bookings, and payment integrations.

## Features
- User auth (email/password + Google OAuth)
- Admin portal (stats, bookings, room management, check-in/out)
- Bookings (pay at hotel, manual UPI, Razorpay/PhonePe hooks)
- Password reset + booking search
- Production-safe CORS + environment validation

## Tech Stack
- Frontend: React + Vite + Tailwind
- Backend: Node/Express + Supabase (PostgreSQL)
- Auth: JWT + Google OAuth

## Quick Start (Local)
1. Install deps:
```bash
npm install
```

2. Configure `.env` (see `.env.example`).

3. Run the app:
```bash
npm run dev
```

Server runs on `http://localhost:5000`.

## Environment Variables
See `.env.example` for the full list. Key ones:

**Backend**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `EMAIL_USER`
- `EMAIL_PASS`
- `GOOGLE_CLIENT_ID`
- `FRONTEND_URL`

**Frontend (Vite)**
- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`

## Google OAuth Setup
In Google Cloud Console:
- Create OAuth Client ID (Web)
- Authorized JavaScript origins:
  - `http://localhost:5000`
  - `https://your-vercel-domain.vercel.app`

Use the same client ID for:
- `GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_ID`

## Scripts
- `npm run dev` — dev server
- `npm run start` — prod server
- `npm run build` — build frontend
- `npm run lint` — typecheck
- `npm run seed` — seed rooms

## Deployment
Use `RENDER_DEPLOYMENT.md` for step-by-step Render + Vercel deployment.

## API Health
`GET /api/health` returns server status and Supabase connection state.
