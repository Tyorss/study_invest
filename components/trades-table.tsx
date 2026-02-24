"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNum } from "@/lib/format";

type TradeRow = {
  id: number;
  trade_date: string;
  side: "BUY" | "SELL" | "CLOSE";
  quantity: number;
  price: number;
  note: string | null;
  instruments?: {
    symbol?: string;
    market?: string;
    currency?: string;
  } | null;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

async function readApiResponse(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return { ok: false, error: text?.trim() || `HTTP ${res.status}` };
  }
  return (await res.json()) as ApiResponse;
}

export function TradesTable({ rows }: { rows: TradeRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onEdit(row: TradeRow) {
    setError(null);
    const tradeDate = window.prompt("Trade Date (YYYY-MM-DD)", row.trade_date);
    if (tradeDate === null) return;

    const sideInput = window.prompt("Side (BUY / SELL / CLOSE)", row.side);
    if (sideInput === null) return;
    const side = sideInput.trim().toUpperCase();
    if (!["BUY", "SELL", "CLOSE"].includes(side)) {
      setError("Side must be BUY, SELL, or CLOSE.");
      return;
    }

    let quantity: number | undefined;
    if (side !== "CLOSE") {
      const qtyInput = window.prompt("Quantity (positive integer)", `${Math.round(row.quantity)}`);
      if (qtyInput === null) return;
      const qty = Number(qtyInput);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        setError("Quantity must be a positive integer.");
        return;
      }
      quantity = qty;
    }

    const priceInput = window.prompt("Price (> 0)", `${row.price}`);
    if (priceInput === null) return;
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    const noteInput = window.prompt("Note", row.note ?? "");
    if (noteInput === null) return;

    try {
      setBusyId(row.id);
      const res = await fetch(`/api/trades/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade_date: tradeDate,
          side,
          quantity,
          price,
          note: noteInput.trim() || null,
          auto_rebuild: false,
        }),
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to update trade (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trade");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(row: TradeRow) {
    setError(null);
    const ok = window.confirm(`Delete trade #${row.id}?`);
    if (!ok) return;

    try {
      setBusyId(row.id);
      const res = await fetch(`/api/trades/${row.id}`, {
        method: "DELETE",
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to delete trade (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trade");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel overflow-auto">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Trades Journal</div>
      {error && <div className="border-b border-slate-200 px-4 py-2 text-sm text-rose-700">{error}</div>}
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {["Date", "Symbol", "Side", "Qty", "Price", "Note", "Action"].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const market = r.instruments?.market;
            const priceDigits = market === "KR" ? 0 : market === "US" ? 1 : 4;
            const isBusy = busyId === r.id;
            return (
              <tr key={r.id} className="border-t border-slate-200/70">
                <td className="px-3 py-3">{r.trade_date}</td>
                <td className="px-3 py-3">{r.instruments?.symbol ?? "-"}</td>
                <td className="px-3 py-3">{r.side}</td>
                <td className="num px-3 py-3">{formatNum(r.quantity, 0)}</td>
                <td className="num px-3 py-3">{formatNum(r.price, priceDigits)}</td>
                <td className="px-3 py-3">{r.note ?? ""}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy || busyId !== null}
                      onClick={() => onEdit(r)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || busyId !== null}
                      onClick={() => onDelete(r)}
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                No trades
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
