# Enhanced Comments Backend - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Authentication](#authentication)
7. [Rate Limiting](#rate-limiting)
8. [Permission System](#permission-system)
9. [Integration Guide](#integration-guide)
10. [Deployment](#deployment)
11. [Examples](#examples)

---

## 🎯 Overview

The Enhanced Comments Backend is a comprehensive, production-ready comment system built with **Next.js 14**, **TypeScript**, and **PostgreSQL** via **Prisma ORM**. It provides advanced moderation features, nested replies, real-time voting, and a sophisticated permission system designed specifically for anime/manga communities.

### Key Technologies
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: AniList token-based auth
- **Deployment**: Vercel-ready with environment variables

---

## ✨ Features

### 🗣️ Core Comment Features
- **Nested Replies**: Unlimited depth comment threading
- **Rich Content**: Support for text content with 2000 character limit
- **Edit History**: Track comment edits with reasons and timestamps
- **Media Association**: Comments for anime/manga with media ID and type
- **Sorting Options**: Newest, oldest, and top (by votes)

### 👍 Voting System
- **Upvote/Downvote**: Users can vote on comments
- **Vote Toggle**: Click to vote, click again to remove vote
- **Vote Viewing**: Moderators can see who voted on comments
- **Own Vote Restrictions**: Configurable ability to vote on own comments

### 🛡️ Moderation & Admin
- **Role-Based Permissions**: User, Moderator, Admin, Super Admin
- **Comment Management**: Edit, delete, and moderate comments
- **User Management**: Ban, warn, promote, and demote users
- **Report System**: Users can report inappropriate content
- **Super Admin Override**: Complete control for super admins (User ID: 5724017)

### 🔒 Security & Performance
- **Rate Limiting**: Comprehensive rate limiting for all actions
- **Input Validation**: Strict validation and sanitization
- **Permission Checks**: Multi-layer permission verification
- **Database Optimization**: Efficient queries with proper indexing

---

## 🏗️ Architecture

### Directory Structure
```
comments-backend/
├── app/
│   └── api/
│       ├── auth/
│       │   └── verify.ts          # AniList token verification
│       ├── comments/
│       │   ├── route.ts           # GET/POST comments
│       │   ├── vote/
│       │   │   └── route.ts       # Vote on comments
│       │   ├── [id]/
│       │   │   ├── route.ts       # GET/DELETE comments
│       │   │   ├── edit/
│       │   │   │   └── route.ts   # Edit comments
│       │   │   └── votes/
│       │   │       └── route.ts   # Get comment votes
│       │   └── reports/
│       │       └── route.ts       # Comment reports
│       ├── admin/
│       │   └── actions/
│       │       └── route.ts       # Admin actions (ban/warn/promote)
│       ├── super-admin/
│       │   └── route.ts           # Super admin endpoints
│       └── db/
│           ├── connection.ts      # Database connection
│           └── migrate.ts         # Database migration
├── lib/
│   ├── types.ts                   # TypeScript interfaces
│   ├── permissions.ts             # Permission logic
│   └── rate-limit.ts              # Rate limiting
├── prisma/
│   └── schema.prisma              # Database schema
└── package.json
```

### Request Flow
1. **Authentication**: Verify AniList token
2. **Rate Limiting**: Check action limits
3. **Permission Verification**: Validate user permissions
4. **Database Operations**: Execute requested action
5. **Response**: Return formatted JSON response

---

## 🗄️ Database Schema

### Core Models

#### User
```sql
- anilist_user_id (Int, Unique)  # AniList user ID
- username (String)               # AniList username
- profile_picture_url (String?)   # Profile image URL
- is_mod (Boolean)                # Moderator status
- is_admin (Boolean)              # Admin status
- is_banned (Boolean)             # Ban status
- ban_reason (String?)            # Ban reason
- ban_expires (DateTime?)         # Ban expiration
- warning_count (Int)             # Warning counter
- last_active (DateTime)          # Last activity
```

#### Comment
```sql
- id (String, ID)                 # Unique comment ID
- media_id (Int)                  # AniList media ID
- media_type (MediaType)          # ANIME or MANGA
- content (String)                # Comment content
- anilist_user_id (Int)           # Author's AniList ID
- parent_comment_id (String?)     # Parent comment for replies
- upvotes (Int)                   # Upvote count
- downvotes (Int)                 # Downvote count
- is_deleted (Boolean)            # Soft delete flag
- is_edited (Boolean)             # Edit status
- edit_history (Json?)            # Edit history array
```

#### Vote
```sql
- comment_id (String)             # Comment reference
- user_id (Int)                   # Voter's AniList ID
- vote_type (Int)                 # 1 (upvote) or -1 (downvote)
- Unique constraint on [comment_id, user_id]
```

#### Report, Ban, Warning
- **Report**: User reports for inappropriate content
- **Ban**: User bans with duration and reason
- **Warning**: User warnings with descriptions

---

## 🔌 API Reference

### Base URL
```
https://your-comments-backend.vercel.app/api
```

### Authentication
All protected endpoints require:
```
Authorization: Bearer <anilist_token>
```

### Comments API

#### GET /api/comments
Fetch comments for a media item.

**Query Parameters:**
- `media_id` (required): AniList media ID
- `media_type` (optional): "ANIME" or "MANGA" (default: "ANIME")
- `page` (optional): Page number (default: 1)
- `limit` (optional): Comments per page, max 50 (default: 20)
- `sort` (optional): "newest", "oldest", "top" (default: "newest")
- `parent_id` (optional): Get replies for specific comment

**Response:**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "cm_123...",
        "media_id": 12345,
        "media_type": "ANIME",
        "content": "Great episode!",
        "anilist_user_id": 67890,
        "parent_comment_id": null,
        "upvotes": 5,
        "downvotes": 1,
        "user_vote": 1,
        "is_mod": false,
        "is_admin": false,
        "is_edited": false,
        "is_deleted": false,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "username": "User123",
        "profile_picture_url": "https://...",
        "replies": []
      }
    ],
    "hasMore": true,
    "total": 25,
    "page": 1,
    "limit": 20
  }
}
```

#### POST /api/comments
Create a new comment.

**Request Body:**
```json
{
  "media_id": 12345,
  "media_type": "ANIME",
  "content": "This was amazing!",
  "parent_comment_id": "cm_123..." // optional for replies
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cm_456...",
    "media_id": 12345,
    "content": "This was amazing!",
    "user_vote": 0,
    "replies": []
  },
  "message": "Comment created successfully"
}
```

### Voting API

#### POST /api/comments/vote
Vote on a comment.

**Request Body:**
```json
{
  "comment_id": "cm_123...",
  "vote_type": 1  // 1 for upvote, -1 for downvote
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vote_type": 1,
    "upvotes": 6,
    "downvotes": 1,
    "total_votes": 7
  },
  "message": "Vote recorded successfully"
}
```

#### GET /api/comments/[id]/votes
Get vote list for a comment (moderator/admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "comment_id": "cm_123...",
    "upvotes": [
      {
        "user_id": 67890,
        "username": "User123",
        "profile_picture_url": "https://...",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "downvotes": []
  }
}
```

### Comment Management API

#### PUT /api/comments/[id]/edit
Edit a comment.

**Request Body:**
```json
{
  "content": "Updated comment content",
  "reason": "Fixed typo" // optional
}
```

#### DELETE /api/comments/[id]
Delete a comment.

**Response:**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

### Admin API

#### POST /api/admin/actions?action=ban
Ban a user.

**Request Body:**
```json
{
  "user_id": 67890,
  "reason": "Spam and harassment",
  "duration_hours": 24, // optional
  "is_permanent": false  // optional
}
```

#### POST /api/admin/actions?action=warn
Warn a user.

**Request Body:**
```json
{
  "user_id": 67890,
  "reason": "Inappropriate language",
  "description": "Used offensive words in comments"
}
```

#### POST /api/admin/actions?action=promote
Promote a user to moderator/admin.

**Request Body:**
```json
{
  "user_id": 67890,
  "role": "mod" // or "admin"
}
```

### Reports API

#### GET /api/comments/reports
Get comment reports (moderator/admin only).

**Query Parameters:**
- `status` (optional): "PENDING", "REVIEWED", "RESOLVED", "DISMISSED"

#### POST /api/comments/reports
Report a comment.

**Request Body:**
```json
{
  "comment_id": "cm_123...",
  "reason": "Spam",
  "description": "This is clearly spam content"
}
```

---

## 🔐 Authentication

### AniList Token Integration
The backend uses AniList OAuth tokens for authentication:

1. **User Login**: Get AniList token from your app
2. **Token Verification**: Backend validates token with AniList API
3. **User Upsert**: Automatically creates/updates user in database
4. **Permission Sync**: Syncs AniList moderator status

### Token Verification Process
```typescript
// The backend verifies tokens by calling AniList API
const anilistUser = await verifyAniListToken(token);
// Returns user data with ID, name, avatar, and moderator status
```

### Super Admin System
- **Super Admin ID**: 5724017 (ASheby)
- **Override Power**: Can bypass all permission checks
- **Complete Control**: Full access to all admin functions

---

## ⚡ Rate Limiting

### Rate Limits by Action
```typescript
{
  comment: { max: 5, window: 60 },    // 5 comments per hour
  vote: { max: 20, window: 60 },      // 20 votes per hour
  delete: { max: 10, window: 60 },    // 10 deletions per hour
  edit: { max: 15, window: 60 },      // 15 edits per hour
  report: { max: 10, window: 60 },    // 10 reports per hour
  ban: { max: 5, window: 1440 },      // 5 bans per day
  warn: { max: 20, window: 60 }       // 20 warnings per hour
}
```

### Rate Limit Response
```json
{
  "success": false,
  "error": "Rate limit exceeded for comment. Maximum 5 per 60 minutes."
}
```

---

## 🛡️ Permission System

### Role Hierarchy
1. **Super Admin** (User ID: 5724017) - Complete override
2. **Admin** - Can manage moderators, ban, warn, promote
3. **Moderator** - Can delete comments, warn users, view votes
4. **User** - Can comment, vote, report

### Permission Matrix

| Action | User | Mod | Admin | Super Admin |
|--------|------|-----|-------|-------------|
| Comment | ✅ | ✅ | ✅ | ✅ |
| Vote | ✅ | ✅ | ✅ | ✅ |
| Edit Own | ✅ | ✅ | ✅ | ✅ |
| Edit Any | ❌ | ❌ | ❌ | ✅ |
| Delete Own | ✅ | ✅ | ✅ | ✅ |
| Delete Any | ❌ | ✅ | ✅ | ✅ |
| View Votes | ❌ | ✅ | ✅ | ✅ |
| Warn Users | ❌ | ✅ | ✅ | ✅ |
| Ban Users | ❌ | ❌ | ✅ | ✅ |
| Promote/Demote | ❌ | ❌ | ✅ | ✅ |

---

## 📱 Integration Guide

### Flutter Integration Example

#### 1. Create API Service
```dart
class CommentsApi {
  static const String baseUrl = 'https://your-backend.vercel.app/api';
  
  final String _anilistToken;
  
  CommentsApi(this._anilistToken);
  
  // Get comments for media
  Future<List<Comment>> getComments(int mediaId, {
    String mediaType = 'ANIME',
    int page = 1,
    int limit = 20,
    String sort = 'newest',
    String? parentId,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/comments').replace(queryParameters: {
        'media_id': mediaId.toString(),
        'media_type': mediaType,
        'page': page.toString(),
        'limit': limit.toString(),
        'sort': sort,
        if (parentId != null) 'parent_id': parentId,
      }),
      headers: {
        'Authorization': 'Bearer $_anilistToken',
        'Content-Type': 'application/json',
      },
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return CommentsResponse.fromJson(data['data']).comments;
    } else {
      throw Exception('Failed to load comments');
    }
  }
  
  // Create comment
  Future<Comment> createComment({
    required int mediaId,
    required String content,
    String mediaType = 'ANIME',
    String? parentId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/comments'),
      headers: {
        'Authorization': 'Bearer $_anilistToken',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'media_id': mediaId,
        'media_type': mediaType,
        'content': content,
        if (parentId != null) 'parent_comment_id': parentId,
      }),
    );
    
    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      return Comment.fromJson(data['data']);
    } else {
      throw Exception('Failed to create comment');
    }
  }
  
  // Vote on comment
  Future<VoteResult> voteComment(String commentId, int voteType) async {
    final response = await http.post(
      Uri.parse('$baseUrl/comments/vote'),
      headers: {
        'Authorization': 'Bearer $_anilistToken',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'comment_id': commentId,
        'vote_type': voteType,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return VoteResult.fromJson(data['data']);
    } else {
      throw Exception('Failed to vote on comment');
    }
  }
}
```

#### 2. Create Models
```dart
class Comment {
  final String id;
  final int mediaId;
  final String mediaType;
  final String content;
  final int anilistUserId;
  final String? parentId;
  final int upvotes;
  final int downvotes;
  final int userVote;
  final bool isMod;
  final bool isAdmin;
  final bool isEdited;
  final bool isDeleted;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String username;
  final String? profilePictureUrl;
  final List<Comment> replies;
  
  Comment.fromJson(Map<String, dynamic> json)
      : id = json['id'],
        mediaId = json['media_id'],
        mediaType = json['media_type'],
        content = json['content'],
        anilistUserId = json['anilist_user_id'],
        parentId = json['parent_comment_id'],
        upvotes = json['upvotes'],
        downvotes = json['downvotes'],
        userVote = json['user_vote'] ?? 0,
        isMod = json['is_mod'],
        isAdmin = json['is_admin'],
        isEdited = json['is_edited'] ?? false,
        isDeleted = json['is_deleted'],
        createdAt = DateTime.parse(json['created_at']),
        updatedAt = DateTime.parse(json['updated_at']),
        username = json['username'],
        profilePictureUrl = json['profile_picture_url'],
        replies = (json['replies'] as List? ?? [])
            .map((reply) => Comment.fromJson(reply))
            .toList();
}

class VoteResult {
  final int voteType;
  final int upvotes;
  final int downvotes;
  final int totalVotes;
  
  VoteResult.fromJson(Map<String, dynamic> json)
      : voteType = json['vote_type'],
        upvotes = json['upvotes'],
        downvotes = json['downvotes'],
        totalVotes = json['total_votes'];
}
```

#### 3. Create Controller with GetX
```dart
class CommentsController extends GetxController {
  final CommentsApi _api;
  final int mediaId;
  final String mediaType;
  
  CommentsController({
    required CommentsApi api,
    required this.mediaId,
    this.mediaType = 'ANIME',
  }) : _api = api;
  
  final RxList<Comment> comments = <Comment>[].obs;
  final RxBool isLoading = false.obs;
  final RxBool isSubmitting = false.obs;
  final RxString error = ''.obs;
  
  // Load comments
  Future<void> loadComments({int page = 1}) async {
    try {
      isLoading.value = true;
      error.value = '';
      
      final newComments = await _api.getComments(
        mediaId,
        mediaType: mediaType,
        page: page,
      );
      
      if (page == 1) {
        comments.value = newComments;
      } else {
        comments.addAll(newComments);
      }
    } catch (e) {
      error.value = e.toString();
    } finally {
      isLoading.value = false;
    }
  }
  
  // Create comment
  Future<void> createComment(String content, {String? parentId}) async {
    try {
      isSubmitting.value = true;
      
      final newComment = await _api.createComment(
        mediaId: mediaId,
        content: content,
        mediaType: mediaType,
        parentId: parentId,
      );
      
      if (parentId == null) {
        comments.insert(0, newComment);
      } else {
        // Add as reply
        _addReplyToComment(parentId, newComment);
      }
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isSubmitting.value = false;
    }
  }
  
  // Vote on comment
  Future<void> voteComment(String commentId, int voteType) async {
    try {
      final result = await _api.voteComment(commentId, voteType);
      
      // Update comment in list
      _updateCommentVote(commentId, result);
    } catch (e) {
      Get.snackbar('Error', e.toString());
    }
  }
  
  void _addReplyToComment(String parentId, Comment reply) {
    final parentIndex = comments.indexWhere((c) => c.id == parentId);
    if (parentIndex != -1) {
      comments[parentIndex].replies.add(reply);
      comments.refresh();
    }
  }
  
  void _updateCommentVote(String commentId, VoteResult result) {
    // Find and update comment (including replies)
    for (final comment in comments) {
      if (comment.id == commentId) {
        comment.upvotes = result.upvotes;
        comment.downvotes = result.downvotes;
        comment.userVote = result.voteType;
        comments.refresh();
        return;
      }
      
      // Check replies
      for (final reply in comment.replies) {
        if (reply.id == commentId) {
          reply.upvotes = result.upvotes;
          reply.downvotes = result.downvotes;
          reply.userVote = result.voteType;
          comments.refresh();
          return;
        }
      }
    }
  }
}
```

#### 4. Create UI Component
```dart
class CommentsSection extends StatelessWidget {
  final CommentsController controller;
  
  const CommentsSection({required this.controller, Key? key}) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isLoading.value && controller.comments.isEmpty) {
        return const Center(child: CircularProgressIndicator());
      }
      
      if (controller.error.value.isNotEmpty) {
        return Center(
          child: Text('Error: ${controller.error.value}'),
        );
      }
      
      return Column(
        children: [
          // Comment input
          _buildCommentInput(context),
          
          // Comments list
          Expanded(
            child: ListView.builder(
              itemCount: controller.comments.length,
              itemBuilder: (context, index) {
                final comment = controller.comments[index];
                return CommentWidget(
                  comment: comment,
                  onVote: (voteType) => controller.voteComment(comment.id, voteType),
                  onReply: (content) => controller.createComment(
                    content,
                    parentId: comment.id,
                  ),
                );
              },
            ),
          ),
        ],
      );
    });
  }
  
  Widget _buildCommentInput(BuildContext context) {
    final textController = TextEditingController();
    
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: textController,
              decoration: const InputDecoration(
                hintText: 'Write a comment...',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
              minLines: 1,
            ),
          ),
          const SizedBox(width: 8),
          Obx(() {
            if (controller.isSubmitting.value) {
              return const CircularProgressIndicator();
            }
            
            return IconButton(
              onPressed: () {
                if (textController.text.trim().isNotEmpty) {
                  controller.createComment(textController.text.trim());
                  textController.clear();
                }
              },
              icon: const Icon(Icons.send),
            );
          }),
        ],
      ),
    );
  }
}

class CommentWidget extends StatelessWidget {
  final Comment comment;
  final Function(int) onVote;
  final Function(String) onReply;
  
  const CommentWidget({
    required this.comment,
    required this.onVote,
    required this.onReply,
    Key? key,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User info
            Row(
              children: [
                CircleAvatar(
                  backgroundImage: comment.profilePictureUrl != null
                      ? NetworkImage(comment.profilePictureUrl!)
                      : null,
                  child: comment.profilePictureUrl == null
                      ? Text(comment.username[0].toUpperCase())
                      : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            comment.username,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          if (comment.isMod) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.blue,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'MOD',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                          if (comment.isAdmin) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.orange,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'ADMIN',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      Text(
                        DateFormat('MMM d, yyyy').format(comment.createdAt),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 8),
            
            // Comment content
            Text(comment.content),
            
            if (comment.isEdited) ...[
              const SizedBox(height: 4),
              Text(
                'edited',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
            
            const SizedBox(height: 8),
            
            // Actions
            Row(
              children: [
                // Upvote
                IconButton(
                  onPressed: () => onVote(1),
                  icon: Icon(
                    comment.userVote == 1 ? Icons.thumb_up : Icons.thumb_up_outlined,
                    color: comment.userVote == 1 ? Colors.blue : null,
                  ),
                ),
                Text('${comment.upvotes}'),
                
                // Downvote
                IconButton(
                  onPressed: () => onVote(-1),
                  icon: Icon(
                    comment.userVote == -1 ? Icons.thumb_down : Icons.thumb_down_outlined,
                    color: comment.userVote == -1 ? Colors.red : null,
                  ),
                ),
                Text('${comment.downvotes}'),
                
                // Reply
                IconButton(
                  onPressed: () => _showReplyDialog(context),
                  icon: const Icon(Icons.reply),
                ),
              ],
            ),
            
            // Replies
            if (comment.replies.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...comment.replies.map(
                (reply) => Padding(
                  padding: const EdgeInsets.only(left: 32),
                  child: CommentWidget(
                    comment: reply,
                    onVote: onVote,
                    onReply: onReply,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  void _showReplyDialog(BuildContext context) {
    final textController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reply to Comment'),
        content: TextField(
          controller: textController,
          decoration: const InputDecoration(
            hintText: 'Write your reply...',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              if (textController.text.trim().isNotEmpty) {
                onReply(textController.text.trim());
                Navigator.pop(context);
              }
            },
            child: const Text('Reply'),
          ),
        ],
      ),
    );
  }
}
```

---

## 🚀 Deployment

### Environment Variables
```bash
# Database
POSTGRES_URL="postgresql://username:password@host:port/database"

# Optional: AniList Client (if using custom auth)
ANILIST_CLIENT_ID="your_anilist_client_id"
ANILIST_CLIENT_SECRET="your_anilist_client_secret"
```

### Vercel Deployment
1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Set Environment Variables**: Add POSTGRES_URL in Vercel dashboard
3. **Deploy**: Push to main branch or use Vercel CLI
4. **Database Setup**: Run `prisma db push` on first deployment

### Manual Deployment
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Build for production
npm run build

# Start production server
npm start
```

---

## 💡 Examples

### Basic Usage
```typescript
// Fetch comments for anime ID 12345
const response = await fetch('https://your-backend.vercel.app/api/comments?media_id=12345&media_type=ANIME', {
  headers: {
    'Authorization': 'Bearer your_anilist_token'
  }
});

const data = await response.json();
console.log(data.data.comments);
```

### Create Nested Reply
```typescript
// Reply to existing comment
const replyResponse = await fetch('https://your-backend.vercel.app/api/comments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_anilist_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    media_id: 12345,
    media_type: 'ANIME',
    content: 'I agree with this point!',
    parent_comment_id: 'cm_abc123...'
  })
});
```

### Admin Action - Ban User
```typescript
// Ban a user (admin only)
const banResponse = await fetch('https://your-backend.vercel.app/api/admin/actions?action=ban', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer admin_anilist_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: 67890,
    reason: 'Repeated spam and harassment',
    duration_hours: 72,
    is_permanent: false
  })
});
```

### Get Comment Votes (Moderator)
```typescript
// See who voted on a comment
const votesResponse = await fetch('https://your-backend.vercel.app/api/comments/cm_abc123.../votes', {
  headers: {
    'Authorization': 'Bearer moderator_anilist_token'
  }
});

const votesData = await votesResponse.json();
console.log('Upvotes:', votesData.data.upvotes);
console.log('Downvotes:', votesData.data.downvotes);
```

---

## 🎯 Best Practices

### Performance
- Use pagination for large comment threads
- Implement caching for frequently accessed comments
- Optimize database queries with proper indexing

### Security
- Always validate AniList tokens on your server
- Implement proper rate limiting on client side
- Sanitize user input before displaying

### User Experience
- Show loading states during API calls
- Implement optimistic updates for better perceived performance
- Handle errors gracefully with user-friendly messages

### Moderation
- Set up clear community guidelines
- Train moderators on the admin interface
- Regularly review pending reports

---

## 📞 Support & Contributing

### Getting Help
- Check the [GitHub Issues](https://github.com/your-repo/issues) for common problems
- Review the API documentation above
- Join our Discord community for real-time support

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes with proper tests
4. Submit a pull request with detailed description

---

## 📄 License

This Enhanced Comments Backend is licensed under the MIT License. See LICENSE file for details.

---

**Built with ❤️ for the anime/manga community**