"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type NoteLine = {
  symbol: string;
  memo_text: string;
};

type Props = {
  participantId: string;
  initialMarketNote: string;
  initialLines: Array<{ symbol: string | null; memo_text: string }>;
};

export function ParticipantNotesEditor({
  participantId,
  initialMarketNote,
  initialLines,
}: Props) {
  const router = useRouter();
  const [marketNote, setMarketNote] = useState(initialMarketNote);
  const [rows, setRows] = useState<NoteLine[]>(
    initialLines.length > 0
      ? initialLines.map((x) => ({
          symbol: x.symbol ?? "",
          memo_text: x.memo_text ?? "",
        }))
      : [{ symbol: "", memo_text: "" }],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, key: keyof NoteLine, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { symbol: "", memo_text: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => {
      if (prev.length === 1) return [{ symbol: "", memo_text: "" }];
      return prev.filter((_, i) => i !== index);
    });
  }

  async function save() {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        market_note: marketNote,
        lines: rows.map((x) => ({
          symbol: x.symbol.trim() || null,
          memo_text: x.memo_text,
        })),
      };
      const res = await fetch(`/api/participants/${participantId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let json: { ok?: boolean; error?: string } | null = null;
      try {
        json = JSON.parse(raw) as { ok?: boolean; error?: string };
      } catch {
        const isHtml = raw.trimStart().startsWith("<!DOCTYPE") || raw.trimStart().startsWith("<html");
        const hint = isHtml
          ? "Notes API route did not return JSON (likely 404/500 HTML page). Restart dev server and verify /api/participants/[participantId]/notes."
          : raw.slice(0, 180);
        throw new Error(`Notes save failed (${res.status}). ${hint}`);
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to save notes");
      }
      setMessage("Notes saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="mb-3 text-base font-semibold text-slate-900">Notes</div>
      <div className="grid grid-cols-1 gap-4">
        <label className="text-sm">
          <div className="mb-1 text-slate-600">Market View</div>
          <textarea
            value={marketNote}
            onChange={(e) => setMarketNote(e.target.value)}
            rows={4}
            placeholder="Write market outlook and macro notes..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <div>
          <div className="mb-2 text-sm text-slate-600">Asset-level Notes</div>
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-36 px-3 py-2 text-left font-semibold">Symbol</th>
                  <th className="px-3 py-2 text-left font-semibold">Memo</th>
                  <th className="w-20 px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-200/70">
                    <td className="px-3 py-2 align-top">
                      <input
                        value={row.symbol}
                        onChange={(e) => updateRow(idx, "symbol", e.target.value)}
                        placeholder="NVDA"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea
                        value={row.memo_text}
                        onChange={(e) => updateRow(idx, "memo_text", e.target.value)}
                        rows={2}
                        placeholder="Why this position, key risk, target thesis..."
                        className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-500"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={addRow}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              + Add Row
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Notes"}
          </button>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
