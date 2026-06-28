#!/usr/bin/env python3
"""
Market data fetcher — yfinance + FRED
Output: public/data/market_latest.json + public/data/history/{id}.json

Usage:
  pip install -r scripts/requirements.txt
  python scripts/fetch_market_data.py

FRED API key (free): https://fred.stlouisfed.org/docs/api/api_key.html
Set in .env as FRED_API_KEY=xxxxxxxx
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
OUT_LATEST  = BASE_DIR / "public" / "data" / "market_latest.json"
OUT_HISTORY = BASE_DIR / "public" / "data" / "history"
OUT_HISTORY.mkdir(parents=True, exist_ok=True)

JST = timezone(timedelta(hours=9))

# ── Indicator definitions ─────────────────────────────────────────────────────

YAHOO_INDICATORS = [
    # Equity
    dict(id="sp500",    name="S&P 500",       name_ja="S&P 500",       category="equity",    ticker="^GSPC"),
    dict(id="nasdaq100",name="NASDAQ 100",     name_ja="NASDAQ 100",    category="equity",    ticker="^NDX"),
    dict(id="acwi",     name="ACWI ETF",       name_ja="全世界株(ACWI)", category="equity",    ticker="ACWI",
         description="MSCI ACWI ETF (iShares)。オルカンの背後にあるインデックスの代理指標。"),
    dict(id="topix",    name="TOPIX",          name_ja="TOPIX",         category="equity",    ticker="^TPX",
         description="東証プライム全銘柄。日経平均より広範な日本株指標。"),
    dict(id="nikkei",   name="Nikkei 225",     name_ja="日経平均",       category="equity",    ticker="^N225"),
    # FX
    dict(id="usdjpy",   name="USD/JPY",        name_ja="ドル円",         category="fx",        ticker="USDJPY=X", unit="USD/JPY"),
    dict(id="eurusd",   name="EUR/USD",        name_ja="ユーロドル",     category="fx",        ticker="EURUSD=X", unit="EUR/USD"),
    # Commodity
    dict(id="gold",     name="Gold",           name_ja="金",            category="commodity", ticker="GC=F",
         description="金先物(USD/oz)。ドル安・地政学リスク・インフレヘッジとして機能。"),
    dict(id="platinum", name="Platinum",       name_ja="プラチナ",       category="commodity", ticker="PL=F",
         description="白金先物(USD/oz)。自動車触媒需要が主。景気敏感で金との比率が参考になる。"),
    dict(id="wti",      name="WTI Crude",      name_ja="WTI原油",        category="commodity", ticker="CL=F", unit="USD/bbl"),
    dict(id="brent",    name="Brent Crude",    name_ja="ブレント原油",    category="commodity", ticker="BZ=F", unit="USD/bbl"),
    dict(id="natgas",   name="Natural Gas",    name_ja="天然ガス(Henry Hub)", category="energy", ticker="NG=F", unit="USD/MMBtu"),
    # Risk
    dict(id="vix",      name="VIX",            name_ja="VIX 恐怖指数",   category="risk",      ticker="^VIX",
         description="S&P500オプションの30日間予想変動率。20以上で警戒、30以上で高恐怖域。"),
]

FRED_INDICATORS = [
    dict(id="us10y", name="US 10Y Yield", name_ja="米10年国債利回り", category="rates",
         series="DGS10", unit="%",
         description="米国長期金利の基準。株式・為替・コモディティすべてに影響。"),
    dict(id="us2y",  name="US 2Y Yield",  name_ja="米2年国債利回り",  category="rates",
         series="DGS2",  unit="%",
         description="FRBの政策金利期待を最も反映する指標。"),
    dict(id="jp10y", name="JP 10Y Yield", name_ja="日10年国債利回り", category="rates",
         series="IRLTLT01JPM156N", unit="%",
         description="日銀のYCC政策と連動。日米金利差がドル円に直結。"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def to_history(series: pd.Series, max_rows: int = 800) -> list[dict]:
    """Convert a pandas Series (DatetimeIndex) to [{date, close}] list."""
    series = series.dropna().tail(max_rows)
    return [
        {"date": str(idx.date()), "close": round(float(val), 4)}
        for idx, val in series.items()
    ]

def calc_pct(current: float, past: float | None) -> float:
    if past is None or past == 0:
        return 0.0
    return round((current - past) / abs(past) * 100, 2)

def find_n_days_ago(series: pd.Series, n: int) -> float | None:
    """Return the close value approx n calendar days ago."""
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=n)
    past = series[series.index <= cutoff]
    if past.empty:
        return None
    return float(past.iloc[-1])

# ── Yahoo Finance ─────────────────────────────────────────────────────────────

def fetch_yahoo(defn: dict) -> dict | None:
    ticker = defn["ticker"]
    print(f"  Fetching {ticker} ... ", end="", flush=True)
    try:
        tk = yf.Ticker(ticker)
        hist = tk.history(period="3y", auto_adjust=True)
        if hist.empty:
            print("empty")
            return None
        closes = hist["Close"].dropna()
        current = float(closes.iloc[-1])
        prev    = float(closes.iloc[-2]) if len(closes) >= 2 else current
        change  = round(current - prev, 4)
        change_pct = calc_pct(current, prev)
        week_pct   = calc_pct(current, find_n_days_ago(closes, 7))
        month_pct  = calc_pct(current, find_n_days_ago(closes, 30))
        history_30 = to_history(closes, 30)
        full_hist  = to_history(closes, 800)

        print(f"{current:.2f} ({change_pct:+.2f}%)")
        return {
            **{k: v for k, v in defn.items() if k not in ("ticker",)},
            "value":       round(current, 4),
            "change":      change,
            "change_pct":  change_pct,
            "week_pct":    week_pct,
            "month_pct":   month_pct,
            "history":     history_30,
            "_full_history": full_hist,
        }
    except Exception as e:
        print(f"ERROR: {e}")
        return None

# ── FRED ─────────────────────────────────────────────────────────────────────

def fetch_fred_all(defns: list[dict]) -> list[dict | None]:
    fred_key = os.getenv("FRED_API_KEY")
    if not fred_key:
        print("  FRED_API_KEY not set — skipping rate indicators")
        return [None] * len(defns)
    try:
        from fredapi import Fred
        fred = Fred(api_key=fred_key)
    except ImportError:
        print("  fredapi not installed — skipping (pip install fredapi)")
        return [None] * len(defns)

    results = []
    for defn in defns:
        series_id = defn["series"]
        print(f"  FRED {series_id} ... ", end="", flush=True)
        try:
            s = fred.get_series(series_id, observation_start="2021-01-01")
            s = s.dropna()
            current    = float(s.iloc[-1])
            prev       = float(s.iloc[-2]) if len(s) >= 2 else current
            change     = round(current - prev, 4)
            change_pct = calc_pct(current, prev)
            week_pct   = calc_pct(current, find_n_days_ago(s, 7))
            month_pct  = calc_pct(current, find_n_days_ago(s, 30))
            history_30 = to_history(s, 30)
            full_hist  = to_history(s, 800)
            print(f"{current:.3f} ({change_pct:+.2f}%)")
            results.append({
                **{k: v for k, v in defn.items() if k not in ("series",)},
                "value":       round(current, 4),
                "change":      change,
                "change_pct":  change_pct,
                "week_pct":    week_pct,
                "month_pct":   month_pct,
                "history":     history_30,
                "_full_history": full_hist,
            })
        except Exception as e:
            print(f"ERROR: {e}")
            results.append(None)
    return results

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== Market Data Fetch ===")
    print(f"Time: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S JST')}\n")

    indicators: list[dict] = []

    print("[Yahoo Finance]")
    for defn in YAHOO_INDICATORS:
        result = fetch_yahoo(defn)
        if result:
            indicators.append(result)

    print("\n[FRED]")
    fred_results = fetch_fred_all(FRED_INDICATORS)
    for r in fred_results:
        if r:
            indicators.append(r)

    # Add computed spread (10Y - 2Y)
    us10y = next((i for i in indicators if i["id"] == "us10y"), None)
    us2y  = next((i for i in indicators if i["id"] == "us2y"), None)
    if us10y and us2y:
        spread = round(us10y["value"] - us2y["value"], 3)
        prev_spread = round((us10y["value"] - us10y["change"]) - (us2y["value"] - us2y["change"]), 3)
        indicators.append({
            "id": "spread_10_2",
            "name": "10Y-2Y Spread",
            "name_ja": "米10年-2年スプレッド",
            "category": "rates",
            "unit": "%",
            "value": spread,
            "change": round(spread - prev_spread, 4),
            "change_pct": round(spread - prev_spread, 4),  # bp change
            "week_pct": 0.0,
            "month_pct": 0.0,
            "history": [],
            "description": "逆イールド（マイナス）は景気後退の先行指標として知られる。",
        })

    if not indicators:
        print("\nNo data fetched. Check your network or API keys.")
        sys.exit(1)

    # Strip _full_history before writing market_latest.json
    out_inds = []
    for ind in indicators:
        full = ind.pop("_full_history", None)
        out_inds.append(ind)
        if full:
            hist_path = OUT_HISTORY / f"{ind['id']}.json"
            hist_path.write_text(json.dumps({"id": ind["id"], "history": full}, ensure_ascii=False, indent=2))

    payload = {
        "updated_at": datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "indicators": out_inds,
    }

    OUT_LATEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"\n✓ {OUT_LATEST}  ({len(out_inds)} indicators)")
    print(f"✓ history/ files updated")

if __name__ == "__main__":
    main()
