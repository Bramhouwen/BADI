import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(isDemo() ? "/?demo=signout" : "/login", request.url), { status: 303 });
}
