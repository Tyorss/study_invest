"use client";

import { useMemo, useState } from "react";
import { HoldingsTable } from "@/components/holdings-table";
import { ParticipantHeader } from "@/components/participant-header";
import { ParticipantPerformanceCharts } from "@/components/participant-performance-charts";
import { TradeEntryForm } from "@/components/trade-entry-form";
import { TradesTable } from "@/components/trades-table";

type Props = {
  participantId: string;
  portfolioId: string;
  studyCallOptions: Array<{ id: number; label: string }>;
  initialLatestSnapshot: any;
  initialHoldings: any[];
  initialTrades: any[];
};

type SectionsResponse = {
  ok?: boolean;
  error?: string;
  latestSnapshot?: any;
  holdings?: any[];
  trades?: any[];
};

function getFirstTradeDate(rows: Array<{ trade_date?: string | null }>) {
  return (
    rows
      .map((trade) => String(trade.trade_date ?? ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .at(0) ?? null
  );
}

export function ParticipantDetailShell({
  participantId,
  portfolioId,
  studyCallOptions,
  initialLatestSnapshot,
  initialHoldings,
  initialTrades,
}: Props) {
  const [latestSnapshot, setLatestSnapshot] = useState(initialLatestSnapshot);
  const [holdings, setHoldings] = useState(initialHoldings);
  const [trades, setTrades] = useState(initialTrades);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const firstTradeDate = useMemo(() => getFirstTradeDate(trades), [trades]);

  async function refreshSections() {
    setSectionsError(null);
    const res = await fetch(`/api/participants/${participantId}/sections`, {
      cache: "no-store",
    });
    const contentType = res.headers.get("content-type") ?? "";
    let json: SectionsResponse | null = null;

    if (contentType.includes("application/json")) {
      json = (await res.json()) as SectionsResponse;
    } else {
      const text = await res.text();
      throw new Error(text?.trim() || `참가자 섹션을 불러오지 못했습니다. (HTTP ${res.status})`);
    }

    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? `참가자 섹션을 불러오지 못했습니다. (HTTP ${res.status})`);
    }

    setLatestSnapshot(json.latestSnapshot ?? null);
    setHoldings(json.holdings ?? []);
    setTrades(json.trades ?? []);
    setRefreshToken((prev) => prev + 1);
  }

  async function handleTradeSubmitted() {
    try {
      await refreshSections();
    } catch (err) {
      setSectionsError(
        err instanceof Error ? err.message : "최신 포트폴리오 상태를 다시 불러오지 못했습니다.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <ParticipantHeader snapshot={latestSnapshot} />
      <TradeEntryForm
        portfolioId={portfolioId}
        studyCallOptions={studyCallOptions}
        onSubmitted={handleTradeSubmitted}
      />
      {sectionsError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          거래는 저장됐지만 최신 보유 현황을 다시 불러오는 데 실패했습니다. 새로고침하면 최신 상태를 확인할 수 있습니다.
          <div className="mt-1 text-xs text-amber-700">{sectionsError}</div>
        </div>
      ) : null}
      <HoldingsTable rows={holdings} />
      <TradesTable rows={trades} />
      <ParticipantPerformanceCharts
        firstTradeDate={firstTradeDate}
        participantId={participantId}
        refreshToken={refreshToken}
      />
    </div>
  );
}
