"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { isDemo } from "@/lib/demo";
import { createDemoClient } from "@/lib/demo/mock-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient(): SupabaseClient {
  if (isDemo()) return createDemoClient() as unknown as SupabaseClient;
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
