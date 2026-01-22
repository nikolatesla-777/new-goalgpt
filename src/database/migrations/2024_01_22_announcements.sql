-- ============================================================================
-- Announcements (Admin Popup System)
-- Migration: 2024_01_22_announcements.sql
-- ============================================================================

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    
    -- Button/CTA
    button_text VARCHAR(100),
    button_url TEXT,
    button_action VARCHAR(20) DEFAULT 'url', -- 'url', 'screen', 'dismiss'
    
    -- Targeting
    target_audience VARCHAR(20) DEFAULT 'all', -- 'all', 'vip', 'free', 'new_users'
    announcement_type VARCHAR(20) DEFAULT 'popup', -- 'popup', 'banner', 'fullscreen'
    
    -- Scheduling
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'scheduled', 'expired'
    priority INTEGER DEFAULT 0,
    show_once BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create announcement_dismissals table (tracks which users dismissed which announcements)
CREATE TABLE IF NOT EXISTS announcement_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate dismissals
    CONSTRAINT unique_user_announcement_dismissal UNIQUE (user_id, announcement_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON announcements(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_dismissals_user ON announcement_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissals_announcement ON announcement_dismissals(announcement_id);

-- Comments
COMMENT ON TABLE announcements IS 'Admin-created popup announcements for mobile app';
COMMENT ON TABLE announcement_dismissals IS 'Tracks which users have dismissed which announcements';
COMMENT ON COLUMN announcements.button_action IS 'Action type: url (external link), screen (navigate to app screen), dismiss (just close)';
COMMENT ON COLUMN announcements.target_audience IS 'Who sees this: all, vip (premium users), free (non-premium), new_users (registered < 7 days)';
COMMENT ON COLUMN announcements.show_once IS 'If true, user only sees this once (tracks via dismissals table)';
