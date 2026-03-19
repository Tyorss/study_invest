#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime, timedelta


def add_local_package_path() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    vendor = os.path.join(root, ".python_packages")
    if os.path.isdir(vendor) and vendor not in sys.path:
        sys.path.insert(0, vendor)


add_local_package_path()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", required=True, choices=["yfinance", "fdr"])
    parser.add_argument("--mode", required=True, choices=["close", "fx"])
    parser.add_argument("--symbol")
    parser.add_argument("--market")
    parser.add_argument("--date", required=True)
    parser.add_argument("--provider-symbol", dest="provider_symbol")
    return parser.parse_args()


def target_date(date_str: str):
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def load_yfinance():
    try:
        import yfinance as yf  # type: ignore

        return yf
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"yfinance import failed: {exc}") from exc


def load_fdr():
    try:
        import FinanceDataReader as fdr  # type: ignore

        return fdr
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"FinanceDataReader import failed: {exc}") from exc


def normalize_provider_symbol(value: str | None):
    raw = (value or "").strip()
    if not raw:
        return ""
    if ":" in raw:
        raw = raw.split(":", 1)[0]
    return raw.strip()


def unique(values):
    seen = set()
    out = []
    for value in values:
        normalized = (value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out


def yfinance_candidates(symbol: str, market: str, provider_symbol: str):
    raw = symbol.strip()
    upper = raw.upper()
    if market == "KR":
        base = normalize_provider_symbol(provider_symbol) or raw
        return unique(
            [
                f"{base}.KS",
                f"{base}.KQ",
                f"{raw}.KS",
                f"{raw}.KQ",
                raw,
            ]
        )
    if market == "INDEX":
        if upper in ("KS11", "KOSPI"):
            return ["^KS11", "KS11"]
    return unique([upper, raw])


def fdr_candidates(symbol: str, market: str, provider_symbol: str):
    raw = symbol.strip()
    upper = raw.upper()
    normalized_provider = normalize_provider_symbol(provider_symbol)
    if market == "KR":
        return unique([normalized_provider, raw])
    if market == "INDEX":
        if upper in ("KS11", "KOSPI"):
            return ["KS11"]
    return unique([normalized_provider, upper, raw])


def frame_last_close_on_or_before(df, date_str: str):
    if df is None or getattr(df, "empty", True):
        return None
    subset = df.copy()
    subset = subset.dropna(subset=["Close"])
    if subset.empty:
        return None
    index = subset.index
    if getattr(index, "tz", None) is not None:
        index = index.tz_convert("UTC").tz_localize(None)
    dates = index.to_series().dt.strftime("%Y-%m-%d")
    subset = subset.assign(_date=dates.values)
    subset = subset[subset["_date"] <= date_str]
    if subset.empty:
        return None
    row = subset.iloc[-1]
    return {"date": row["_date"], "close": float(row["Close"])}


def load_yfinance_close(symbol: str, market: str, date_str: str, provider_symbol: str):
    yf = load_yfinance()
    start = (target_date(date_str) - timedelta(days=240)).strftime("%Y-%m-%d")
    end = (target_date(date_str) + timedelta(days=3)).strftime("%Y-%m-%d")
    last_error = None
    for candidate in yfinance_candidates(symbol, market, provider_symbol):
        try:
            frame = yf.Ticker(candidate).history(
                start=start,
                end=end,
                interval="1d",
                auto_adjust=False,
                actions=False,
            )
            point = frame_last_close_on_or_before(frame, date_str)
            if point:
                return point
            last_error = f"no close on/before {date_str} for {candidate}"
        except Exception as exc:  # pragma: no cover
            last_error = str(exc)
    return {"error": f"[yfinance] {last_error or 'no data'}"}


def load_fdr_close(symbol: str, market: str, date_str: str, provider_symbol: str):
    fdr = load_fdr()
    start = (target_date(date_str) - timedelta(days=240)).strftime("%Y-%m-%d")
    end = (target_date(date_str) + timedelta(days=3)).strftime("%Y-%m-%d")
    last_error = None
    for candidate in fdr_candidates(symbol, market, provider_symbol):
        try:
            frame = fdr.DataReader(candidate, start, end)
            point = frame_last_close_on_or_before(frame, date_str)
            if point:
                return point
            last_error = f"no close on/before {date_str} for {candidate}"
        except Exception as exc:  # pragma: no cover
            last_error = str(exc)
    return {"error": f"[FinanceDataReader] {last_error or 'no data'}"}


def load_yfinance_fx(date_str: str):
    return load_yfinance_close("KRW=X", "US", date_str, "KRW=X")


def load_fdr_fx(date_str: str):
    fdr = load_fdr()
    start = (target_date(date_str) - timedelta(days=240)).strftime("%Y-%m-%d")
    end = (target_date(date_str) + timedelta(days=3)).strftime("%Y-%m-%d")
    try:
        frame = fdr.DataReader("USD/KRW", start, end)
        point = frame_last_close_on_or_before(frame, date_str)
        if point:
            return {"date": point["date"], "rate": point["close"]}
        return {"error": f"[FinanceDataReader] no USD/KRW close on/before {date_str}"}
    except Exception as exc:  # pragma: no cover
        return {"error": f"[FinanceDataReader] {exc}"}


def main():
    args = parse_args()
    if args.mode == "close":
        if not args.symbol or not args.market:
            print(json.dumps({"error": "symbol and market are required for close mode"}))
            return
        if args.backend == "yfinance":
            result = load_yfinance_close(args.symbol, args.market, args.date, args.provider_symbol or "")
        else:
            result = load_fdr_close(args.symbol, args.market, args.date, args.provider_symbol or "")
    else:
        if args.backend == "yfinance":
            result = load_yfinance_fx(args.date)
        else:
            result = load_fdr_fx(args.date)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
