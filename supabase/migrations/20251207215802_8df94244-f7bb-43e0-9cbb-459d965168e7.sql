-- Add selected variant fields to orders table
ALTER TABLE public.orders 
ADD COLUMN selected_color TEXT,
ADD COLUMN selected_size TEXT,
ADD COLUMN selected_product_code TEXT;