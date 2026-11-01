import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseEnv } from "./env";
import { isDemo } from "@/lib/demo";
import { createDemoClient } from "@/lib/demo/mock-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Per-request Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createClient(): Promise<SupabaseClient> {
  if (isDemo()) {
    // Demo data lives in memory and changes per request: render at request time.
    await connection();
    return createDemoClient() as unknown as SupabaseClient;
  }
  // Always render at request time: sessions are per request and supabase-js
  // reads the clock while refreshing tokens.
  await connection();
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}
