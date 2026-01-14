-- Users table (synced with AniList)
CREATE TABLE IF NOT EXISTS users (
    anilist_user_id INTEGER PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    profile_picture_url TEXT,
    is_mod BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table with hierarchical support
CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(anilist_user_id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL, -- AniList media ID
    parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    tag VARCHAR(20) DEFAULT 'general', -- For episode/chapter specific comments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Vote tracking
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    total_votes INTEGER GENERATED ALWAYS AS (upvotes + downvotes) STORED,
    
    -- Denormalized user data for performance
    username VARCHAR(50) NOT NULL,
    profile_picture_url TEXT,
    is_mod BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    
    -- Reply tracking
    reply_count INTEGER DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_media_id ON comments(media_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_media_created ON comments(media_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_created ON comments(parent_comment_id, created_at ASC);

-- Votes table for tracking user votes
CREATE TABLE IF NOT EXISTS comment_votes (
    vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(comment_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(anilist_user_id) ON DELETE CASCADE,
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)), -- -1 = downvote, 1 = upvote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (comment_id, user_id)
);

-- Create indexes for votes
CREATE INDEX IF NOT EXISTS idx_votes_comment_id ON comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON comment_votes(user_id);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(anilist_user_id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL, -- 'comment', 'vote', 'delete'
    action_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    
    UNIQUE (user_id, action_type, window_start)
);

-- Create indexes for rate limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_end);

-- Function to update reply counts
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE comments 
        SET reply_count = reply_count + 1 
        WHERE comment_id = NEW.parent_comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE comments 
        SET reply_count = reply_count - 1 
        WHERE comment_id = OLD.parent_comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reply count updates
DROP TRIGGER IF EXISTS trigger_update_reply_count ON comments;
CREATE TRIGGER trigger_update_reply_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_reply_count();

-- Function to update vote counts
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE comments 
        SET 
            upvotes = CASE WHEN NEW.vote_type = 1 THEN upvotes + 1 ELSE upvotes END,
            downvotes = CASE WHEN NEW.vote_type = -1 THEN downvotes + 1 ELSE downvotes END
        WHERE comment_id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE comments 
        SET 
            upvotes = CASE 
                WHEN OLD.vote_type = 1 AND NEW.vote_type != 1 THEN upvotes - 1
                WHEN OLD.vote_type != 1 AND NEW.vote_type = 1 THEN upvotes + 1
                ELSE upvotes
            END,
            downvotes = CASE 
                WHEN OLD.vote_type = -1 AND NEW.vote_type != -1 THEN downvotes - 1
                WHEN OLD.vote_type != -1 AND NEW.vote_type = -1 THEN downvotes + 1
                ELSE downvotes
            END
        WHERE comment_id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE comments 
        SET 
            upvotes = CASE WHEN OLD.vote_type = 1 THEN upvotes - 1 ELSE upvotes END,
            downvotes = CASE WHEN OLD.vote_type = -1 THEN downvotes - 1 ELSE downvotes END
        WHERE comment_id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for vote count updates
DROP TRIGGER IF EXISTS trigger_update_vote_counts ON comment_votes;
CREATE TRIGGER trigger_update_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON comment_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_counts();

-- Insert default admin (update with your actual AniList ID)
INSERT INTO users (anilist_user_id, username, is_admin, is_mod)
VALUES (1, 'admin', TRUE, TRUE)
ON CONFLICT (anilist_user_id) DO NOTHING;