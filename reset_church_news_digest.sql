update public.church_news_sync_state
set
  last_success_at = null,
  updated_at = now()
where id = 1;
