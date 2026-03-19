import Link from "next/link";
import { formatNum } from "@/lib/format";
import { fetchMissingPriceHoldings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MissingPricesPage() {
  const rows = await fetchMissingPriceHoldings();

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/" className="text-sm text-slate-500 hover:underline">
              홈으로 돌아가기
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">현재가 미조회 종목</h1>
            <p className="mt-2 text-sm text-slate-600">
              최신 평가 기준일에 시세를 찾지 못해 평균단가로 대신 계산한 보유 종목 목록입니다.
            </p>
          </div>
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            총 {rows.length}개
          </div>
        </div>
      </header>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">세부 목록</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {["참가자", "평가일", "종목코드", "종목명", "시장", "수량", "평균단가", "대체 현재가"].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const digits = row.currency === "KRW" ? 0 : row.market === "US" ? 1 : 4;
                return (
                  <tr key={`${row.participant_id}-${row.symbol}`} className="border-t border-slate-200/70">
                    <td className="px-3 py-3">
                      <Link
                        href={`/participants/${row.participant_id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {row.participant_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.valuation_date}</td>
                    <td className="px-3 py-3">{row.symbol}</td>
                    <td className="px-3 py-3">{row.name}</td>
                    <td className="px-3 py-3">{row.market}</td>
                    <td className="num px-3 py-3">{formatNum(row.quantity, 0)}</td>
                    <td className="num px-3 py-3">{formatNum(row.avg_cost_local, digits)}</td>
                    <td
                      className="num px-3 py-3 font-medium text-rose-600"
                      title="실제 시세를 찾지 못해 평균단가를 대체 현재가로 사용 중입니다."
                    >
                      {formatNum(row.fallback_mark_local, digits)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    현재가 미조회 종목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
