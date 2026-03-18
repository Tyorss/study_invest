"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/study-tracker", label: "Actionable Calls" },
  { href: "/study-tracker/sessions", label: "Sessions" },
  { href: "/study-tracker/portfolio", label: "Included Portfolio" },
];

export function StudyTrackerNav() {
  const pathname = usePathname();

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              active
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
