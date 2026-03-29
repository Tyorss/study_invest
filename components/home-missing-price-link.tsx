"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MissingPriceResponse = {
  ok?: boolean;
  uniqueCount?: number;
  error?: string;
};

export function HomeMissingPriceLink() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/home/missing-price-overview");
        const json = (await res.json()) as MissingPriceResponse;
        if (!res.ok || !json.ok) return;
        if (!cancelled) {
          setCount(typeof json.uniqueCount === "number" ? json.uniqueCount : 0);
        }
      } catch {
        if (!cancelled) setCount(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedCount = count ?? 0;

  return (
    <Link
      href="/admin/missing-prices"
      className={`hover:underline ${
        resolvedCount > 0
          ? "font-medium text-rose-600 hover:text-rose-700"
          : "text-slate-400 hover:text-slate-600"
      }`}
    >
      전체 미조회 종목 {count === null ? "..." : resolvedCount}개
    </Link>
  );
}
