-- Allow public delete orders (for pending orders)
CREATE POLICY "Allow public delete orders" 
ON public.orders 
FOR DELETE 
USING (true);