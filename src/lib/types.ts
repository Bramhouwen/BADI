import type { ActivityKey, ReactionKey } from "./constants";

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Challenge {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  timezone: string;
  created_by: string;
  created_at: string;
}

export interface Membership {
  id: string;
  challenge_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface Invitation {
  id: string;
  challenge_id: string;
  invited_email: string | null;
  created_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface DailyCheckin {
  id: string;
  challenge_id: string;
  user_id: string;
  checkin_date: string;
  activities: ActivityKey[];
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  challenge_id: string;
  user_id: string;
  title: string;
  description: string | null;
  ingredients: string | null;
  instructions: string | null;
  category: string | null;
  protein_grams: number | null;
  image_path: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeFavorite {
  id: string;
  recipe_id: string;
  user_id: string;
  created_at: string;
}

export interface WallPost {
  id: string;
  challenge_id: string;
  user_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction: ReactionKey;
  created_at: string;
}

export interface Compliment {
  id: string;
  challenge_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface AlcoholException {
  id: string;
  challenge_id: string;
  user_id: string;
  exception_date: string;
  created_at: string;
}

export interface WaterEntry {
  id: string;
  challenge_id: string;
  user_id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
}

export type NotificationType = "compliment" | "reaction" | "post" | "recipe" | "mention";

export interface AppNotification {
  id: string;
  user_id: string;
  challenge_id: string;
  type: NotificationType;
  actor_id: string | null;
  ref_id: string | null;
  created_at: string;
  read_at: string | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
