# Vercel Deployment Guide

## Prerequisites

- [Vercel Account](https://vercel.com/signup)
- [MongoDB Atlas Account](https://www.mongodb.com/cloud/atlas) (or self-hosted MongoDB)
- Node.js 18+ installed locally

## Environment Variables

**IMPORTANT**: You must manually set these environment variables in your Vercel project dashboard (Settings → Environment Variables):

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | Yes | `your-super-secret-jwt-key-min-32-chars` |
| `COOKIE_NAME` | Name of the session cookie | Yes | `contact_erp_session` |
| `NEXT_PUBLIC_APP_NAME` | Application name shown in UI | No | `Contact Mobile ERP` |

### How to Set Environment Variables in Vercel:

1. Go to your Vercel Dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: Variable name (e.g., `MONGODB_URI`)
   - **Value**: The actual value
   - **Environment**: Select Production (and optionally Preview/Development)
5. Click **Save**
6. Redeploy your project for changes to take effect

> ⚠️ **Note**: Do not commit sensitive values like `MONGODB_URI` or `JWT_SECRET` to your repository. Use the Vercel dashboard to set them securely.

## Deployment Steps

### 1. Prepare Your MongoDB

1. Create a MongoDB Atlas cluster (or ensure your MongoDB is accessible)
2. Create a database user
3. Whitelist Vercel IP addresses or allow access from anywhere (0.0.0.0/0)
4. Copy the connection string

### 2. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

#### Option B: Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Import project in Vercel dashboard
3. Configure environment variables
4. Deploy

### 3. Configure Environment Variables

In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add the required variables from the table above
3. Redeploy if necessary

## Post-Deployment Checklist

- [ ] Application loads without errors
- [ ] Login/signup works correctly
- [ ] Database connections are successful
- [ ] API routes respond correctly
- [ ] Images and assets load properly
- [ ] Mobile responsiveness works

## Troubleshooting

### Build Failures

Check build logs in Vercel dashboard for:
- TypeScript errors
- Missing dependencies
- Environment variable issues

### MongoDB Connection Issues

1. Verify `MONGODB_URI` is set correctly
2. Check IP whitelist in MongoDB Atlas
3. Ensure database user has correct permissions

### API Route Timeouts

API routes have a 30-second timeout configured in `vercel.json`. For long-running operations, consider:
- Breaking operations into smaller chunks
- Using background jobs
- Implementing progress tracking

## Performance Optimization

The app is configured with:
- Server-side pagination (100 items per page)
- Infinite scroll for large datasets
- Request debouncing (300ms)
- AbortController for request cancellation
- Rate limiting (100 req/min per user)

## Security Features

- JWT-based authentication
- HTTP-only cookies
- Security headers (X-Frame-Options, X-XSS-Protection, etc.)
- Input sanitization
- Rate limiting
- Company-scoped data access

## Support

For issues specific to this ERP application:
1. Check the browser console for errors
2. Review Vercel function logs
3. Verify MongoDB connection status
4. Check environment variable configuration
