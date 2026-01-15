# Examples & Code Samples

This directory contains complete, ready-to-use examples for integrating the Enhanced Comments Backend into various platforms and frameworks.

---

## 📁 Available Examples

### 🌐 Web Examples

#### React + TypeScript
- **Location**: `examples/react-typescript/`
- **Features**: Full comments system with state management
- **Dependencies**: React 18, TypeScript, Tailwind CSS
- **Setup**: `npm install && npm run dev`

#### Vue 3 + Composition API
- **Location**: `examples/vue3-composition/`
- **Features**: Reactive comments with Vue 3
- **Dependencies**: Vue 3, TypeScript, Pinia
- **Setup**: `npm install && npm run dev`

#### Next.js 14 App Router
- **Location**: `examples/nextjs14-app-router/`
- **Features**: SSR-compatible comments
- **Dependencies**: Next.js 14, TypeScript, Prisma
- **Setup**: `npm install && npm run dev`

### 📱 Mobile Examples

#### Flutter + GetX
- **Location**: `examples/flutter-getx/`
- **Features**: Complete mobile comments UI
- **Dependencies**: Flutter, GetX, HTTP
- **Setup**: `flutter pub get && flutter run`

#### React Native + TypeScript
- **Location**: `examples/react-native-typescript/`
- **Features**: Native mobile comments
- **Dependencies**: React Native, TypeScript, Redux Toolkit
- **Setup**: `npm install && npx react-native run-ios/android`

#### Dart + Angular (Web)
- **Location**: `examples/dart-angular/`
- **Features**: Angular-based comments system
- **Dependencies**: Angular 15, Dart, RxJS
- **Setup**: `npm install && ng serve`

### 🔧 Backend Examples

#### Node.js + Express
- **Location**: `examples/nodejs-express/`
- **Features**: Custom backend integration
- **Dependencies**: Express, TypeScript, node-fetch
- **Setup**: `npm install && npm start`

#### Python + FastAPI
- **Location**: `examples/python-fastapi/`
- **Features**: Python backend proxy
- **Dependencies**: FastAPI, Pydantic, httpx
- **Setup**: `pip install -r requirements.txt && uvicorn main:app --reload`

#### Go + Gin
- **Location**: `examples/go-gin/`
- **Features**: Go backend service
- **Dependencies**: Gin, Go modules
- **Setup**: `go mod tidy && go run main.go`

---

## 🚀 Quick Start Examples

### React Basic Implementation
```tsx
// components/CommentsSection.tsx
import { useState, useEffect } from 'react';
import { CommentsAPI } from '../lib/comments-api';

interface Comment {
  id: string;
  content: string;
  username: string;
  upvotes: number;
  downvotes: number;
  user_vote: number;
  created_at: string;
  replies?: Comment[];
}

export function CommentsSection({ mediaId, anilistToken }: {
  mediaId: number;
  anilistToken: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const api = new CommentsAPI(anilistToken);
  
  useEffect(() => {
    loadComments();
  }, [mediaId]);
  
  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await api.getComments(mediaId);
      setComments(response.data.comments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    try {
      const response = await api.createComment({
        mediaId,
        content: newComment.trim(),
      });
      setComments([response.data, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };
  
  const handleVote = async (commentId: string, voteType: 1 | -1) => {
    try {
      const response = await api.voteComment(commentId, voteType);
      
      setComments(comments.map(comment => 
        comment.id === commentId
          ? {
              ...comment,
              upvotes: response.data.upvotes,
              downvotes: response.data.downvotes,
              user_vote: response.data.vote_type,
            }
          : comment
      ));
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };
  
  return (
    <div className="comments-section">
      <h2>Comments ({comments.length})</h2>
      
      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="comment-input">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
        />
        <button type="submit" disabled={!newComment.trim() || loading}>
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </form>
      
      {/* Comments List */}
      <div className="comments-list">
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <div className="comment-header">
              <strong>{comment.username}</strong>
              <span className="timestamp">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <div className="comment-content">{comment.content}</div>
            
            <div className="comment-actions">
              <button 
                className={`vote-button ${comment.user_vote === 1 ? 'active' : ''}`}
                onClick={() => handleVote(comment.id, 1)}
              >
                ▲ {comment.upvotes}
              </button>
              <button 
                className={`vote-button ${comment.user_vote === -1 ? 'active' : ''}`}
                onClick={() => handleVote(comment.id, -1)}
              >
                ▼ {comment.downvotes}
              </button>
            </div>
            
            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="replies">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="comment reply">
                    <div className="comment-header">
                      <strong>{reply.username}</strong>
                      <span className="timestamp">
                        {new Date(reply.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="comment-content">{reply.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Flutter Basic Implementation
```dart
// services/comments_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class Comment {
  final String id;
  final String content;
  final String username;
  final int upvotes;
  final int downvotes;
  final int userVote;
  final DateTime createdAt;
  final List<Comment> replies;
  
  Comment({
    required this.id,
    required this.content,
    required this.username,
    required this.upvotes,
    required this.downvotes,
    required this.userVote,
    required this.createdAt,
    this.replies = const [],
  });
  
  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: json['id'],
      content: json['content'],
      username: json['username'],
      upvotes: json['upvotes'],
      downvotes: json['downvotes'],
      userVote: json['user_vote'] ?? 0,
      createdAt: DateTime.parse(json['created_at']),
      replies: (json['replies'] as List? ?? [])
          .map((reply) => Comment.fromJson(reply))
          .toList(),
    );
  }
}

class CommentsService {
  static const String _baseUrl = 'https://your-backend.vercel.app/api';
  final String _anilistToken;
  
  CommentsService(this._anilistToken);
  
  Future<List<Comment>> getComments(int mediaId) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/comments?media_id=$mediaId'),
      headers: {
        'Authorization': 'Bearer $_anilistToken',
      },
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return (data['data']['comments'] as List)
          .map((comment) => Comment.fromJson(comment))
          .toList();
    } else {
      throw Exception('Failed to load comments');
    }
  }
  
  Future<Comment> createComment({
    required int mediaId,
    required String content,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/comments'),
      headers: {
        'Authorization': 'Bearer $_anilistToken',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'media_id': mediaId,
        'content': content,
      }),
    );
    
    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      return Comment.fromJson(data['data']);
    } else {
      throw Exception('Failed to create comment');
    }
  }
  
  Future<void> voteComment(String commentId, int voteType) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/comments/vote'),
      headers: {
        'Authorization': 'Bearer $_anilistToken',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'comment_id': commentId,
        'vote_type': voteType,
      }),
    );
    
    if (response.statusCode != 200) {
      throw Exception('Failed to vote on comment');
    }
  }
}

// widgets/comments_widget.dart
import 'package:flutter/material.dart';
import '../services/comments_service.dart';

class CommentsWidget extends StatefulWidget {
  final int mediaId;
  final String anilistToken;
  
  const CommentsWidget({
    Key? key,
    required this.mediaId,
    required this.anilistToken,
  }) : super(key: key);
  
  @override
  _CommentsWidgetState createState() => _CommentsWidgetState();
}

class _CommentsWidgetState extends State<CommentsWidget> {
  late CommentsService _service;
  List<Comment> _comments = [];
  bool _loading = false;
  bool _submitting = false;
  final _textController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _service = CommentsService(widget.anilistToken);
    _loadComments();
  }
  
  Future<void> _loadComments() async {
    setState(() => _loading = true);
    try {
      final comments = await _service.getComments(widget.mediaId);
      setState(() => _comments = comments);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading comments: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }
  
  Future<void> _submitComment() async {
    if (_textController.text.trim().isEmpty) return;
    
    setState(() => _submitting = true);
    try {
      final newComment = await _service.createComment(
        mediaId: widget.mediaId,
        content: _textController.text.trim(),
      );
      
      setState(() {
        _comments.insert(0, newComment);
        _textController.clear();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error posting comment: $e')),
      );
    } finally {
      setState(() => _submitting = false);
    }
  }
  
  Future<void> _voteComment(String commentId, int voteType) async {
    try {
      await _service.voteComment(commentId, voteType);
      _loadComments(); // Refresh to show updated vote counts
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error voting: $e')),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Text(
                'Comments',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(width: 8),
              Text('(${_comments.length})'),
            ],
          ),
        ),
        
        // Comment Input
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _textController,
                  decoration: const InputDecoration(
                    hintText: 'Write a comment...',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                  minLines: 1,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _submitting ? null : _submitComment,
                icon: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
              ),
            ],
          ),
        ),
        
        // Comments List
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  itemCount: _comments.length,
                  itemBuilder: (context, index) {
                    final comment = _comments[index];
                    return _CommentCard(
                      comment: comment,
                      onVote: _voteComment,
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _CommentCard extends StatelessWidget {
  final Comment comment;
  final Function(String, int) onVote;
  
  const _CommentCard({
    Key? key,
    required this.comment,
    required this.onVote,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                CircleAvatar(
                  child: Text(comment.username[0].toUpperCase()),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        comment.username,
                        style: const TextStyle(fontWeight: FontWeight.bold),
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
            
            // Content
            Text(comment.content),
            
            const SizedBox(height: 12),
            
            // Actions
            Row(
              children: [
                IconButton(
                  onPressed: () => onVote(comment.id, 1),
                  icon: Icon(
                    Icons.thumb_up,
                    color: comment.userVote == 1 ? Colors.blue : null,
                  ),
                ),
                Text('${comment.upvotes}'),
                IconButton(
                  onPressed: () => onVote(comment.id, -1),
                  icon: Icon(
                    Icons.thumb_down,
                    color: comment.userVote == -1 ? Colors.red : null,
                  ),
                ),
                Text('${comment.downvotes}'),
              ],
            ),
            
            // Replies
            if (comment.replies.isNotEmpty) ...[
              const SizedBox(height: 16),
              ...comment.replies.map(
                (reply) => Padding(
                  padding: const EdgeInsets.only(left: 32),
                  child: _CommentCard(
                    comment: reply,
                    onVote: onVote,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

---

## 🛠️ Advanced Examples

### Real-time Comments with WebSocket
```typescript
// services/realtime-comments.ts
export class RealtimeComments extends CommentsAPI {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  
  connect(mediaId: number) {
    const wsUrl = `wss://your-backend.vercel.app/ws/comments/${mediaId}`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.broadcast(data.type, data);
    };
    
    this.ws.onopen = () => {
      console.log('Connected to comments WebSocket');
    };
    
    this.ws.onclose = () => {
      console.log('Disconnected from comments WebSocket');
      // Attempt reconnection after 3 seconds
      setTimeout(() => this.connect(mediaId), 3000);
    };
  }
  
  subscribe(event: string, callback: (data: any) => void) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(event)?.delete(callback);
    };
  }
  
  private broadcast(event: string, data: any) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
  }
}

// React Hook for Real-time Comments
export function useRealtimeComments(mediaId: number, anilistToken: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [realtime] = useState(() => new RealtimeComments(anilistToken));
  
  useEffect(() => {
    // Connect to WebSocket
    realtime.connect(mediaId);
    
    // Subscribe to events
    const unsubscribeNewComment = realtime.subscribe('new_comment', (data) => {
      setComments(prev => [data.comment, ...prev]);
    });
    
    const unsubscribeVoteUpdate = realtime.subscribe('vote_update', (data) => {
      setComments(prev => prev.map(comment => 
        comment.id === data.comment_id
          ? { ...comment, ...data.updates }
          : comment
      ));
    });
    
    const unsubscribeCommentDeleted = realtime.subscribe('comment_deleted', (data) => {
      setComments(prev => prev.filter(comment => comment.id !== data.comment_id));
    });
    
    // Load initial comments
    realtime.getComments(mediaId).then(response => {
      setComments(response.data.comments);
    });
    
    // Cleanup
    return () => {
      unsubscribeNewComment();
      unsubscribeVoteUpdate();
      unsubscribeCommentDeleted();
      realtime.disconnect();
    };
  }, [mediaId, realtime]);
  
  return {
    comments,
    createComment: realtime.createComment.bind(realtime),
    voteComment: realtime.voteComment.bind(realtime),
    deleteComment: realtime.deleteComment.bind(realtime),
  };
}
```

### Admin Panel Example
```typescript
// components/AdminPanel.tsx
export function AdminPanel({ anilistToken }: { anilistToken: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'stats'>('reports');
  
  const api = new CommentsAPI(anilistToken);
  
  useEffect(() => {
    loadReports();
    loadUsers();
  }, []);
  
  const loadReports = async () => {
    try {
      const response = await api.getReports('PENDING');
      setReports(response.data.reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };
  
  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };
  
  const handleBanUser = async (userId: number, reason: string) => {
    try {
      await api.banUser(userId, reason, { isPermanent: false, durationHours: 24 });
      loadUsers(); // Refresh user list
      loadReports(); // Refresh reports
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };
  
  const handleWarnUser = async (userId: number, reason: string) => {
    try {
      await api.warnUser(userId, reason);
      loadUsers(); // Refresh user list
    } catch (error) {
      console.error('Failed to warn user:', error);
    }
  };
  
  return (
    <div className="admin-panel">
      <h1>Admin Panel</h1>
      
      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          Reports ({reports.length})
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
        <button 
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'reports' && (
        <ReportsList 
          reports={reports} 
          onBanUser={handleBanUser}
          onWarnUser={handleWarnUser}
        />
      )}
      
      {activeTab === 'users' && (
        <UsersList 
          users={users}
          onBanUser={handleBanUser}
          onWarnUser={handleWarnUser}
        />
      )}
      
      {activeTab === 'stats' && (
        <StatisticsPanel />
      )}
    </div>
  );
}

function ReportsList({ reports, onBanUser, onWarnUser }: {
  reports: Report[];
  onBanUser: (userId: number, reason: string) => void;
  onWarnUser: (userId: number, reason: string) => void;
}) {
  return (
    <div className="reports-list">
      <h2>Pending Reports</h2>
      {reports.length === 0 ? (
        <p>No pending reports!</p>
      ) : (
        reports.map((report) => (
          <div key={report.id} className="report-card">
            <h3>Report for Comment: {report.comment_id}</h3>
            <p><strong>Reason:</strong> {report.reason}</p>
            {report.description && (
              <p><strong>Description:</strong> {report.description}</p>
            )}
            <p><strong>Reported by:</strong> User {report.reporter_user_id}</p>
            
            <div className="report-actions">
              <button onClick={() => onWarnUser(report.reporter_user_id, 'False reporting')}>
                Warn Reporter
              </button>
              <button onClick={() => onBanUser(report.reporter_user_id, 'Repeated false reporting')}>
                Ban Reporter
              </button>
              <button onClick={() => {/* Mark as resolved */}}>
                Mark Resolved
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

---

## 📱 Mobile-First Examples

### React Native Comments
```typescript
// components/CommentsList.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CommentsAPI } from '../services/comments-api';

interface Comment {
  id: string;
  content: string;
  username: string;
  upvotes: number;
  downvotes: number;
  user_vote: number;
  created_at: string;
  replies?: Comment[];
}

export const CommentsList: React.FC<{
  mediaId: number;
  anilistToken: string;
}> = ({ mediaId, anilistToken }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const api = new CommentsAPI(anilistToken);
  
  useEffect(() => {
    loadComments();
  }, [mediaId]);
  
  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await api.getComments(mediaId);
      setComments(response.data.comments);
    } catch (error) {
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      const response = await api.createComment({
        mediaId,
        content: newComment.trim(),
      });
      setComments([response.data, ...comments]);
      setNewComment('');
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleVote = async (commentId: string, voteType: 1 | -1) => {
    try {
      const response = await api.voteComment(commentId, voteType);
      
      setComments(comments.map(comment => 
        comment.id === commentId
          ? {
              ...comment,
              upvotes: response.data.upvotes,
              downvotes: response.data.downvotes,
              user_vote: response.data.vote_type,
            }
          : comment
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to vote');
    }
  };
  
  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentCard}>
      {/* Header */}
      <View style={styles.commentHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.username[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      {/* Content */}
      <Text style={styles.commentContent}>{item.content}</Text>
      
      {/* Actions */}
      <View style={styles.commentActions}>
        <TouchableOpacity
          style={[
            styles.voteButton,
            item.user_vote === 1 && styles.voteButtonActive,
          ]}
          onPress={() => handleVote(item.id, 1)}
        >
          <Text style={styles.voteButtonText}>▲</Text>
          <Text style={styles.voteCount}>{item.upvotes}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.voteButton,
            item.user_vote === -1 && styles.voteButtonActive,
          ]}
          onPress={() => handleVote(item.id, -1)}
        >
          <Text style={styles.voteButtonText}>▼</Text>
          <Text style={styles.voteCount}>{item.downvotes}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Replies */}
      {item.replies && item.replies.length > 0 && (
        <View style={styles.replies}>
          {item.replies.map((reply) => (
            <View key={reply.id} style={[styles.commentCard, styles.reply]}>
              <View style={styles.commentHeader}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarTextSmall}>
                    {reply.username[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.username}>{reply.username}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(reply.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text style={styles.commentContent}>{reply.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
  
  if (loading && comments.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Loading comments...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Comment Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Write a comment..."
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!newComment.trim() || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitComment}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Comments List */}
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadComments} />
        }
        contentContainerStyle={styles.commentsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No comments yet. Be the first to comment!</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  commentsList: {
    padding: 16,
  },
  commentCard: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reply: {
    marginLeft: 32,
    marginTop: 8,
    backgroundColor: '#f9f9f9',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  avatarTextSmall: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commentContent: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 16,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  voteButtonActive: {
    backgroundColor: '#e3f2fd',
  },
  voteButtonText: {
    fontSize: 16,
    marginRight: 4,
  },
  voteCount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  replies: {
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
});
```

---

## 🎯 Complete Examples Repository

For the complete, working examples, visit:

**📁 GitHub Repository**: `https://github.com/your-username/comments-examples`

Each example includes:
- ✅ **Complete Source Code**
- ✅ **Setup Instructions**
- ✅ **Environment Configuration**
- ✅ **Testing Examples**
- ✅ **Deployment Guides**

---

## 🚀 Quick Start Any Example

```bash
# Clone the examples repository
git clone https://github.com/your-username/comments-examples.git
cd comments-examples

# Choose your platform
cd react-typescript  # or vue3-composition, flutter-getx, etc.

# Install dependencies
npm install  # or flutter pub get, pip install -r requirements.txt

# Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# Run the example
npm run dev  # or flutter run, python main.py, etc.
```

---

## 📞 Need Help with Examples?

- **Documentation**: Check the main `COMPLETE_DOCUMENTATION.md`
- **Issues**: Open an issue on the examples repository
- **Discord**: Join our community for live help
- **Email**: examples@your-comments-backend.com

**Happy Coding! 🎉**