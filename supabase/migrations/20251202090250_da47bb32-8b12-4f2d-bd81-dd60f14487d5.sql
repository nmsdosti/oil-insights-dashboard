-- Add particle_size column to case_test_results
ALTER TABLE public.case_test_results 
ADD COLUMN particle_size text;