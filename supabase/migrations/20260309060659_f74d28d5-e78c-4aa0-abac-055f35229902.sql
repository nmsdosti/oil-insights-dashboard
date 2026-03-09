CREATE OR REPLACE TRIGGER generate_case_access_token_trigger
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_case_access_token();