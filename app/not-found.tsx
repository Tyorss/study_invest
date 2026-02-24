import Link from "next/link";

export default function NotFound() {
  return (
    <main className="panel p-8 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">Requested resource does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">
        Go to leaderboard
      </Link>
    </main>
  );
}
