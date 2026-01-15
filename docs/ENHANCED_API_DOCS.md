# Enhanced Comments Backend API Documentation

## Overview

This enhanced comments backend provides comprehensive admin/mod controls, user management, and advanced comment features for the AnymeX application.

## Authentication

All API endpoints (except GET comments) require an AniList OAuth token in the Authorization header:

```
Authorization: Bearer <anilist_token>
```

## New Features Implemented

### 1. Enhanced Admin/Mod Controls

**Admin Override**: Admin users (like you) have complete override permissions and can control everything.

#### Ban User
```http
POST /api/admin/actions?action=ban
```

**Body:**
```json
{
  "user_id": 123456,
  "reason": "Spam and inappropriate content",
  "duration_hours": 24,
  "is_permanent": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ban_id": "ban_123",
    "user_id": 123456,
    "banned_by": 5724017,
    "reason": "Spam and inappropriate content",
    "is_permanent": false,
    "expires_at": "2024-01-15T10:30:00Z"
  },
  "message": "User banned successfully"
}
```

#### Warn User
```http
POST /api/admin/actions?action=warn
```

**Body:**
```json
{
  "user_id": 123456,
  "reason": "Inappropriate language",
  "description": "Used offensive language in comments"
}
```

#### Promote/Demote User
```http
POST /api/admin/actions?action=promote
POST /api/admin/actions?action=demote
```

**Body:**
```json
{
  "user_id": 123456,
  "role": "mod" // or "admin"
}
```

### 2. Comment Editing

#### Edit Comment
```http
PUT /api/comments/{comment_id}/edit
```

**Body:**
```json
{
  "content": "Updated comment content",
  "reason": "Fixed typo"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "comment_123",
    "content": "Updated comment content",
    "is_edited": true,
    "edit_history": [
      {
        "content": "Original comment content",
        "edited_at": "2024-01-14T10:00:00Z",
        "reason": null
      }
    ],
    "updated_at": "2024-01-14T11:00:00Z"
  },
  "message": "Comment updated successfully"
}
```

### 3. Report System

#### Report Comment
```http
POST /api/comments/reports
```

**Body:**
```json
{
  "comment_id": "comment_123",
  "reason": "Spam",
  "description": "This is spam content"
}
```

#### View Reports (Mods/Admins)
```http
GET /api/comments/reports?status=PENDING&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "report_123",
        "comment_id": "comment_123",
        "reporter_user_id": 789012,
        "reason": "Spam",
        "description": "This is spam content",
        "status": "PENDING",
        "created_at": "2024-01-14T10:00:00Z",
        "reporter": {
          "username": "reporter_user",
          "profile_picture_url": "https://example.com/avatar.jpg"
        },
        "comment": {
          "id": "comment_123",
          "content": "Spam content here",
          "username": "spam_user",
          "created_at": "2024-01-14T09:00:00Z"
        }
      }
    ],
    "hasMore": true,
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

### 4. Vote Viewing

#### View Comment Votes (Long Press)
```http
GET /api/comments/{comment_id}/votes
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comment_id": "comment_123",
    "upvotes": [
      {
        "user_id": 123456,
        "username": "user1",
        "profile_picture_url": "https://example.com/avatar1.jpg",
        "created_at": "2024-01-14T10:00:00Z"
      }
    ],
    "downvotes": [
      {
        "user_id": 789012,
        "username": "user2",
        "profile_picture_url": "https://example.com/avatar2.jpg",
        "created_at": "2024-01-14T10:05:00Z"
      }
    ]
  }
}
```

### 5. Enhanced Voting

#### Vote on Comment (Including Own Comments)
```http
POST /api/comments/vote
```

**Body:**
```json
{
  "comment_id": "comment_123",
  "vote_type": 1 // 1 for upvote, -1 for downvote
}
```

**Note**: Users can now vote on their own comments (all users have this permission).

### 6. Nested Replies

The system now supports unlimited nesting of replies. Users can reply to replied comments, creating deep comment threads.

#### Create Nested Reply
```http
POST /api/comments
```

**Body:**
```json
{
  "media_id": 12345,
  "content": "This is a reply to a reply",
  "parent_comment_id": "reply_comment_123"
}
```

### 7. Enhanced Deletion

Users can now delete replied comments. When mods/admins delete a comment, all replies are also deleted recursively.

#### Delete Comment
```http
DELETE /api/comments/{comment_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

## Permission System

### User Roles & Permissions

#### User Permissions:
- Read comments
- Create comments  
- Edit own comments
- Delete own comments
- Vote on own comments ✨ *NEW*
- Report comments ✨ *NEW*

#### Moderator Permissions:
- All user permissions
- Delete any comment (except admin comments)
- Warn users ✨ *NEW*
- View reports ✨ *NEW*
- Review reports ✨ *NEW*
- View vote lists ✨ *NEW*

#### Admin Permissions:
- All permissions (override) ✨ *NEW*
- Ban users ✨ *NEW*
- Promote/demote users ✨ *NEW*
- Complete control over everything

### Special Admin Override

User ID **5724017** (ASheby) has automatic admin override permissions and can:
- Delete any comment regardless of permissions
- Ban any user including other mods/admins
- Promote/demote any user
- View all reports and votes
- Complete system override

## Database Schema Changes

### New User Fields:
- `is_banned`: Boolean flag for ban status
- `ban_reason`: Reason for ban
- `ban_expires`: Ban expiration date
- `warning_count`: Number of active warnings

### New Comment Fields:
- `is_edited`: Boolean flag for edit status
- `edit_history`: JSON array of edit history

### New Tables:
- `reports`: Comment reports
- `bans`: User ban records
- `warnings`: User warning records

## Enhanced Comment Response Format

All comment responses now include:
```json
{
  "id": "comment_123",
  "content": "Comment content",
  "is_edited": true,
  "edit_history": [...],
  "user_vote": 1,
  "is_mod": false,
  "is_admin": false,
  "replies": [
    {
      "id": "reply_123",
      "content": "Reply content",
      "is_edited": false,
      "user_vote": 0,
      // ... all same fields as parent comments
    }
  ]
}
```

## Rate Limiting

New rate limits for admin actions:
- Comments: 5 per hour
- Votes: 20 per hour  
- Deletes: 10 per hour
- Edits: 10 per hour ✨ *NEW*
- Reports: 5 per hour ✨ *NEW*
- Bans: 10 per hour ✨ *NEW*
- Warnings: 20 per hour ✨ *NEW*

## Integration Examples

### Flutter Integration

```dart
class EnhancedCommentsDatabase {
  final String baseUrl = 'https://your-app.vercel.app/api';
  
  // Edit comment
  Future<Comment> editComment(String commentId, String content, {String? reason}) async {
    final token = await storage.get('auth_token');
    final response = await http.put(
      Uri.parse('$baseUrl/comments/$commentId/edit'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'content': content,
        if (reason != null) 'reason': reason
      })
    );
    
    final data = json.decode(response.body);
    return Comment.fromJson(data['data']);
  }
  
  // Report comment
  Future<void> reportComment(String commentId, String reason, {String? description}) async {
    final token = await storage.get('auth_token');
    await http.post(
      Uri.parse('$baseUrl/comments/reports'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'comment_id': commentId,
        'reason': reason,
        if (description != null) 'description': description
      })
    );
  }
  
  // View votes (long press)
  Future<VoteList> getCommentVotes(String commentId) async {
    final token = await storage.get('auth_token');
    final response = await http.get(
      Uri.parse('$baseUrl/comments/$commentId/votes'),
      headers: {'Authorization': 'Bearer $token'}
    );
    
    final data = json.decode(response.body);
    return VoteList.fromJson(data['data']);
  }
  
  // Admin actions
  Future<void> banUser(int userId, String reason, {int? durationHours}) async {
    final token = await storage.get('auth_token');
    await http.post(
      Uri.parse('$baseUrl/admin/actions?action=ban'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'user_id': userId,
        'reason': reason,
        if (durationHours != null) 'duration_hours': durationHours
      })
    );
  }
  
  Future<void> promoteUser(int userId, String role) async {
    final token = await storage.get('auth_token');
    await http.post(
      Uri.parse('$baseUrl/admin/actions?action=promote'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      },
      body: json.encode({
        'user_id': userId,
        'role': role
      })
    );
  }
}
```

## Security Considerations

1. **Admin Validation**: Only admins can manage other admins
2. **Self-Action Prevention**: Users cannot ban/warn/promote themselves
3. **Hierarchy Protection**: Mods cannot target other mods/admins (except admins can override)
4. **Rate Limiting**: All actions are rate limited to prevent abuse
5. **Permission Checks**: Every action validates user permissions
6. **Audit Trail**: All admin actions are logged in the database

## Deployment Notes

1. Run `bun run db:push` to apply schema changes
2. Update environment variables with new database connection strings
3. Test all new endpoints before deploying to production
4. Monitor rate limiting and admin action logs

All requested features have been successfully implemented! 🎉