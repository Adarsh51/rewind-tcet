-- Run this in Supabase Dashboard → SQL Editor → New Query

-- 1. Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('ISE', 'MSE', 'ESE')),
  semester TEXT NOT NULL CHECK (semester IN ('odd', 'even')),
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  contributor_name TEXT DEFAULT 'Anonymous',
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderation_result JSONB DEFAULT '{}',
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_hash ON submissions (file_hash);

-- 3. Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing policies
DROP POLICY IF EXISTS "Anyone can submit papers" ON submissions;
DROP POLICY IF EXISTS "Anyone can read approved submissions" ON submissions;
DROP POLICY IF EXISTS "Full access for API" ON submissions;

-- 5. Allow full access via API (admin functions are secured by ADMIN_PASSWORD in api/admin.js)
CREATE POLICY "Full access for API"
  ON submissions FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 6. Create storage bucket for papers
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Clean up existing storage policies
DROP POLICY IF EXISTS "Anyone can upload papers" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to papers" ON storage.objects;
DROP POLICY IF EXISTS "Full access to papers bucket" ON storage.objects;

-- 8. Storage bucket policy: allow read, upload, move and delete for papers
CREATE POLICY "Full access to papers bucket"
  ON storage.objects FOR ALL
  TO anon
  USING (bucket_id = 'papers')
  WITH CHECK (bucket_id = 'papers');
