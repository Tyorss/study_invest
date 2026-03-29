"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  portfolioId: string;
  studyCallOptions: Array<{ id: number; label: string }>;
  onSubmitted?: () => Promise<void> | void;
};

type Market = "KR" | "US" | "INDEX";
type TradeSide = "BUY" | "SELL" | "CLOSE";

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

function formatDecimalAmount(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

function inferMarketFromSymbol(symbol: string): Market | null {
  const value = symbol.trim().toUpperCase();
  if (!value) return null;
  if (/^\d{6}$/.test(value)) return "KR";
  if (["KS11", "KQ11", "KOSPI", "KOSDAQ"].includes(value)) return "INDEX";
  if (/^[A-Z][A-Z0-9.-]*$/.test(value)) return "US";
  return null;
}

function sideLabel(side: TradeSide) {
  if (side === "BUY") return "매수";
  if (side === "SELL") return "매도";
  return "전량 정리";
}

function translateQuoteSource(source: string) {
  if (source.startsWith("stored:")) {
    return `저장된 가격 데이터 (${source.replace("stored:", "")})`;
  }
  if (source.startsWith("provider:")) {
    return `외부 시세 조회 (${source.replace("provider:", "")})`;
  }
  return source;
}

function translateTradeError(message: string, context?: { symbol?: string; market?: Market }) {
  if (message.includes("portfolio_id is required")) return "포트폴리오 정보가 없어 거래를 저장할 수 없습니다.";
  if (message.includes("instrument_id or symbol is required")) return "종목코드를 입력해 주세요.";
  if (message.includes("market is required")) return "시장 구분을 선택해 주세요.";
  if (message.includes("invalid market")) return "시장 구분이 올바르지 않습니다.";
  if (message.includes("trade_date is required")) return "거래일을 입력해 주세요.";
  if (message.includes("trade_date must be YYYY-MM-DD")) return "거래일 형식은 YYYY-MM-DD여야 합니다.";
  if (message.includes("invalid side")) return "거래 구분이 올바르지 않습니다.";
  if (message.includes("quantity must be a positive integer")) return "수량은 1 이상의 정수로 입력해 주세요.";
  if (message.includes("price must be > 0")) return "가격은 0보다 커야 합니다.";
  if (message.includes("source_idea_id must be a positive integer")) return "연결한 스터디 콜 정보가 올바르지 않습니다.";
  if (message.includes("Buy amount 자동계산")) return "매수 금액 기준 자동 계산을 완료하지 못했습니다. 가격이나 환율을 확인해 주세요.";
  if (message.includes("Buy amount is too small for current price")) return "매수 금액이 현재 가격보다 작아 수량을 계산할 수 없습니다.";
  if (message.includes("Portfolio not found")) return "포트폴리오를 찾을 수 없습니다.";
  if (message.includes("Instrument not found")) return "종목 정보를 찾지 못했습니다.";
  if (message.includes("Participant not found for portfolio")) return "참가자 정보를 찾을 수 없습니다.";
  if (message.includes("SELL/CLOSE cannot exceed current position")) return "현재 보유 수량보다 많이 매도할 수 없습니다.";
  if (message.includes("BUY cannot make cash negative")) return "현금보다 큰 금액은 매수할 수 없습니다.";
  if (message.includes("No position to CLOSE")) return "정리할 보유 수량이 없습니다.";
  if (message.includes("Missing USDKRW FX")) return "해당 날짜의 환율 정보가 없어 거래를 계산할 수 없습니다.";
  if (message.includes("Unknown error")) return "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  if (message.includes("Unexpected server error")) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  if (message.includes("Notes API did not return JSON")) return "서버 응답 형식이 올바르지 않습니다.";
  if (message.includes("You have run out of API credits for the current minute")) {
    return "시세 제공사의 분당 조회 한도를 잠시 초과했습니다. 1분 정도 뒤에 다시 시도해 주세요.";
  }
  if (message.includes("No close price returned")) {
    if (context?.market === "KR") {
      return "해당 한국 종목의 가격을 찾지 못했습니다. 종목코드 6자리를 다시 확인해 주세요.";
    }
    return "선택한 날짜 기준 가격을 찾지 못했습니다.";
  }
  if (message.includes("No price found for")) {
    if (context?.market === "KR") {
      return "해당 한국 종목의 가격을 찾지 못했습니다. 종목코드 6자리를 다시 확인해 주세요.";
    }
    return "해당 종목의 가격을 찾지 못했습니다.";
  }
  if (message.includes("No response for")) {
    if (context?.market === "KR" || /^\d{6}$/.test(context?.symbol ?? "")) {
      return "한국 종목 가격을 찾지 못했습니다. 종목코드 6자리와 거래일을 확인해 주세요.";
    }
    return "시세 응답이 없어 가격을 불러오지 못했습니다.";
  }
  if (message.includes("symbol is required")) return "종목코드를 입력해 주세요.";
  if (message.includes("market must be KR, US, or INDEX")) return "시장 구분은 국내, 미국, 지수 중 하나여야 합니다.";
  if (message.includes("date must be YYYY-MM-DD")) return "날짜 형식은 YYYY-MM-DD여야 합니다.";
  if (message.includes("Failed to fetch FX")) return "환율을 불러오지 못했습니다.";
  if (message.includes("Failed to fetch quote")) return "가격을 불러오지 못했습니다.";
  if (message.includes("Failed to submit trade")) return "거래 저장에 실패했습니다.";
  return message;
}

export function TradeEntryForm({ portfolioId, studyCallOptions, onSubmitted }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<Market>("KR");
  const [instrumentName, setInstrumentName] = useState("");
  const [tradeDate, setTradeDate] = useState(todayLocalIsoDate());
  const [side, setSide] = useState<TradeSide>("BUY");
  const [quantity, setQuantity] = useState("1");
  const [buyAmount, setBuyAmount] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [sourceIdeaId, setSourceIdeaId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxEffectiveDate, setFxEffectiveDate] = useState<string | null>(null);
  const [isFxLoading, setIsFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteInfo, setQuoteInfo] = useState<{
    source: string;
    requestedDate: string;
    effectiveDate: string | null;
  } | null>(null);
  const [priceDirty, setPriceDirty] = useState(false);

  const showQuantity = useMemo(() => side !== "CLOSE", [side]);
  const buyAmountValue = useMemo(() => Number(buyAmount), [buyAmount]);
  const hasBuyAmount = useMemo(
    () => side === "BUY" && Number.isFinite(buyAmountValue) && buyAmountValue > 0,
    [side, buyAmountValue],
  );
  const priceValue = useMemo(() => Number(price), [price]);
  const hasValidPrice = useMemo(() => Number.isFinite(priceValue) && priceValue > 0, [priceValue]);
  const canLookupQuote = useMemo(
    () => symbol.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate),
    [symbol, tradeDate],
  );

  const fetchQuote = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const silent = options?.silent ?? false;
      const force = options?.force ?? false;
      if (!canLookupQuote) return;
      if (!force && priceDirty && price.trim().length > 0) return;

      const params = new URLSearchParams({
        symbol: symbol.trim(),
        market,
        date: tradeDate,
      });

      setIsQuoteLoading(true);
      if (!silent) {
        setQuoteError(null);
      }

      try {
        const res = await fetch(`/api/trades/quote?${params.toString()}`, {
          cache: "no-store",
        });
        const contentType = res.headers.get("content-type") ?? "";
        type QuoteResponse = {
          ok?: boolean;
          error?: string;
          price?: number;
          source?: string;
          effective_date?: string | null;
          requested_date?: string;
          instrument_name?: string | null;
        };
        let json: QuoteResponse | null = null;

        if (contentType.includes("application/json")) {
          json = (await res.json()) as QuoteResponse;
        } else {
          const text = await res.text();
          throw new Error(text?.trim() || `Quote API returned non-JSON response (HTTP ${res.status})`);
        }

        if (!res.ok || !json?.ok || !Number.isFinite(Number(json.price))) {
          throw new Error(json?.error ?? `Failed to fetch quote (HTTP ${res.status})`);
        }

        setPrice(String(json.price));
        setPriceDirty(false);
        setQuoteInfo({
          source: json.source ?? "unknown",
          requestedDate: json.requested_date ?? tradeDate,
          effectiveDate: json.effective_date ?? null,
        });
        if (!instrumentName.trim() && json.instrument_name?.trim()) {
          setInstrumentName(json.instrument_name.trim());
        }
        setQuoteError(null);
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : "Failed to fetch quote";
        if (!silent) {
          setQuoteError(
            translateTradeError(rawMessage, {
              symbol: symbol.trim(),
              market,
            }),
          );
        }
      } finally {
        setIsQuoteLoading(false);
      }
    },
    [canLookupQuote, instrumentName, market, price, priceDirty, symbol, tradeDate],
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
          setFxError(
            translateTradeError(err instanceof Error ? err.message : "Failed to fetch FX"),
          );
        }
      } finally {
        if (!cancelled) {
          setIsFxLoading(false);
        }
      }
    }

    void loadFx();

    return () => {
      cancelled = true;
    };
  }, [side, market, tradeDate]);

  useEffect(() => {
    setQuoteInfo(null);
    setQuoteError(null);
  }, [symbol, market, tradeDate]);

  useEffect(() => {
    if (!canLookupQuote) return;
    if (priceDirty && price.trim().length > 0) return;

    const timer = window.setTimeout(() => {
      void fetchQuote({ silent: true, force: true });
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canLookupQuote, fetchQuote, price, priceDirty]);

  const autoQuantity = useMemo(() => {
    if (!hasBuyAmount || !hasValidPrice) return null;
    if (market === "US") {
      if (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0) return null;
      return Math.floor(buyAmountValue / (priceValue * (fxRate ?? 1)));
    }
    return Math.floor(buyAmountValue / priceValue);
  }, [buyAmountValue, fxRate, hasBuyAmount, hasValidPrice, market, priceValue]);

  const isAutoQuantityEnabled = hasBuyAmount && autoQuantity !== null;
  const isAutoQuantityInvalid = hasBuyAmount && isAutoQuantityEnabled && (autoQuantity ?? 0) < 1;
  const buyAmountModeIssue = useMemo(() => {
    if (!hasBuyAmount) return null;
    if (!hasValidPrice) return "가격을 먼저 입력하면 수량을 자동 계산할 수 있습니다.";
    if (market === "US") {
      if (isFxLoading) return "달러 환율을 불러오는 중입니다.";
      if (fxError) return fxError;
      if (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0) {
        return "달러 환율이 없어 수량을 자동 계산할 수 없습니다.";
      }
    }
    return null;
  }, [fxError, fxRate, hasBuyAmount, hasValidPrice, isFxLoading, market]);

  const isBuyAmountModeBlocked = hasBuyAmount && buyAmountModeIssue !== null;
  const buyAmountPreview = useMemo(() => {
    if (!hasBuyAmount) return null;
    return `${formatKoreanAmount(buyAmountValue)}원`;
  }, [buyAmountValue, hasBuyAmount]);

  const fxPreview = useMemo(() => {
    if (side !== "BUY" || market !== "US") return null;
    if (isFxLoading) return "달러 환율을 불러오는 중입니다.";
    if (fxError) return fxError;
    if (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0) return "달러 환율 정보가 없습니다.";
    const fxText = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(fxRate ?? 0);
    const dateText = fxEffectiveDate ? ` (${fxEffectiveDate})` : "";
    return `적용 환율: 1 USD = ${fxText} KRW${dateText}`;
  }, [fxEffectiveDate, fxError, fxRate, isFxLoading, market, side]);

  const effectiveQuantity = useMemo(() => {
    if (!showQuantity) return null;
    if (hasBuyAmount && autoQuantity !== null) return autoQuantity;
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [autoQuantity, hasBuyAmount, quantity, showQuantity]);

  const totalTradePreview = useMemo(() => {
    if (!showQuantity || !hasValidPrice || effectiveQuantity === null || effectiveQuantity <= 0) {
      return null;
    }

    const total = effectiveQuantity * priceValue;
    if (!Number.isFinite(total) || total <= 0) return null;

    const label =
      side === "BUY" ? "예상 총 매수 금액" : side === "SELL" ? "예상 총 매도 금액" : "예상 총 거래 금액";

    if (market === "US") {
      const usdText = `USD ${formatDecimalAmount(total)}`;
      if (Number.isFinite(fxRate) && (fxRate ?? 0) > 0) {
        const krwTotal = total * (fxRate ?? 0);
        return `${label}: ${usdText} (약 ${formatKoreanAmount(krwTotal)}원)`;
      }
      if (isFxLoading) {
        return `${label}: ${usdText} (원화 환산 불러오는 중)`;
      }
      return `${label}: ${usdText}`;
    }

    return `${label}: ${formatKoreanAmount(total)}원`;
  }, [effectiveQuantity, fxRate, hasValidPrice, isFxLoading, market, priceValue, showQuantity, side]);

  useEffect(() => {
    if (!isAutoQuantityEnabled || autoQuantity === null) return;
    const next = String(autoQuantity);
    if (quantity !== next) {
      setQuantity(next);
    }
  }, [autoQuantity, isAutoQuantityEnabled, quantity]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (showQuantity && hasBuyAmount && autoQuantity === null) {
        throw new Error("Buy amount 자동계산을 완료할 수 없습니다.");
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
            ? "Buy amount is too small for current price."
            : "quantity must be a positive integer",
        );
      }

      const payload = {
        portfolio_id: portfolioId,
        symbol: symbol.trim(),
        market,
        instrument_name: instrumentName.trim() || undefined,
        source_idea_id: sourceIdeaId ? Number(sourceIdeaId) : null,
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

      const warnings = (json.warnings ?? []).map((warning) => translateTradeError(warning));
      const rebuildText = json.rebuild
        ? ` 거래 저장 후 ${json.rebuild.start_date}부터 ${json.rebuild.end_date}까지 가격 ${json.rebuild.prices_days}일, 환율 ${json.rebuild.fx_days}일, 스냅샷 ${json.rebuild.snapshots_days}일을 다시 계산했습니다.`
        : "";
      const head = json.instrument_created
        ? "거래를 저장했고, 새 종목도 자동으로 추가했습니다."
        : "거래를 저장했습니다.";

      setMessage([head + rebuildText, ...warnings].filter(Boolean).join(" "));
      setSymbol("");
      setMarket("KR");
      setInstrumentName("");
      setBuyAmount("");
      setPrice("");
      setPriceDirty(false);
      setQuoteInfo(null);
      setQuoteError(null);
      setNote("");
      setSourceIdeaId("");
      if (side !== "CLOSE") setQuantity("1");
      if (onSubmitted) {
        await onSubmitted();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(
        translateTradeError(err instanceof Error ? err.message : "Unknown error", {
          symbol: symbol.trim(),
          market,
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">거래 입력</h3>
          <p className="mt-1 text-sm text-slate-600">
            처음에는 종목코드, 거래일, 거래 구분, 수량, 가격만 입력해도 됩니다.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            한국 종목은 6자리 숫자를 입력하면 국내 시장으로 자동 인식합니다. 예: 005930
          </p>
        </div>
      </div>

      <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={onSubmit}>
        <label className="text-sm">
          <div className="mb-1 text-slate-600">종목코드</div>
          <input
            value={symbol}
            onChange={(e) => {
              const next = e.target.value;
              setSymbol(next);
              setInstrumentName("");
              const inferred = inferMarketFromSymbol(next);
              if (inferred) {
                setMarket(inferred);
              }
            }}
            required
            placeholder="005930 또는 AAPL"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">거래일</div>
          <input
            type="date"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">거래 구분</div>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as TradeSide)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="BUY">매수</option>
            <option value="SELL">매도</option>
            <option value="CLOSE">전량 정리</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">수량</div>
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
          {side === "BUY" && isAutoQuantityEnabled && !buyAmountModeIssue && (
            <p className="mt-1 text-xs text-slate-500">
              {isAutoQuantityInvalid ? "매수 금액이 현재 가격보다 작아 수량이 0주로 계산됩니다." : `자동 계산 수량: ${autoQuantity ?? 0}주`}
            </p>
          )}
        </label>

        <label className="text-sm md:col-span-2 xl:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-slate-600">
            <span>가격</span>
            <button
              type="button"
              onClick={() => void fetchQuote({ force: true })}
              disabled={isQuoteLoading || !canLookupQuote}
              className="text-xs font-medium text-slate-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isQuoteLoading ? "불러오는 중..." : "자동 채우기"}
            </button>
          </div>
          <input
            type="number"
            min="0"
            step="0.000001"
            value={price}
            onChange={(e) => {
              const next = e.target.value;
              setPrice(next);
              setPriceDirty(next.trim().length > 0);
            }}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            선택한 날짜 기준 최근 종가를 자동으로 채웁니다. 오늘 날짜면 가장 가까운 일봉 종가를 사용합니다.
          </p>
          {quoteInfo && (
            <p className="mt-1 text-xs text-slate-500">
              가격 출처: {translateQuoteSource(quoteInfo.source)}
              {quoteInfo.effectiveDate
                ? ` (${quoteInfo.effectiveDate})`
                : ` (${quoteInfo.requestedDate} 이전 데이터)`}
            </p>
          )}
          {totalTradePreview && <p className="mt-1 text-xs font-medium text-slate-700">{totalTradePreview}</p>}
          {quoteError && <p className="mt-1 text-xs text-rose-600">{quoteError}</p>}
        </label>

        <details className="md:col-span-2 xl:col-span-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            추가 설정 보기
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <div className="mb-1 text-slate-600">시장 구분</div>
              <select
                value={market}
                onChange={(e) => {
                  setMarket(e.target.value as Market);
                  setInstrumentName("");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="KR">국내</option>
                <option value="US">미국</option>
                <option value="INDEX">지수</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">종목명 (선택)</div>
              <input
                value={instrumentName}
                onChange={(e) => setInstrumentName(e.target.value)}
                placeholder="종목명을 직접 입력할 때만 사용"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">매수 금액 (선택)</div>
              <input
                type="number"
                min="0"
                step="1"
                value={side === "BUY" ? buyAmount : ""}
                onChange={(e) => setBuyAmount(e.target.value)}
                disabled={side !== "BUY"}
                placeholder="원화 기준 예산"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 disabled:bg-slate-100"
              />
              {buyAmountPreview && <p className="mt-1 text-xs text-slate-500">{buyAmountPreview}</p>}
              {fxPreview && <p className="mt-1 text-xs text-slate-500">{fxPreview}</p>}
              {side === "BUY" && buyAmountModeIssue && (
                <p className="mt-1 text-xs text-rose-600">{buyAmountModeIssue}</p>
              )}
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">스터디 콜 연결 (선택)</div>
              <select
                value={sourceIdeaId}
                onChange={(e) => setSourceIdeaId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="">개별 거래로 저장</option>
                {studyCallOptions.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm md:col-span-2 xl:col-span-4">
              <div className="mb-1 text-slate-600">메모 (선택)</div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="간단한 판단 근거나 메모"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>
          </div>
        </details>

        <div className="flex items-center gap-2 md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            disabled={isSubmitting || isAutoQuantityInvalid || isBuyAmountModeBlocked}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "저장 중..." : `${sideLabel(side)} 거래 저장`}
          </button>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </form>
    </section>
  );
}
