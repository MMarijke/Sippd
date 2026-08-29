-- Cleanup: drop the temporary debug_auth_context() helper used to diagnose
-- whether auth.uid() resolves correctly inside a sippd_rpc SECURITY DEFINER
-- function. vote_on_can confirmed working end-to-end; no longer needed.

drop function if exists public.debug_auth_context();
