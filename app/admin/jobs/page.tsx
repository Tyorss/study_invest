import Link from "next/link";
import { ManualJobsPanel } from "@/components/manual-jobs-panel";
import { getGameStartDate } from "@/lib/db";
import { todayInSeoul } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  const today = todayInSeoul();
  const benchmarkStartDate = `${String(Number(today.slice(0, 4)) - 1)}-10-01`;
  const tradedPriceStartDate = await getGameStartDate();

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            홈으로 돌아가기
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">운영자용 업데이트 도구</h1>
          <p className="mt-2 text-sm text-slate-600">
            일반 스터디원 화면과 분리된 운영 메뉴입니다. 가격/환율/스냅샷 재생성이 필요할 때만 사용하세요.
          </p>
        </div>
      </header>

      <ManualJobsPanel
        defaultDailyDate={today}
        defaultSnapshotDate={today}
        defaultBenchmarkStartDate={benchmarkStartDate}
        defaultTradedPriceStartDate={tradedPriceStartDate}
      />
    </main>
  );
}
