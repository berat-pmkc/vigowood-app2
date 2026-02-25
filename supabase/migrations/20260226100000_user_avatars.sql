-- User Avatars: avatar_url column + storage bucket

-- 1. Add avatar_url column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 2. Create user-avatars storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies for user-avatars bucket
-- Allow authenticated users to read avatars
CREATE POLICY "avatar_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-avatars');

-- Allow authenticated users to upload avatars
CREATE POLICY "avatar_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-avatars');

-- Allow authenticated users to update avatars
CREATE POLICY "avatar_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-avatars');

-- Allow authenticated users to delete avatars
CREATE POLICY "avatar_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars');
