# Quick Setup Guide

## 🚀 Get Your Comments Backend Running in 5 Minutes

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- AniList OAuth app (optional, for enhanced features)

---

## ⚡ Quick Setup

### 1. Clone & Install
```bash
git clone https://github.com/your-username/comments-backend.git
cd comments-backend
npm install
```

### 2. Database Setup
```bash
# Copy environment file
cp .env.example .env.local

# Add your database URL
echo "POSTGRES_URL=postgresql://username:password@localhost:5432/comments_db" >> .env.local

# Push database schema
npm run db:push
```

### 3. Start Development Server
```bash
npm run dev
```

Your backend is now running at `http://localhost:3000/api`! 🎉

---

## 🌐 Vercel Deployment (One-Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/comments-backend)

1. Click the button above
2. Connect your GitHub account
3. Add your `POSTGRES_URL` environment variable
4. Click Deploy

---

## 📱 Test Your Backend

### Test with curl
```bash
# Get comments (no auth required)
curl "https://your-backend.vercel.app/api/comments?media_id=12345"

# Create comment (requires AniList token)
curl -X POST "https://your-backend.vercel.app/api/comments" \
  -H "Authorization: Bearer YOUR_ANILIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "media_id": 12345,
    "media_type": "ANIME", 
    "content": "Hello from the API!"
  }'
```

### Test with Postman
Import this collection:
```json
{
  "info": {
    "name": "Comments Backend",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Comments",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/comments?media_id=12345",
          "host": ["{{baseUrl}}"],
          "path": ["comments"],
          "query": [
            {"key": "media_id", "value": "12345"}
          ]
        }
      }
    },
    {
      "name": "Create Comment",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Authorization", "value": "Bearer {{anilistToken}}"},
          {"key": "Content-Type", "value": "application/json"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"media_id\": 12345,\n  \"media_type\": \"ANIME\",\n  \"content\": \"Test comment\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/comments",
          "host": ["{{baseUrl}}"],
          "path": ["comments"]
        }
      }
    }
  ],
  "variable": [
    {"key": "baseUrl", "value": "https://your-backend.vercel.app/api"},
    {"key": "anilistToken", "value": "your_anilist_token_here"}
  ]
}
```

---

## 🔧 Configuration

### Environment Variables
```bash
# Required
POSTGRES_URL="postgresql://username:password@host:port/database"

# Optional (for custom AniList OAuth)
ANILIST_CLIENT_ID="your_client_id"
ANILIST_CLIENT_SECRET="your_client_secret"

# Optional (Super Admin override - default: 5724017)
SUPER_ADMIN_USER_ID="5724017"
```

### Database Providers
- **Vercel Postgres**: Recommended for Vercel deployment
- **Supabase**: Free PostgreSQL with connection strings
- **Railway**: Simple PostgreSQL hosting
- **Local**: PostgreSQL on your machine

---

## 🎯 Next Steps

1. **Read the Full Documentation**: `COMPLETE_DOCUMENTATION.md`
2. **Check Integration Guide**: `INTEGRATION_GUIDE.md`
3. **Explore API Endpoints**: Test all available features
4. **Integrate with Your App**: Follow the integration guide
5. **Configure Admin Features**: Set up moderators and admins

---

## 🆘 Need Help?

- **Documentation**: Check `COMPLETE_DOCUMENTATION.md`
- **Issues**: Open an issue on GitHub
- **Discord**: Join our community server
- **Email**: support@your-comments-backend.com

---

**Happy Coding! 🎉**