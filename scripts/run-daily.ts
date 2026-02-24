import "tsconfig-paths/register";
import { loadEnvConfig } from "@next/env";
import { yesterdayInSeoul } from "../lib/time";

loadEnvConfig(process.cwd());

async function main() {
  const { runDailyPipeline } = await import("../lib/jobs/runner");
  const [, , dateArg] = process.argv;
  const targetDate = dateArg ?? yesterdayInSeoul();
  const result = await runDailyPipeline(targetDate);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
