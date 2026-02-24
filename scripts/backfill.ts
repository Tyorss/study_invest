import "tsconfig-paths/register";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { backfillFx, backfillPrices, backfillSnapshots } = await import(
    "../lib/jobs/runner"
  );
  const [, , mode = "all", startDate, endDate] = process.argv;
  if (!startDate || !endDate) {
    throw new Error(
      "Usage: npm run backfill -- <prices|fx|snapshots|all> <startDate> <endDate>",
    );
  }

  if (mode === "prices") {
    const out = await backfillPrices(startDate, endDate);
    console.log(JSON.stringify({ mode, startDate, endDate, count: out.length }, null, 2));
    return;
  }

  if (mode === "fx") {
    const out = await backfillFx(startDate, endDate);
    console.log(JSON.stringify({ mode, startDate, endDate, count: out.length }, null, 2));
    return;
  }

  if (mode === "snapshots") {
    const out = await backfillSnapshots(startDate, endDate);
    console.log(JSON.stringify({ mode, startDate, endDate, count: out.length }, null, 2));
    return;
  }

  const prices = await backfillPrices(startDate, endDate);
  const fx = await backfillFx(startDate, endDate);
  const snapshots = await backfillSnapshots(startDate, endDate);
  console.log(
    JSON.stringify(
      {
        mode: "all",
        startDate,
        endDate,
        prices: prices.length,
        fx: fx.length,
        snapshots: snapshots.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
