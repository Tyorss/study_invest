import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Market } from "@/types/db";
import type { DailyClosePoint, MarketDataProvider } from "@/lib/providers/types";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "python_market_data.py");
const LOCAL_VENDOR_PATH = path.join(process.cwd(), ".python_packages");

type PythonBackend = "yfinance" | "fdr";

async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function pythonCandidates() {
  const envBin = process.env.MARKET_DATA_PYTHON_BIN?.trim();
  const values = [
    envBin,
    path.join(process.cwd(), ".venv", "bin", "python"),
    path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
    "python3",
    "python",
  ];
  return values.filter((value): value is string => Boolean(value));
}

async function pickPythonBin() {
  for (const candidate of pythonCandidates()) {
    if (candidate === "python3" || candidate === "python") return candidate;
    if (await pathExists(candidate)) return candidate;
  }
  return "python3";
}

async function runPython(args: string[]) {
  const pythonBin = await pickPythonBin();
  const env = { ...process.env };
  if (await pathExists(LOCAL_VENDOR_PATH)) {
    env.PYTHONPATH = env.PYTHONPATH
      ? `${LOCAL_VENDOR_PATH}${path.delimiter}${env.PYTHONPATH}`
      : LOCAL_VENDOR_PATH;
  }

  const { stdout, stderr } = await execFileAsync(pythonBin, [SCRIPT_PATH, ...args], {
    env,
    timeout: 30_000,
    maxBuffer: 1024 * 1024 * 4,
  });

  const trimmedStdout = stdout.trim();
  if (!trimmedStdout) {
    throw new Error(stderr.trim() || "Python provider returned no output");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmedStdout) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Python provider returned invalid JSON: ${err instanceof Error ? err.message : "unknown parse error"}`,
    );
  }

  if (typeof parsed.error === "string" && parsed.error.trim()) {
    throw new Error(parsed.error);
  }

  return parsed;
}

export async function lookupInstrumentNameWithPython(
  backend: PythonBackend,
  symbol: string,
  market: Market,
  providerSymbol?: string,
) {
  const parsed = await runPython([
    "--backend",
    backend,
    "--mode",
    "name",
    "--symbol",
    symbol,
    "--market",
    market,
    "--date",
    new Date().toISOString().slice(0, 10),
    ...(providerSymbol ? ["--provider-symbol", providerSymbol] : []),
  ]);

  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  return name || null;
}

export class PythonMarketDataProvider implements MarketDataProvider {
  constructor(private readonly backend: PythonBackend) {}

  async getDailyClose(
    symbol: string,
    market: Market,
    date: string,
    providerSymbol?: string,
  ) {
    const point = await this.getDailyClosePoint(symbol, market, date, providerSymbol);
    return point?.close ?? null;
  }

  async getDailyClosePoint(
    symbol: string,
    market: Market,
    date: string,
    providerSymbol?: string,
  ): Promise<DailyClosePoint | null> {
    const parsed = await runPython([
      "--backend",
      this.backend,
      "--mode",
      "close",
      "--symbol",
      symbol,
      "--market",
      market,
      "--date",
      date,
      ...(providerSymbol ? ["--provider-symbol", providerSymbol] : []),
    ]);

    if (typeof parsed.date !== "string") return null;
    const close = Number(parsed.close);
    if (!Number.isFinite(close)) return null;
    return { date: parsed.date, close };
  }

  async getFxRate(pair: string, date: string) {
    if (pair !== "USDKRW") return null;
    const parsed = await runPython([
      "--backend",
      this.backend,
      "--mode",
      "fx",
      "--date",
      date,
    ]);
    const rate = Number(parsed.rate);
    return Number.isFinite(rate) ? rate : null;
  }
}
