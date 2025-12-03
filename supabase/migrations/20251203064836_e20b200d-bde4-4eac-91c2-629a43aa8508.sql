-- Create storage bucket for test images
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-images', 'test-images', true);

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload test images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their images
CREATE POLICY "Users can update their test images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'test-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their images
CREATE POLICY "Users can delete their test images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'test-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to test images
CREATE POLICY "Public can view test images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'test-images');