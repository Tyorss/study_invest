import Link from "next/link";
import { formatNum } from "@/lib/format";
import { fetchMissingPriceOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MissingPricesPage() {
  const overview = await fetchMissingPriceOverview();
  const rows = overview.items;

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/" className="text-sm text-slate-500 hover:underline">
              홈으로 돌아가기
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">전체 미조회 종목</h1>
            <p className="mt-2 text-sm text-slate-600">
              보유 종목, 스터디 정리, 자유 종목을 합쳐서 현재가를 찾지 못한 종목을 모아둔 화면입니다.
            </p>
          </div>
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            고유 종목 {overview.uniqueCount}개
          </div>
        </div>
      </header>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">세부 목록</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {["구분", "이름", "기준일", "종목코드", "종목명", "시장", "대체값", "사유"].map((heading) => (
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
                  <tr key={`${row.source}-${row.symbol}-${row.owner_id ?? row.owner_label ?? "-"}`} className="border-t border-slate-200/70">
                    <td className="px-3 py-3 font-medium text-slate-900">{row.source_label}</td>
                    <td className="px-3 py-3">
                      {row.source === "portfolio" && row.owner_label && row.owner_id ? (
                        <Link
                          href={`/participants/${row.owner_id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {row.owner_label}
                        </Link>
                      ) : (
                        <span className="text-slate-600">{row.owner_label ?? "-"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.valuation_date ?? "-"}</td>
                    <td className="px-3 py-3">{row.symbol}</td>
                    <td className="px-3 py-3">{row.name}</td>
                    <td className="px-3 py-3">{row.market ?? "-"}</td>
                    <td
                      className="num px-3 py-3 font-medium text-rose-600"
                      title="대체로 사용된 값 또는 현재가 미조회 상태입니다."
                    >
                      {row.fallback_value === null ? "-" : formatNum(row.fallback_value, digits)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.reason ?? "-"}</td>
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
