"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RaceComparison } from "./race-comparison";
import { Button } from "./ui/button";
import { researchPacketSchema, type ResearchPacket } from "@/domain/comparison";

export function ResearchPreview({ client }: { client: SupabaseClient }) {
  const [packet, setPacket] = useState<ResearchPacket | null>(null);
  const [checksum, setChecksum] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try {
      const { data } = await client.auth.getSession();
      if (!data.session) throw new Error("Sign in again to view the private draft.");
      const response = await fetch("/api/research-preview", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("The research preview could not be loaded. Check your reviewer access and try again.");
      const result = await response.json();
      setPacket(researchPacketSchema.parse(result.payload)); setChecksum(result.sha256);
    } catch (failure) { setPacket(null); setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="research-preview" aria-labelledby="research-preview-heading">
    <h2 id="research-preview-heading">Governor research preview</h2>
    <p>Inspect proposed mappings, source links, exclusions, and preview calculations. This view records no approval and publishes no candidate positions.</p>
    <p role="status">{error}</p>
    {packet ? <><Button variant="outline" onClick={() => { setPacket(null); setChecksum(""); }}>Close private research</Button><details><summary>Draft checksum</summary><p className="source-checksum">{checksum}</p></details><RaceComparison research={packet} preview /></> : <Button variant="outline" disabled={busy} onClick={() => void load()}>{busy ? "Loading research…" : "Open governor research preview"}</Button>}
  </section>;
}
