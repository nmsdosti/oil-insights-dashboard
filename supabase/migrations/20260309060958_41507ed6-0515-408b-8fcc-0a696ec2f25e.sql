CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_case_access_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.access_token IS NULL THEN
    NEW.access_token := encode(extensions.gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;