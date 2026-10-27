import { createClient } from "@supabase/supabase-js";
import { researchPacketSchema } from "@/domain/comparison";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Vary": "Authorization" };
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 10000) return Response.json({ error: "Reviewer sign-in required." }, { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "Review service unavailable." }, { status: 503, headers });
  try {
    const client = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7));
    if (identityError || !identity.user) return Response.json({ error: "Reviewer sign-in required." }, { status: 401, headers });
    const access = await client.rpc("is_composition_reviewer");
    if (access.error || access.data !== true) return Response.json({ error: "Reviewer access required." }, { status: 403, headers });
    const result = await client.from("race_guide_drafts").select("payload,sha256").eq("version", "tx-governor-2026-10-27-v1").maybeSingle();
    if (result.error || !result.data) return Response.json({ error: "The research draft is not available yet." }, { status: 503, headers });
    const payload = researchPacketSchema.parse(result.data.payload);
    return Response.json({ payload, sha256: result.data.sha256 }, { headers });
  } catch { return Response.json({ error: "Research preview could not be loaded." }, { status: 503, headers }); }
}
