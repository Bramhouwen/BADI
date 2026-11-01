import "server-only";

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

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Profile, membership and challenge of the signed-in user, or null when not yet in a group. */
export async function getContext(): Promise<AppContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile || !membership) return null;

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", membership.challenge_id)
    .maybeSingle();
  if (!challenge) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
    membership: membership as Membership,
    challenge: challenge as Challenge,
  };
}

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
