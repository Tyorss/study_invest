import { NextResponse } from "next/server";
import { fetchParticipantDetail } from "@/lib/queries";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const head = headers.map(csvEscape).join(",");
  const body = rows
    .map((row) => headers.map((h) => csvEscape(row[h])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export async function GET(
  _: Request,
  { params }: { params: { participantId: string } },
) {
  const data = await fetchParticipantDetail(params.participantId);
  if (!data) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const trades = data.trades.map((t: any) => ({
    id: t.id,
    trade_date: t.trade_date,
    symbol: t.instruments?.symbol ?? "",
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    note: t.note ?? "",
  }));

  const snapshots = data.snapshots.map((s: any) => ({
    date: s.date,
    nav_krw: s.nav_krw,
    cash_krw: s.cash_krw,
    holdings_value_krw: s.holdings_value_krw,
    realized_pnl_krw: s.realized_pnl_krw,
    unrealized_pnl_krw: s.unrealized_pnl_krw,
    total_return_pct: s.total_return_pct,
    spy_return_pct: s.spy_return_pct ?? "",
    kospi_return_pct: s.kospi_return_pct ?? "",
    alpha_spy_pct: s.alpha_spy_pct ?? "",
    alpha_kospi_pct: s.alpha_kospi_pct ?? "",
    ret_daily: s.ret_daily ?? "",
    vol_ann_252: s.vol_ann_252 ?? "",
    sharpe_252: s.sharpe_252 ?? "",
    mdd_to_date: s.mdd_to_date,
    beta_spy_252: s.beta_spy_252 ?? "",
    beta_kospi_252: s.beta_kospi_252 ?? "",
  }));

  const csv = [
    "# trades",
    toCsv(trades),
    "",
    "# snapshots",
    toCsv(snapshots),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${encodeURIComponent(
        data.participant.name,
      )}_export.csv\"`,
    },
  });
}
