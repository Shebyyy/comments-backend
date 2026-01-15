# 🚀 Quick Start - 5 Minute Deployment

## 1️⃣ Push to GitHub

```bash
cd anymex-comments-backend

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: AnymeX Comments Backend"

# Create GitHub repository at: https://github.com/new
# Then run:
git remote add origin https://github.com/YOUR_USERNAME/anymex-comments-backend.git
git branch -M main
git push -u origin main
```

## 2️⃣ Deploy to Vercel

### A) Import Repository (Easiest)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your repository
4. Click **"Deploy"**

### B) Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod
```

## 3️⃣ Add Database

1. In Vercel Dashboard → **Storage** → **Create Database**
2. Choose **Postgres** → **Continue**
3. Select your project → **Create**
4. Copy the connection strings

## 4️⃣ Configure Environment Variables

In Vercel Project → **Settings** → **Environment Variables**:

```env
POSTGRES_URL=your_postgres_url_here
POSTGRES_PRISMA_URL=your_postgres_prisma_url_here
POSTGRES_URL_NON_POOLING=your_postgres_non_pooling_url_here
ADMIN_ANILIST_IDS=YOUR_ANILIST_ID_HERE
```

**Get URLs from:** Vercel → Storage → Your Database → **".env.local"** tab

## 5️⃣ Run Database Migration

```bash
# After deployment, run:
node setup.js
```

## 6️⃣ Test It!

```bash
# Test basic endpoint
curl https://your-app.vercel.app/api/comments?media_id=1

# Test with AniList token (get from anilist.co/settings/developer)
curl -X POST https://your-app.vercel.app/api/comments \
  -H "Authorization: Bearer YOUR_ANILIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"media_id": 1, "content": "First comment!"}'
```

## 🎉 Done!

Your comment system is now live at: `https://your-app.vercel.app`

**Next:** Update your AnymeX app to use the new API endpoints!