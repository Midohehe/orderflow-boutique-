CREATE POLICY "Owner insert order_items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role)
);