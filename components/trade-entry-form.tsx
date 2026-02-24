"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  portfolioId: string;
};

function todayLocalIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatKoreanAmount(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const sign = value < 0 ? "-" : "";
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "0";

  const units: Array<{ value: number; label: string }> = [
    { value: 1_0000_0000_0000, label: "조" },
    { value: 1_0000_0000, label: "억" },
    { value: 1_0000, label: "만" },
  ];

  const parts: string[] = [];
  for (const unit of units) {
    if (n < unit.value) continue;
    const q = Math.floor(n / unit.value);
    parts.push(`${new Intl.NumberFormat("ko-KR").format(q)}${unit.label}`);
    n %= unit.value;
  }

  if (n > 0) {
    parts.push(new Intl.NumberFormat("ko-KR").format(n));
  }

  return `${sign}${parts.join(" ")}`;
}

export function TradeEntryForm({ portfolioId }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<"KR" | "US" | "INDEX">("US");
  const [instrumentName, setInstrumentName] = useState("");
  const [tradeDate, setTradeDate] = useState(todayLocalIsoDate());
  const [side, setSide] = useState<"BUY" | "SELL" | "CLOSE">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [buyAmount, setBuyAmount] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxEffectiveDate, setFxEffectiveDate] = useState<string | null>(null);
  const [isFxLoading, setIsFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  const showQuantity = useMemo(() => side !== "CLOSE", [side]);
  const buyAmountValue = useMemo(() => Number(buyAmount), [buyAmount]);
  const hasBuyAmount = useMemo(
    () => side === "BUY" && Number.isFinite(buyAmountValue) && buyAmountValue > 0,
    [side, buyAmountValue],
  );
  const priceValue = useMemo(() => Number(price), [price]);
  const hasValidPrice = useMemo(
    () => Number.isFinite(priceValue) && priceValue > 0,
    [priceValue],
  );

  useEffect(() => {
    let cancelled = false;
    if (side !== "BUY" || market !== "US") {
      setFxRate(null);
      setFxEffectiveDate(null);
      setFxError(null);
      setIsFxLoading(false);
      return;
    }

    async function loadFx() {
      setIsFxLoading(true);
      setFxError(null);
      try {
        const res = await fetch(`/api/fx/rate?date=${encodeURIComponent(tradeDate)}`, {
          cache: "no-store",
        });
        const contentType = res.headers.get("content-type") ?? "";
        type FxResponse = {
          ok?: boolean;
          error?: string;
          rate?: number;
          effective_date?: string;
        };
        let json: FxResponse | null = null;

        if (contentType.includes("application/json")) {
          json = (await res.json()) as FxResponse;
        } else {
          const text = await res.text();
          throw new Error(text?.trim() || `FX API returned non-JSON response (HTTP ${res.status})`);
        }

        if (!res.ok || !json?.ok || !Number.isFinite(Number(json.rate))) {
          throw new Error(json?.error ?? `Failed to fetch FX (HTTP ${res.status})`);
        }

        if (!cancelled) {
          setFxRate(Number(json.rate));
          setFxEffectiveDate(json.effective_date ?? null);
          setFxError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFxRate(null);
          setFxEffectiveDate(null);
          setFxError(err instanceof Error ? err.message : "Failed to fetch FX");
        }
      } finally {
        if (!cancelled) {
          setIsFxLoading(false);
        }
      }
    }

    loadFx();

    return () => {
      cancelled = true;
    };
  }, [side, market, tradeDate]);

  const autoQuantity = useMemo(() => {
    if (!hasBuyAmount || !hasValidPrice) return null;
    if (market === "US") {
      if (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0) {
        return null;
      }
      return Math.floor(buyAmountValue / (priceValue * (fxRate ?? 1)));
    }
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      return null;
    }
    return Math.floor(buyAmountValue / priceValue);
  }, [hasBuyAmount, hasValidPrice, market, fxRate, buyAmountValue, priceValue]);
  const isAutoQuantityEnabled = hasBuyAmount && autoQuantity !== null;
  const isAutoQuantityInvalid = hasBuyAmount && isAutoQuantityEnabled && (autoQuantity ?? 0) < 1;
  const buyAmountModeIssue = useMemo(() => {
    if (!hasBuyAmount) return null;
    if (!hasValidPrice) return "Price를 입력하면 Quantity가 자동 계산됩니다.";
    if (market === "US") {
      if (isFxLoading) return "USDKRW 환율 조회 중...";
      if (fxError) return `환율 조회 실패: ${fxError}`;
      if (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0) {
        return "USDKRW 환율이 없어 Quantity를 계산할 수 없습니다.";
      }
    }
    return null;
  }, [hasBuyAmount, hasValidPrice, market, isFxLoading, fxError, fxRate]);
  const isBuyAmountModeBlocked = hasBuyAmount && buyAmountModeIssue !== null;
  const buyAmountPreview = useMemo(() => {
    if (!hasBuyAmount) return null;
    return `${formatKoreanAmount(buyAmountValue)}원`;
  }, [hasBuyAmount, buyAmountValue]);
  const fxPreview = useMemo(() => {
    if (side !== "BUY" || market !== "US") return null;
    if (isFxLoading) return "USDKRW 환율 조회 중...";
    if (fxError) return `USDKRW 환율 오류: ${fxError}`;
    if (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0) return "USDKRW 환율 없음";
    const fxText = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
      fxRate ?? 0,
    );
    const dateText = fxEffectiveDate ? ` (${fxEffectiveDate})` : "";
    return `적용 환율: 1 USD = ${fxText} KRW${dateText}`;
  }, [side, market, isFxLoading, fxError, fxRate, fxEffectiveDate]);

  useEffect(() => {
    if (!isAutoQuantityEnabled || autoQuantity === null) return;
    const next = String(autoQuantity);
    if (quantity !== next) {
      setQuantity(next);
    }
  }, [isAutoQuantityEnabled, autoQuantity, quantity]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (showQuantity && hasBuyAmount && autoQuantity === null) {
        throw new Error("Buy Amount 자동계산을 완료할 수 없습니다. Price/환율을 확인해 주세요.");
      }

      const normalizedQuantity =
        showQuantity && hasBuyAmount && autoQuantity !== null
          ? autoQuantity
          : showQuantity
            ? Number(quantity)
            : 0;
      if (
        showQuantity &&
        (!Number.isFinite(normalizedQuantity) ||
          normalizedQuantity <= 0 ||
          !Number.isInteger(normalizedQuantity))
      ) {
        throw new Error(
          side === "BUY" && isAutoQuantityEnabled
            ? "Buy amount is too small for current price. Increase amount or lower price."
            : "Quantity must be a positive integer.",
        );
      }

      const payload = {
        portfolio_id: portfolioId,
        symbol: symbol.trim(),
        market,
        instrument_name: instrumentName.trim() || undefined,
        trade_date: tradeDate,
        side,
        quantity: normalizedQuantity,
        price: Number(price),
        note: note.trim() || null,
        auto_rebuild: false,
      };

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get("content-type") ?? "";
      type SubmitResponse = {
        ok?: boolean;
        error?: string;
        instrument_created?: boolean;
        warnings?: string[];
        trade?: { id: number } | null;
        rebuild?: {
          start_date: string;
          end_date: string;
          prices_days: number;
          fx_days: number;
          snapshots_days: number;
        } | null;
      };
      let json: SubmitResponse | null = null;

      if (contentType.includes("application/json")) {
        json = (await res.json()) as SubmitResponse;
      } else {
        const text = await res.text();
        throw new Error(text?.trim() || `API returned non-JSON response (HTTP ${res.status})`);
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Failed to submit trade (HTTP ${res.status})`);
      }
      const data = json;

      const warnings = data.warnings ?? [];
      const rebuildText = data.rebuild
        ? ` Rebuilt ${data.rebuild.start_date}..${data.rebuild.end_date} (prices ${data.rebuild.prices_days}d, fx ${data.rebuild.fx_days}d, snapshots ${data.rebuild.snapshots_days}d).`
        : "";
      const head =
        data.trade
        ? data.instrument_created
            ? "Trade saved. New instrument was created."
            : "Trade saved."
          : "Trade saved.";
      setMessage([head + rebuildText, ...warnings].join(" "));
      setSymbol("");
      setInstrumentName("");
      setBuyAmount("");
      setPrice("");
      setNote("");
      if (side !== "CLOSE") setQuantity("1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel p-4">
      <h3 className="text-base font-semibold text-slate-900">Add Trade (Auto Add Symbol)</h3>
      <p className="mt-1 text-sm text-slate-600">
        If symbol does not exist, it will be created automatically as an active instrument.
      </p>

      <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={onSubmit}>
        <label className="text-sm">
          <div className="mb-1 text-slate-600">Symbol</div>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
            placeholder="AAPL or 005930"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Market</div>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as "KR" | "US" | "INDEX")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="US">US</option>
            <option value="KR">KR</option>
            <option value="INDEX">INDEX</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Name (optional)</div>
          <input
            value={instrumentName}
            onChange={(e) => setInstrumentName(e.target.value)}
            placeholder="Apple Inc"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Trade Date</div>
          <input
            type="date"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Side</div>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "BUY" | "SELL" | "CLOSE")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="CLOSE">CLOSE</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Quantity</div>
          <input
            type="number"
            min="1"
            step="1"
            value={showQuantity ? quantity : "0"}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={!showQuantity || hasBuyAmount}
            required={showQuantity}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 disabled:bg-slate-100"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Buy Amount (KRW, optional)</div>
          <input
            type="number"
            min="0"
            step="1"
            value={side === "BUY" ? buyAmount : ""}
            onChange={(e) => setBuyAmount(e.target.value)}
            disabled={side !== "BUY"}
            placeholder="KRW 예산 입력"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 disabled:bg-slate-100"
          />
          {buyAmountPreview && (
            <p className="mt-1 text-xs text-slate-500">{buyAmountPreview}</p>
          )}
          {fxPreview && <p className="mt-1 text-xs text-slate-500">{fxPreview}</p>}
          {side === "BUY" && isAutoQuantityEnabled && !buyAmountModeIssue && (
            <p className="mt-1 text-xs text-slate-500">
              {isAutoQuantityInvalid
                ? "Buy amount is below current price (max quantity: 0)."
                : `Auto quantity: ${autoQuantity ?? 0}`}
            </p>
          )}
          {side === "BUY" && buyAmountModeIssue && (
            <p className="mt-1 text-xs text-rose-600">{buyAmountModeIssue}</p>
          )}
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Price</div>
          <input
            type="number"
            min="0"
            step="0.000001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">Note</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="memo"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <div className="md:col-span-2 xl:col-span-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting || isAutoQuantityInvalid || isBuyAmountModeBlocked}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Submit Trade"}
          </button>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </form>
    </section>
  );
}
