"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateNotice } from "@/components/product/product-primitives";

export function RegistrySearch() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); setQuery(draft.trim()); }
  return (
    <div>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Input id="registry-query" label="Vault, request, or transaction" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Enter an address, request ID, or transaction hash" />
        <Button type="submit" variant="outline"><Search size={17} aria-hidden="true" />Search registry</Button>
      </form>
      <div className="mt-5" aria-live="polite">
        {query ? <StateNotice title="No indexed record is available" message={`The registry integration cannot return a verified record for “${query}” in this UI phase. No on-chain lookup was performed.`} /> : <StateNotice title="Registry integration pending" message="Search is locally operable, but it does not query BOT Chain or an indexer yet." />}
      </div>
    </div>
  );
}
