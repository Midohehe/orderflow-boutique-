-- Add utm_source column to analytics_events
ALTER TABLE public.analytics_events 
ADD COLUMN IF NOT EXISTS utm_source text;