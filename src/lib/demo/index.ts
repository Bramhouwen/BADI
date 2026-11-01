/** Demo mode: in-memory backend with sample data, for looking at the app without Supabase. */
export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_WINTER_ARC_DEMO === "1";
}

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_CHALLENGE_ID = "00000000-0000-4000-8000-0000000000c1";
