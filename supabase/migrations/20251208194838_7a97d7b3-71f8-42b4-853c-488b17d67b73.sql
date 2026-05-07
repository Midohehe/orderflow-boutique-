-- Add quantity column to orders table
ALTER TABLE public.orders 
ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;