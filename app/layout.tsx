import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Paper Trading League",
  description: "Daily-running paper trading competition analytics",
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
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
