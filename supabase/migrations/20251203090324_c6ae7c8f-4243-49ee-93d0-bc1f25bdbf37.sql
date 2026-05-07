-- Create analytics_events table for tracking visits and checkout starts
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'page_view', 'checkout_start'
  product_slug TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for tracking from landing pages)
CREATE POLICY "Allow public insert analytics" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (true);

-- Allow public read (for dashboard)
CREATE POLICY "Allow public read analytics" 
ON public.analytics_events 
FOR SELECT 
USING (true);

-- Add index for faster queries
CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);