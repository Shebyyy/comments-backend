# 🚀 Deployment Guide - AnymeX Comments Backend

## Quick Setup (5 minutes)

### 1. 📋 Prerequisites
- GitHub account
- Vercel account (free tier works)
- Node.js 18+ installed locally

### 2. 🛠️ Local Setup

```bash
# Clone or navigate to your project
cd anymex-comments-backend

# Run the setup script
./setup.sh

# Or manual setup:
npm install
cp .env.local.example .env.local
```

### 3. 📊 Create Vercel Postgres Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Storage"** → **"Create Database"**
3. Choose **Postgres** → **"Continue"**
4. Select your project (or create new one)
5. Click **"Create"**

### 4. 🔐 Configure Environment Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

```env
POSTGRES_URL=your_postgres_url_here
POSTGRES_PRISMA_URL=your_postgres_prisma_url_here
POSTGRES_URL_NON_POOLING=your_postgres_non_pooling_url_here
ADMIN_ANILIST_IDS=1,12345,67890  # Optional: Your AniList ID
MOD_ANILIST_IDS=11111,22222,33333   # Optional: Moderator IDs
```

**Get the database URLs from:**
Vercel Dashboard → Storage → Your Database → **".env.local"** tab

### 5. 📤 Deploy to Vercel

#### Option A: GitHub Integration (Recommended)

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit: AnymeX Comments Backend"
git branch -M main
git remote add origin https://github.com/yourusername/anymex-comments-backend.git
git push -u origin main
```

2. **Import to Vercel:**
- Go to [Vercel](https://vercel.com/new)
- Click **"Import Git Repository"**
- Select your GitHub repository
- Click **"Deploy"**

#### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 6. 🗄️ Run Database Migration

After deployment, run the migration:

```bash
# Using Vercel CLI
vercel env pull .env.production
node setup.js

# Or run remotely (add this as a Vercel Function):
# https://your-app.vercel.app/api/db/migrate
```

## 🔧 Testing the Deployment

### Test Database Connection
```bash
curl https://your-app.vercel.app/api/comments?media_id=1
```

### Test with AniList Token
```bash
# Get your AniList token from: https://anilist.co/settings/developer
curl -X POST https://your-app.vercel.app/api/comments \
  -H "Authorization: Bearer YOUR_ANILIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"media_id": 1, "content": "Test comment from setup"}'
```

## 🔗 Integration with AnymeX App

Update your AnymeX app's `CommentsDatabase` class:

```dart
class CommentsDatabase {
  final String baseUrl = 'https://your-app.vercel.app/api';
  
  Future<List<Comment>> fetchComments(String animeId) async {
    final token = await storage.get('auth_token');
    final response = await http.get(
      Uri.parse('$baseUrl/comments?media_id=$animeId'),
      headers: {'Authorization': 'Bearer $token'}
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success']) {
        return (data['data']['comments'] as List)
            .map((c) => Comment.fromJson(c))
            .toList();
      }
    }
    return [];
  }
  
  Future<Comment?> addComment({
    required String comment,
    required String mediaId,
    required String tag,
  }) async {
    final token = await storage.get('auth_token');
    final response = await http.post(
      Uri.parse('$baseUrl/comments'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'media_id': int.parse(mediaId),
        'content': comment,
        'tag': tag,
      }),
    );
    
    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      if (data['success']) {
        return Comment.fromJson(data['data']);
      }
    }
    return null;
  }
  
  Future<Map<String, dynamic>?> voteComment(
    int commentId, 
    int voteType
  ) async {
    final token = await storage.get('auth_token');
    final response = await http.post(
      Uri.parse('$baseUrl/comments/vote'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'comment_id': commentId.toString(),
        'vote_type': voteType,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success']) {
        return data['data'];
      }
    }
    return null;
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

**1. Database Connection Error**
```
Error: Database connection failed
```
- Verify your POSTGRES_URL in Vercel environment variables
- Make sure the database is created and connected to your project

**2. Invalid AniList Token**
```
Error: Invalid or expired AniList token
```
- Get a fresh token from: https://anilist.co/settings/developer
- Make sure the token is passed in Authorization header

**3. Rate Limit Error**
```
Error: Rate limit exceeded for comment
```
- Default limits: 5 comments/hour, 20 votes/hour
- Wait for the rate limit window to reset

**4. CORS Issues**
- The backend handles CORS automatically
- Make sure you're making requests from your deployed app URL

### Debug Mode

Add debug logging by setting:
```env
NODE_ENV=development
```

### Reset Database

If you need to reset everything:
```sql
-- Connect to your database and run:
DROP TABLE IF EXISTS comment_votes CASCADE;
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

Then re-run the migration.

## 📊 Monitoring

### Vercel Analytics
- Go to Vercel Dashboard → Your Project → Analytics
- Monitor API usage, errors, and performance

### Database Monitoring
- Vercel Dashboard → Storage → Your Database
- Monitor connections, queries, and storage

## 🔄 Updating the Backend

1. Make changes to your code
2. Test locally: `npm run dev`
3. Commit and push to GitHub
4. Vercel will automatically deploy

## 🎯 Next Steps

1. ✅ Deploy backend to Vercel
2. ✅ Test API endpoints
3. ✅ Update AnymeX app CommentsDatabase class
4. ✅ Enable comments tab in AnymeX detail pages
5. ✅ Add your AniList ID as admin in environment variables

Your comment system is now live! 🎉