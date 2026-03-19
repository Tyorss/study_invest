"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNum } from "@/lib/format";

type TradeRow = {
  id: number;
  trade_date: string;
  side: "BUY" | "SELL" | "CLOSE";
  quantity: number;
  price: number;
  note: string | null;
  source_idea_id?: number | null;
  linked_call?: {
    id: number;
    ticker: string;
    company_name: string;
    presenter: string;
    presented_at: string | null;
  } | null;
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

function sideLabel(side: TradeRow["side"]) {
  if (side === "BUY") return "매수";
  if (side === "SELL") return "매도";
  return "전량 정리";
}

function normalizeSideInput(value: string): TradeRow["side"] | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BUY" || normalized === "매수") return "BUY";
  if (normalized === "SELL" || normalized === "매도") return "SELL";
  if (normalized === "CLOSE" || normalized === "전량정리" || normalized === "전량 정리") return "CLOSE";
  return null;
}

async function readApiResponse(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return { ok: false, error: text?.trim() || `HTTP ${res.status}` };
  }
  return (await res.json()) as ApiResponse;
}

function translateError(message: string) {
  if (message.includes("Quantity must be a positive integer")) return "수량은 1 이상의 정수여야 합니다.";
  if (message.includes("Price must be greater than 0")) return "가격은 0보다 커야 합니다.";
  if (message.includes("Side must be BUY, SELL, or CLOSE")) return "구분은 BUY, SELL, CLOSE 중 하나여야 합니다.";
  if (message.includes("Failed to update trade")) return "거래 수정에 실패했습니다.";
  if (message.includes("Failed to delete trade")) return "거래 삭제에 실패했습니다.";
  return message;
}

export function TradesTable({ rows }: { rows: TradeRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"ALL" | "LINKED" | "INDEPENDENT">("ALL");

  const filteredRows = useMemo(() => {
    if (scope === "LINKED") {
      return rows.filter((row) => row.source_idea_id !== null && row.source_idea_id !== undefined);
    }
    if (scope === "INDEPENDENT") {
      return rows.filter((row) => row.source_idea_id === null || row.source_idea_id === undefined);
    }
    return rows;
  }, [rows, scope]);

  async function onEdit(row: TradeRow) {
    setError(null);
    const tradeDate = window.prompt("거래일 (YYYY-MM-DD)", row.trade_date);
    if (tradeDate === null) return;

    const sideInput = window.prompt(
      "거래 구분 (매수 / 매도 / 전량 정리 또는 BUY / SELL / CLOSE)",
      sideLabel(row.side),
    );
    if (sideInput === null) return;
    const side = normalizeSideInput(sideInput);
    if (!side) {
      setError("구분은 BUY, SELL, CLOSE 중 하나여야 합니다.");
      return;
    }

    let quantity: number | undefined;
    if (side !== "CLOSE") {
      const qtyInput = window.prompt("수량 (1 이상의 정수)", `${Math.round(row.quantity)}`);
      if (qtyInput === null) return;
      const qty = Number(qtyInput);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        setError("수량은 1 이상의 정수여야 합니다.");
        return;
      }
      quantity = qty;
    }

    const priceInput = window.prompt("가격", `${row.price}`);
    if (priceInput === null) return;
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price <= 0) {
      setError("가격은 0보다 커야 합니다.");
      return;
    }

    const noteInput = window.prompt("메모", row.note ?? "");
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
      const message = err instanceof Error ? err.message : "거래 수정에 실패했습니다.";
      setError(translateError(message));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(row: TradeRow) {
    setError(null);
    const ok = window.confirm(`거래 #${row.id}를 삭제할까요?`);
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
      const message = err instanceof Error ? err.message : "거래 삭제에 실패했습니다.";
      setError(translateError(message));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold">거래 내역</div>
        <div className="flex flex-wrap gap-2">
          {[
            ["ALL", "전체"],
            ["LINKED", "스터디 연동"],
            ["INDEPENDENT", "개별 거래"],
          ].map(([value, label]) => {
            const active = scope === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value as "ALL" | "LINKED" | "INDEPENDENT")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {error && <div className="border-b border-slate-200 px-4 py-2 text-sm text-rose-700">{error}</div>}
      <div className="divide-y divide-slate-200 md:hidden">
        {filteredRows.map((row) => {
          const market = row.instruments?.market;
          const priceDigits = market === "KR" ? 0 : market === "US" ? 1 : 4;
          const isBusy = busyId === row.id;
          return (
            <div key={row.id} className="space-y-3 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{row.instruments?.symbol ?? "-"}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.trade_date}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{sideLabel(row.side)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">수량</div>
                  <div className="mt-1 font-medium text-slate-900">{formatNum(row.quantity, 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">가격</div>
                  <div className="mt-1 font-medium text-slate-900">{formatNum(row.price, priceDigits)}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">연결된 스터디 콜</div>
                <div className="mt-1 text-xs leading-5 text-slate-700">
                  {row.linked_call ? (
                    <>
                      <div className="font-medium text-slate-900">{row.linked_call.ticker}</div>
                      <div>
                        {row.linked_call.company_name} · {row.linked_call.presenter}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">개별 거래</span>
                  )}
                </div>
              </div>
              {row.note ? (
                <div>
                  <div className="text-xs text-slate-500">메모</div>
                  <div className="mt-1 text-slate-700">{row.note}</div>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy || busyId !== null}
                  onClick={() => onEdit(row)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  수정
                </button>
                <button
                  type="button"
                  disabled={isBusy || busyId !== null}
                  onClick={() => onDelete(row)}
                  className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
        {filteredRows.length === 0 && <div className="px-4 py-10 text-center text-slate-500">표시할 거래가 없습니다.</div>}
      </div>
      <div className="hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {["거래일", "종목", "연결된 스터디 콜", "구분", "수량", "가격", "메모", "수정"].map((heading) => (
                <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const market = row.instruments?.market;
              const priceDigits = market === "KR" ? 0 : market === "US" ? 1 : 4;
              const isBusy = busyId === row.id;
              return (
                <tr key={row.id} className="border-t border-slate-200/70">
                  <td className="px-3 py-3">{row.trade_date}</td>
                  <td className="px-3 py-3">{row.instruments?.symbol ?? "-"}</td>
                  <td className="px-3 py-3">
                    {row.linked_call ? (
                      <div className="text-xs leading-5 text-slate-600">
                        <div className="font-medium text-slate-900">{row.linked_call.ticker}</div>
                        <div>
                          {row.linked_call.company_name} · {row.linked_call.presenter}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">개별 거래</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{sideLabel(row.side)}</td>
                  <td className="num px-3 py-3">{formatNum(row.quantity, 0)}</td>
                  <td className="num px-3 py-3">{formatNum(row.price, priceDigits)}</td>
                  <td className="px-3 py-3">{row.note ?? ""}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy || busyId !== null}
                        onClick={() => onEdit(row)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || busyId !== null}
                        onClick={() => onDelete(row)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  표시할 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
