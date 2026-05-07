-- Create a table for pixel settings
CREATE TABLE public.pixel_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facebook_pixel_id TEXT,
  facebook_enabled BOOLEAN DEFAULT false,
  tiktok_pixel_id TEXT,
  tiktok_enabled BOOLEAN DEFAULT false,
  google_analytics_id TEXT,
  google_enabled BOOLEAN DEFAULT false,
  snapchat_pixel_id TEXT,
  snapchat_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pixel_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access for the landing page to load pixels
CREATE POLICY "Allow public read access" 
ON public.pixel_settings 
FOR SELECT 
USING (true);

-- Allow public insert/update for now (since there's no auth yet)
CREATE POLICY "Allow public write access" 
ON public.pixel_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pixel_settings_updated_at
BEFORE UPDATE ON public.pixel_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();