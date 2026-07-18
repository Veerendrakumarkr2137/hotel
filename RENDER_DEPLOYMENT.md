# Render Backend Deployment Guide

## Your Backend Structure:
```
server.ts (main backend file)
server/
  ├── controllers/ (authController, bookingController, etc.)
  ├── middleware/ (authMiddleware)
  ├── models/ (User, Room, Booking)
  └── routes/ (authRoutes, bookingRoutes, etc.)
```

## Step-by-Step Deployment:

### 1. Create Render Account & Connect GitHub
- Go to https://render.com
- Sign up with GitHub
- Click "New +" → "Web Service"
- Select your GitHub repo (hotel)
- Connect repository

### 2. Configure Render Service
When creating the web service, fill in:

**Basic Settings:**
- Name: `ashok-inn-hotel-backend`
- Environment: `Node`
- Region: `Singapore` (or closest to you)
- Branch: `main`

**Build & Start Commands:**
- Build Command: `npm install`
- Start Command: `npm start`

**Plan:** Free tier (sufficient for testing)

### 3. Add Environment Variables in Render Dashboard
After creating the service, go to **Settings** → **Environment** and add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
NODE_ENV=production
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-oauth-client-id
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
HOTEL_UPI_ID=your-upi-id@bank
HOTEL_UPI_NAME=Ashok Inn
HOTEL_CONTACT_EMAIL=info@ashokinn.com
HOTEL_SUPPORT_PHONE=+91 91642 30250
HOTEL_WHATSAPP_NUMBER=919164230250
FRONTEND_URL=https://ashokinn.com
```

### 4. Get Your Render Backend URL
After deployment, Render will give you a URL like:
```
https://ashok-inn-hotel-backend.onrender.com
```

### 5. Update Frontend API Configuration
Set the frontend API base URL using a Vercel environment variable (no hardcoding in code):

### 6. Add Vercel Frontend Environment Variable
In your Vercel project settings, add:

```bash
VITE_API_BASE_URL=https://ashok-inn-hotel-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

### 7. Deploy Frontend Changes
Push to GitHub:
```bash
git add -A
git commit -m "Update backend API URL for Render deployment"
git push
```

Vercel will auto-deploy the frontend.

## Testing:
1. Wait for Render deployment to complete (first deploy takes 2-3 minutes)
2. Make sure the new environment variables are saved on Render and Vercel
3. Visit your Vercel frontend: https://ashokinn.com/login
4. Try to login and open the booking page
5. Check Render logs if any issues

## Troubleshooting:
- **MongoDB connection error:** Verify MONGODB_URI in Render env vars
- **404 Not Found:** Backend URL in api.ts might be wrong
- **CORS error:** Check if frontend URL is whitelisted
- **UPI option not showing:** Make sure `HOTEL_UPI_ID` is set on the deployed backend and redeploy/restart Render
- Check logs in Render dashboard for detailed errors

## Important Notes:
⚠️ Free tier on Render will spin down after 15 minutes of inactivity
✓ All your data persists in MongoDB Atlas (separate)
✓ Frontend stays on Vercel (always active)
