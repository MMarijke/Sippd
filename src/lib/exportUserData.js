import { supabase } from '@/lib/supabaseClient';

// Every table here already has an owner-scoped SELECT RLS policy that
// returns every column unmasked (column-lock triggers only ever guard
// UPDATE, never SELECT) — this is a pure client-side read, no RPC or
// edge function needed. rarity_votes has no .limit() here on purpose:
// every other read of this table elsewhere in the app caps at 500 rows
// for list-rendering performance, which would silently truncate an export
// for a prolific voter — a real gap for exactly the kind of user this
// feature exists for.
async function fetchOwnRows(table, column, userId) {
  const { data, error } = await supabase.from(table).select('*').eq(column, userId);
  if (error) throw new Error(`Failed to export ${table}: ${error.message}`);
  return data ?? [];
}

// follows is the one table here where "my data" spans two columns —
// follows_select_participant already lets a participant read a row from
// either side, so this fetches both directions in one request rather than
// two.
async function fetchFollows(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('*')
    .or(`follower_id.eq.${userId},following_id.eq.${userId}`);
  if (error) throw new Error(`Failed to export follows: ${error.message}`);
  return data ?? [];
}

// activity_items' own SELECT policy is deliberately broader than
// owner-only (it also has to serve the Feed's followers/public view), so
// this adds the owner filter explicitly rather than relying on RLS alone
// to scope the export to just this user's own posts.
async function fetchOwnActivity(userId) {
  const { data, error } = await supabase.from('activity_items').select('*').eq('user_id', userId);
  if (error) throw new Error(`Failed to export activity_items: ${error.message}`);
  return data ?? [];
}

export async function exportUserData(userId) {
  const [
    profile, user_collection, rarity_votes, follows,
    trades, crates, notifications, activity_items, reactions,
  ] = await Promise.all([
    fetchOwnRows('profiles', 'id', userId),
    fetchOwnRows('user_collection', 'owner_id', userId),
    fetchOwnRows('rarity_votes', 'voter_id', userId),
    fetchFollows(userId),
    fetchOwnRows('trades', 'owner_id', userId),
    fetchOwnRows('crates', 'owner_id', userId),
    fetchOwnRows('notifications', 'recipient_id', userId),
    fetchOwnActivity(userId),
    fetchOwnRows('reactions', 'reactor_id', userId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    profile: profile[0] ?? null,
    user_collection,
    rarity_votes,
    follows,
    trades,
    crates,
    notifications,
    activity_items,
    reactions,
  };
}

// Same Blob -> URL.createObjectURL -> synthetic <a download> mechanic
// useCardCapture.js already uses for saving a generated PNG — first
// text/JSON use of that pattern, not a new download mechanic.
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
