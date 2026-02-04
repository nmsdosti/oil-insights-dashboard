-- Add access_token column to cases table for customer sharing
ALTER TABLE public.cases
ADD COLUMN access_token TEXT UNIQUE;

-- Create a function to generate access token on insert
CREATE OR REPLACE FUNCTION public.generate_case_access_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.access_token IS NULL THEN
    NEW.access_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate access token
CREATE TRIGGER generate_case_access_token_trigger
BEFORE INSERT ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.generate_case_access_token();

-- Generate access tokens for existing cases that don't have one
UPDATE public.cases
SET access_token = encode(gen_random_bytes(16), 'hex')
WHERE access_token IS NULL;

-- Create RLS policy for public access via token
CREATE POLICY "Public can view cases by access token"
ON public.cases
FOR SELECT
USING (true);

-- Create RLS policy for case_tests public access via case token
CREATE POLICY "Public can view tests of accessible cases"
ON public.case_tests
FOR SELECT
USING (true);

-- Create RLS policy for case_test_results public access
CREATE POLICY "Public can view results of accessible case tests"
ON public.case_test_results
FOR SELECT
USING (true);