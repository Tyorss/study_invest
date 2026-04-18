import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "스터디 트래커 · Collective Study Ledger",
  description: "10인 스터디의 집중 관찰 종목 · 산업 발표 · 업데이트 피드를 한 곳에",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={monoFont.variable}>
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-8 md:px-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
