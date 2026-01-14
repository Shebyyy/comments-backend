# AnymeX Comments Backend

A Vercel Serverless Functions backend for the AnymeX app's comment system, using Vercel Postgres and AniList OAuth authentication.

## Features

- **AniList Authentication**: Users authenticate via AniList OAuth tokens
- **Hierarchical Comments**: Support for nested replies
- **Voting System**: Upvote/downvote with vote tracking
- **Role-based Permissions**: User, Moderator, and Admin roles
- **Rate Limiting**: Prevent spam and abuse
- **Soft Delete**: Comments are marked as deleted but preserved for thread integrity
- **Real-time Vote Counts**: Automatic vote count updates via database triggers

## API Endpoints

### GET /api/comments
Fetch comments for a media item.

**Query Parameters:**
- `media_id` (required): AniList media ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Comments per page, max 50 (default: 20)
- `tag` (optional): Comment tag (default: "general")
- `sort` (optional): Sort order - "newest", "oldest", "top" (default: "newest")

**Response:**
```json
{
  "success": true,
  "data": {
    "comments": [...],
    "hasMore": true,
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### POST /api/comments
Create a new comment.

**Headers:**
- `Authorization: Bearer <anilist_token>`

**Body:**
```json
{
  "media_id": 12345,
  "content": "Great anime!",
  "parent_comment_id": "uuid", // optional, for replies
  "tag": "general" // optional
}
```

### POST /api/comments/vote
Vote on a comment.

**Headers:**
- `Authorization: Bearer <anilist_token>`

**Body:**
```json
{
  "comment_id": "uuid",
  "vote_type": 1 // 1 for upvote, -1 for downvote
}
```

### DELETE /api/comments/[id]
Delete a comment.

**Headers:**
- `Authorization: Bearer <anilist_token>`

**Permissions:**
- Users can delete their own comments
- Moderators can delete any non-admin comment
- Admins can delete any comment

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd anymex-comments-backend
npm install
```

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```bash
cp .env.local.example .env.local
```

Configure your Vercel Postgres database URL:

```env
POSTGRES_URL="your_vercel_postgres_url"
POSTGRES_PRISMA_URL="your_vercel_postgres_prisma_url"
POSTGRES_URL_NON_POOLING="your_vercel_postgres_non_pooling_url"
```

### 3. Database Migration

Run the database migration:

```bash
npm run migrate
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

## Database Schema

The system uses four main tables:

- **users**: Synced with AniList user data
- **comments**: Hierarchical comment structure with vote tracking
- **comment_votes**: Individual user votes on comments
- **rate_limits**: Rate limiting for abuse prevention

## Authentication

The system uses AniList OAuth tokens for authentication:

1. User provides AniList OAuth token
2. Backend verifies token with AniList GraphQL API
3. User data is synced to local database
4. Permissions are assigned based on AniList moderator status

## Rate Limiting

Default rate limits (per hour):
- **Comments**: 5 per hour
- **Votes**: 20 per hour  
- **Deletes**: 10 per hour

## Permission System

- **User**: Create, edit own comments, delete own comments
- **Moderator**: All user permissions + delete any non-admin comment
- **Admin**: All permissions

## Integration with AnymeX

To integrate with the AnymeX Flutter app:

1. Update the `CommentsDatabase` class in AnymeX to use these endpoints
2. Pass AniList tokens in Authorization headers
3. Handle the new response format

Example Flutter integration:

```dart
class CommentsDatabase {
  final String baseUrl = 'https://your-app.vercel.app/api';
  
  Future<List<Comment>> fetchComments(String mediaId) async {
    final token = await storage.get('auth_token');
    final response = await http.get(
      Uri.parse('$baseUrl/comments?media_id=$mediaId'),
      headers: {'Authorization': 'Bearer $token'}
    );
    
    final data = json.decode(response.body);
    return Comment.fromJsonList(data['data']['comments']);
  }
  
  Future<Comment> addComment(String mediaId, String content) async {
    final token = await storage.get('auth_token');
    final response = await http.post(
      Uri.parse('$baseUrl/comments'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'media_id': int.parse(mediaId),
        'content': content
      })
    );
    
    final data = json.decode(response.body);
    return Comment.fromJson(data['data']);
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run locally (requires database connection)
npm run dev

# Run migration
npm run migrate

# Build for production
npm run build
```

## Security Considerations

- All endpoints require valid AniList OAuth tokens
- Rate limiting prevents spam and abuse
- SQL injection protection via parameterized queries
- Soft delete preserves thread integrity
- Role-based access control
- Input validation and sanitization