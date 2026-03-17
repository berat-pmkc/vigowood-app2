-- Add accepts_marketing column to ikas_customers
ALTER TABLE public.ikas_customers
  ADD COLUMN IF NOT EXISTS accepts_marketing BOOLEAN DEFAULT false;

-- Set existing rows to false
UPDATE public.ikas_customers SET accepts_marketing = false WHERE accepts_marketing IS NULL;
