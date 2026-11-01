// Stand-in for both @upstash/redis and @upstash/ratelimit. Set
// `rateLimit.blocked = true` to make the next limit() calls fail.
export const rateLimit = (globalThis.__fakeRateLimit ??= { blocked: false, calls: [] }); // shared, see fake-supabase.js

export class Redis {}

export class Ratelimit {
  static slidingWindow() { return {}; }
  async limit(id) {
    rateLimit.calls.push(id);
    return { success: !rateLimit.blocked };
  }
}
