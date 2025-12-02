-- Create company settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL DEFAULT 'Oil Analysis Company',
  logo_url text,
  contact_number text,
  email text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_address text,
  customer_mobile text,
  customer_email text,
  machine_condition text NOT NULL CHECK (machine_condition IN ('NORMAL', 'ALERT', 'ALARM')),
  lubricant_condition text NOT NULL CHECK (lubricant_condition IN ('NORMAL', 'ALERT', 'ALARM')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create test templates table (for reusable test configurations)
CREATE TABLE IF NOT EXISTS public.test_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create test parameters table (for template parameters)
CREATE TABLE IF NOT EXISTS public.test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.test_templates(id) ON DELETE CASCADE NOT NULL,
  parameter_name text NOT NULL,
  lower_limit decimal,
  upper_limit decimal,
  unit text,
  created_at timestamptz DEFAULT now()
);

-- Create case tests table (actual tests done for cases)
CREATE TABLE IF NOT EXISTS public.case_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  test_name text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Create case test results table (actual parameter results)
CREATE TABLE IF NOT EXISTS public.case_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_test_id uuid REFERENCES public.case_tests(id) ON DELETE CASCADE NOT NULL,
  parameter_name text NOT NULL,
  lower_limit decimal,
  upper_limit decimal,
  actual_value decimal NOT NULL,
  unit text,
  status text CHECK (status IN ('NORMAL', 'ALERT', 'ALARM')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_settings
CREATE POLICY "Users can view their own company settings"
  ON public.company_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings"
  ON public.company_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for cases
CREATE POLICY "Users can view their own cases"
  ON public.cases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
  ON public.cases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cases"
  ON public.cases FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for test_templates
CREATE POLICY "Users can view their own test templates"
  ON public.test_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own test templates"
  ON public.test_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test templates"
  ON public.test_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test templates"
  ON public.test_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for test_parameters
CREATE POLICY "Users can view parameters of their templates"
  ON public.test_parameters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.test_templates
    WHERE test_templates.id = test_parameters.template_id
    AND test_templates.user_id = auth.uid()
  ));

CREATE POLICY "Users can create parameters for their templates"
  ON public.test_parameters FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.test_templates
    WHERE test_templates.id = test_parameters.template_id
    AND test_templates.user_id = auth.uid()
  ));

CREATE POLICY "Users can update parameters of their templates"
  ON public.test_parameters FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.test_templates
    WHERE test_templates.id = test_parameters.template_id
    AND test_templates.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete parameters of their templates"
  ON public.test_parameters FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.test_templates
    WHERE test_templates.id = test_parameters.template_id
    AND test_templates.user_id = auth.uid()
  ));

-- RLS Policies for case_tests
CREATE POLICY "Users can view tests of their cases"
  ON public.case_tests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_tests.case_id
    AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can create tests for their cases"
  ON public.case_tests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_tests.case_id
    AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can update tests of their cases"
  ON public.case_tests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_tests.case_id
    AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tests of their cases"
  ON public.case_tests FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_tests.case_id
    AND cases.user_id = auth.uid()
  ));

-- RLS Policies for case_test_results
CREATE POLICY "Users can view results of their case tests"
  ON public.case_test_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.case_tests
    JOIN public.cases ON cases.id = case_tests.case_id
    WHERE case_tests.id = case_test_results.case_test_id
    AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can create results for their case tests"
  ON public.case_test_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.case_tests
    JOIN public.cases ON cases.id = case_tests.case_id
    WHERE case_tests.id = case_test_results.case_test_id
    AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can update results of their case tests"
  ON public.case_test_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.case_tests
    JOIN public.cases ON cases.id = case_tests.case_id
    WHERE case_tests.id = case_test_results.case_test_id
    AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete results of their case tests"
  ON public.case_test_results FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.case_tests
    JOIN public.cases ON cases.id = case_tests.case_id
    WHERE case_tests.id = case_test_results.case_test_id
    AND cases.user_id = auth.uid()
  ));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();