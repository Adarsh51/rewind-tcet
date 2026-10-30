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

-- 2. Enable Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 3. Allow anyone to INSERT (upload)
CREATE POLICY "Anyone can submit papers"
  ON submissions FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4. Allow anyone to read approved submissions count (for the UI)
CREATE POLICY "Anyone can read approved submissions"
  ON submissions FOR SELECT
  TO anon
  USING (status = 'approved');

-- 5. Create index for fast lookups
CREATE INDEX idx_submissions_status ON submissions (status);
CREATE INDEX idx_submissions_hash ON submissions (file_hash);

-- 6. Create storage bucket for papers
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Allow anonymous uploads to the papers bucket (max 5MB)
CREATE POLICY "Anyone can upload papers"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'papers' AND
    (OCTET_LENGTH(name) < 500) AND
    (LOWER(STORAGE.EXTENSION(name)) = 'pdf')
  );

-- 8. Allow public read access to papers
CREATE POLICY "Public read access to papers"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'papers');
