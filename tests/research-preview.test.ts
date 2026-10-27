import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from }) }));
import { GET } from "../src/app/api/research-preview/route";
const payload = { version: "synthetic", review: { status: "pending", reviewer: null, reviewedAt: null }, positions: [], sources: [] };
const request = (authorization?: string) => new Request("https://example.test/api/research-preview", { headers: authorization ? { authorization } : {} });
describe("private research preview endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://review-test.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "synthetic" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.from.mockReturnValue({ select: mocks.select }); mocks.select.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { payload, sha256: "a".repeat(64) }, error: null });
  });
  it("rejects absent or malformed authorization before reading data", async () => {
    for (const token of [undefined, "Basic synthetic", "Bearer " + "a".repeat(10001)]) expect((await GET(request(token))).status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("validates the token with Auth and checks current reviewer membership", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    expect((await GET(request("Bearer invalid"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "synthetic" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await GET(request("Bearer synthetic"))).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("serves only the fixed draft to a current reviewer without caching", async () => {
    const response = await GET(request("Bearer synthetic"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toBe("Authorization");
    expect(mocks.getUser).toHaveBeenCalledWith("synthetic"); expect(mocks.rpc).toHaveBeenCalledWith("is_composition_reviewer");
    expect(mocks.eq).toHaveBeenCalledWith("version", "tx-governor-2026-10-27-v1");
    expect(await response.json()).toEqual({ payload, sha256: "a".repeat(64) });
  });
  it("fails closed on revoked access, hidden rows, invalid packets, and service failures", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await GET(request("Bearer synthetic"))).status).toBe(403);
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await GET(request("Bearer synthetic"))).status).toBe(503);
    mocks.maybeSingle.mockResolvedValue({ data: { payload: { ...payload, positions: [{ summary: "PRIVATE INVALID RECORD" }] }, sha256: "a".repeat(64) }, error: null });
    const invalid = await GET(request("Bearer synthetic")); expect(invalid.status).toBe(503); expect(await invalid.text()).not.toContain("PRIVATE INVALID RECORD");
  });
});
