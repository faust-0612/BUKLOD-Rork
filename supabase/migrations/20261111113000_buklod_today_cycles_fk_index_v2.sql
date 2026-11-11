-- Follow-up performance lint: cover the tip catalogue foreign key on active/previous cycles.
create index if not exists buklod_today_tip_cycles_catalog_v2
 on public.buklod_today_tip_cycles_v2(tip_index);
