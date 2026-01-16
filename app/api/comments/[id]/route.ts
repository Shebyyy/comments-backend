    const { id: commentId } = await params;
    // Upsert user to get current permissions
    // Check rate limit
    // Get comment with user data
        id: commentId,
    // Transform to match Comment interface
    // Check permissions using new role system
    // Soft delete the comment (preserve thread structure)
        id: commentId
    // Create audit log
        target_id: commentId,
    // Note: For Reddit-like behavior, we DON'T delete replies when a comment is deleted
    // Replies remain visible and maintain thread structure even if parent is deleted
    // This preserves conversation context and thread integrity
  // Get all direct replies
  // Delete each reply and its children
    // Create audit log for reply deletion
    // Recursively delete nested replies
