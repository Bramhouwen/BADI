import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Challenge, Membership, Profile } from "@/lib/types";

export interface AppContext {
  userId: string;
  email: string | null;
  profile: Profile;
  membership: Membership;
  challenge: Challenge;
}

export interface SquadMember {
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profile: Profile;
}

/**
 * Verified user of this request, shared by every caller. The JWT is verified
 * locally against the project's public signing key, so no Auth round trip.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Profile, membership and challenge of the signed-in user, or null when not
 * yet in a group. Memoised per request: header, nav badge and page share it.
 * Two parallel queries after the auth check, the challenge rides along with
 * the membership.
 */
export const getContext = cache(async function getContext(): Promise<AppContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: profile }, { data: membershipRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("*, challenge:challenges(*)").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile || !membershipRow) return null;
  const { challenge: challengeRaw, ...membership } = membershipRow as Membership & { challenge: Challenge | Challenge[] | null };
  const challenge = Array.isArray(challengeRaw) ? challengeRaw[0] : challengeRaw;
  if (!challenge) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
    membership: membership as Membership,
    challenge,
  };
});

/** Redirects to login or onboarding when there is no complete context. */
export async function requireContext(): Promise<AppContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** Members in a stable order (join order), never ranked by performance. */
export async function getSquad(challengeId: string): Promise<SquadMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, role, joined_at, profile:profiles(*)")
    .eq("challenge_id", challengeId)
    .order("joined_at", { ascending: true });
  return ((data ?? []) as unknown as (Omit<SquadMember, "profile"> & { profile: Profile | Profile[] })[])
    .map((m) => ({ ...m, profile: Array.isArray(m.profile) ? m.profile[0] : m.profile }))
    .filter((m) => Boolean(m.profile));
}

export { rotateMembers } from "./data-pure";
