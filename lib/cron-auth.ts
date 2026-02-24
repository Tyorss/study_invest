import { NextRequest } from "next/server";

export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const xHeader = req.headers.get("x-cron-secret");
  if (xHeader && xHeader === secret) return true;

  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  const query = req.nextUrl.searchParams.get("secret");
  return query === secret;
}
