
-- Add new fields to cases table
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sample_id TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS lubricant_grade TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS equipment_id TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sampling_point TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS ulr_number TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sample_receipt_date DATE;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sample_testing_date DATE;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS report_date DATE;

-- Add test_method column to case_test_results
ALTER TABLE public.case_test_results ADD COLUMN IF NOT EXISTS test_method TEXT;

-- Create test_methods table for reusable test methods
CREATE TABLE public.test_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  method_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.test_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test methods" ON public.test_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own test methods" ON public.test_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own test methods" ON public.test_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own test methods" ON public.test_methods FOR DELETE USING (auth.uid() = user_id);
