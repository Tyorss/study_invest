import type { ProviderHandle } from "@/lib/providers";
import type { DailyClosePoint } from "@/lib/providers/types";
import type { Market } from "@/types/db";

export interface ProviderAttemptLog {
  provider: string;
  status: "success" | "error" | "unavailable";
  reason?: string;
}

export async function fetchBestClosePointFromProviderChain(
  handles: ProviderHandle[],
  input: {
    symbol: string;
    market: Market;
    date: string;
    providerSymbol?: string;
  },
): Promise<{
  point: DailyClosePoint | null;
  usedProvider: string | null;
  attempts: ProviderAttemptLog[];
  finalReason: string | null;
}> {
  const attempts: ProviderAttemptLog[] = [];
  let bestPoint: DailyClosePoint | null = null;
  let bestProvider: string | null = null;

  for (const handle of handles) {
    const providerName = handle.requestedProvider;
    if (!handle.provider) {
      attempts.push({
        provider: providerName,
        status: "unavailable",
        reason: handle.initError ?? "Provider is unavailable",
      });
      continue;
    }

    try {
      const point =
        typeof handle.provider.getDailyClosePoint === "function"
          ? await handle.provider.getDailyClosePoint(
              input.symbol,
              input.market,
              input.date,
              input.providerSymbol,
            )
          : null;

      if (point !== null && Number.isFinite(point.close)) {
        attempts.push({
          provider: providerName,
          status: "success",
          reason: point.date,
        });
        if (point.date === input.date) {
          return {
            point,
            usedProvider: providerName,
            attempts,
            finalReason: null,
          };
        }
        if (bestPoint === null || point.date > bestPoint.date) {
          bestPoint = point;
          bestProvider = providerName;
        }
        continue;
      }

      const close = await handle.provider.getDailyClose(
        input.symbol,
        input.market,
        input.date,
        input.providerSymbol,
      );
      if (close !== null && Number.isFinite(close)) {
        const directPoint: DailyClosePoint = {
          date: input.date,
          close,
        };
        attempts.push({
          provider: providerName,
          status: "success",
          reason: input.date,
        });
        return {
          point: directPoint,
          usedProvider: providerName,
          attempts,
          finalReason: null,
        };
      }

      attempts.push({
        provider: providerName,
        status: "error",
        reason: "No close price returned",
      });
    } catch (err) {
      attempts.push({
        provider: providerName,
        status: "error",
        reason: err instanceof Error ? err.message : "Unknown provider error",
      });
    }
  }

  if (bestPoint !== null) {
    return {
      point: bestPoint,
      usedProvider: bestProvider,
      attempts,
      finalReason: null,
    };
  }

  let last: string | null = null;
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const reason = attempts[i]?.reason;
    if (reason) {
      last = reason;
      break;
    }
  }

  return {
    point: null,
    usedProvider: null,
    attempts,
    finalReason: last,
  };
}

export function isExactPricePoint(
  point: { date?: string | null; source?: string | null } | null | undefined,
  targetDate: string,
) {
  return Boolean(point && point.date === targetDate && point.source !== "carry_forward");
}

type ComparableClosePoint = {
  date: string;
  close: number;
  source?: string | null;
};

function pointPriority(
  point: ComparableClosePoint,
  targetDate: string,
) {
  if (point.date === targetDate) {
    return point.source === "carry_forward" ? 2 : 3;
  }
  return 1;
}

export function pickPreferredClosePoint<T extends ComparableClosePoint>(
  targetDate: string,
  left: T | null,
  right: T | null,
): T | null {
  if (!left) return right;
  if (!right) return left;

  const leftPriority = pointPriority(left, targetDate);
  const rightPriority = pointPriority(right, targetDate);
  if (leftPriority !== rightPriority) {
    return leftPriority > rightPriority ? left : right;
  }

  if (left.date !== right.date) {
    return left.date > right.date ? left : right;
  }

  const leftCarry = left.source === "carry_forward";
  const rightCarry = right.source === "carry_forward";
  if (leftCarry !== rightCarry) {
    return leftCarry ? right : left;
  }

  return right;
}
