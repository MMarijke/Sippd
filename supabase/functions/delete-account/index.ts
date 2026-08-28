// Deletes the calling user's own account, permanently.
//
// The user id is ALWAYS derived from the caller's own verified JWT — never
// from a client-supplied value — so this function can only ever delete the
// account making the request. auth.admin.deleteUser() removes the
// auth.users row; every table in the schema cascades from there via
// `references profiles (id) on delete cascade` (see
// supabase/migrations/20260815120000_initial_schema.sql and
// 20260821000000_account_deletion_support.sql for the two aggregate-count
// decrement triggers that keep shared_cans in sync).
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically into every deployed Edge Function by the platform
// — no secrets to set manually for this one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  try {
    // Scoped to the caller's own JWT — used only to identify who's asking.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    // service_role — only ever used here, only ever to delete the exact uid
    // resolved above from the caller's own token.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('delete-account: auth.admin.deleteUser failed', deleteError);
      return jsonResponse({ error: 'Failed to delete account' }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('delete-account: unexpected error', err);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
