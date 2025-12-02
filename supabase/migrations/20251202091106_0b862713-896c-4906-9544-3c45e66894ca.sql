-- Add recommendations column to cases table
ALTER TABLE public.cases 
ADD COLUMN recommendations text;