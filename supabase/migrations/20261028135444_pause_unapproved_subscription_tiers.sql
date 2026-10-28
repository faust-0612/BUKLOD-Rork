-- Legacy paid tiers have no final commercial approval. Keep FREE active.
update public.buklod_commercial_products
   set is_active = false
 where code in ('STANDARD', 'PRO', 'ENTERPRISE')
   and is_active = true;
