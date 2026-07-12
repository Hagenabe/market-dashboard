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

import numpy as np
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
OUT_LATEST       = BASE_DIR / "public" / "data" / "market_latest.json"
OUT_HISTORY      = BASE_DIR / "public" / "data" / "history"
OUT_PORTFOLIO    = BASE_DIR / "public" / "data" / "portfolio_latest.json"
OUT_SECTOR       = BASE_DIR / "public" / "data" / "sector_latest.json"
OUT_CORRELATIONS = BASE_DIR / "public" / "data" / "correlations.json"
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

# ── 保有銘柄 ──────────────────────────────────────────────────────────────────

PORTFOLIO_STOCKS = [
    dict(id="inpex",    name="INPEX",              name_ja="INPEX",              ticker="1605.T", sector="エネルギー",
         macro_pairs=["wti", "brent"],
         description="原油・天然ガス開発。WTI/ブレント原油と強く連動する傾向。"),
    dict(id="nintendo", name="Nintendo",            name_ja="任天堂",             ticker="7974.T", sector="ゲーム・娯楽",
         macro_pairs=["usdjpy", "nasdaq100"],
         description="海外売上比率が高くドル円の影響を受けやすい。NASDAQ100との連動も参考に。"),
    dict(id="shift",    name="SHIFT",               name_ja="SHIFT",              ticker="3697.T", sector="IT・ソフトウェア",
         macro_pairs=["us10y", "nasdaq100"],
         description="グロース株。米長期金利上昇局面でバリュエーション圧縮リスクあり。"),
    dict(id="nsc",      name="Nippon Steel",        name_ja="日本製鉄",           ticker="5401.T", sector="素材・鉄鋼",
         macro_pairs=["wti", "usdjpy"],
         description="素材・景気敏感株。中国需要・原材料費・ドル円が業績に影響。"),
    dict(id="mitsui",   name="Mitsui & Co.",        name_ja="三井物産",           ticker="8031.T", sector="商社",
         macro_pairs=["wti", "gold"],
         description="総合商社。コモディティ全般（資源・エネルギー・金属）と連動。"),
    dict(id="gmo_pg",   name="GMO Payment Gateway", name_ja="GMOペイメントGW",    ticker="3769.T", sector="フィンテック",
         macro_pairs=["us10y", "nasdaq100"],
         description="グロース・フィンテック株。金利敏感。NASDAQ100との連動を確認。"),
    dict(id="sanix",    name="Sanix HD",            name_ja="サニックスHD",       ticker="4651.T", sector="環境・エネルギー",
         macro_pairs=["natgas", "wti"],
         description="太陽光・環境事業。エネルギー価格と再エネ普及速度が業績に影響。"),
]

# ── 業種代表株（買い時判断用） ─────────────────────────────────────────────────

SECTOR_STOCKS = [
    dict(id="sec_energy",   name="エネルギー",     ticker="1605.T",  sector_ja="エネルギー",    topix_beta=1.2),
    dict(id="sec_material", name="素材・鉄鋼",     ticker="5401.T",  sector_ja="素材・鉄鋼",    topix_beta=1.3),
    dict(id="sec_auto",     name="輸送機器",        ticker="7203.T",  sector_ja="自動車",        topix_beta=1.1),
    dict(id="sec_elec",     name="電気機器",        ticker="6758.T",  sector_ja="電気機器",      topix_beta=1.2),
    dict(id="sec_finance",  name="銀行・金融",      ticker="8306.T",  sector_ja="金融",          topix_beta=1.0),
    dict(id="sec_trading",  name="商社",            ticker="8058.T",  sector_ja="商社",          topix_beta=1.1),
    dict(id="sec_pharma",   name="医薬品",          ticker="4502.T",  sector_ja="医薬品",        topix_beta=0.7),
    dict(id="sec_realestate",name="不動産",         ticker="8801.T",  sector_ja="不動産",        topix_beta=0.9),
    dict(id="sec_retail",   name="小売・消費",      ticker="3382.T",  sector_ja="小売",          topix_beta=0.8),
    dict(id="sec_it",       name="情報・通信",      ticker="9984.T",  sector_ja="IT・通信",      topix_beta=1.3),
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
    cutoff = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=n)
    # seriesのインデックスがタイムゾーン付きの場合は合わせる
    if series.index.tz is not None:
        cutoff = cutoff.tz_convert(series.index.tz)
    else:
        cutoff = cutoff.tz_localize(None)
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

    # 既存データを読み込んでフォールバック用に保持
    existing_by_id: dict[str, dict] = {}
    if OUT_LATEST.exists():
        try:
            existing = json.loads(OUT_LATEST.read_text())
            existing_by_id = {ind["id"]: ind for ind in existing.get("indicators", [])}
            print(f"[Existing] {len(existing_by_id)} indicators loaded as fallback\n")
        except Exception:
            pass

    fresh: dict[str, dict] = {}

    print("[Yahoo Finance]")
    for defn in YAHOO_INDICATORS:
        result = fetch_yahoo(defn)
        if result:
            fresh[result["id"]] = result

    print("\n[FRED]")
    fred_results = fetch_fred_all(FRED_INDICATORS)
    for r in fred_results:
        if r:
            fresh[r["id"]] = r

    # 取得できなかった指標は既存データで補完
    all_ids = [d["id"] for d in YAHOO_INDICATORS] + [d["id"] for d in FRED_INDICATORS]
    indicators: list[dict] = []
    for ind_id in all_ids:
        if ind_id in fresh:
            indicators.append(fresh[ind_id])
        elif ind_id in existing_by_id:
            print(f"  ⚠ {ind_id}: fetch failed — using existing data")
            indicators.append(existing_by_id[ind_id])

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
            "change_pct": round(spread - prev_spread, 4),
            "week_pct": 0.0,
            "month_pct": 0.0,
            "history": [],
            "description": "逆イールド（マイナス）は景気後退の先行指標として知られる。",
        })

    if not indicators:
        print("\nNo data fetched at all. Check your network or API keys.")
        sys.exit(1)

    # Strip _full_history before writing market_latest.json
    out_inds = []
    for ind in indicators:
        full = ind.pop("_full_history", None)
        out_inds.append(ind)
        if full:
            hist_path = OUT_HISTORY / f"{ind['id']}.json"
            hist_path.write_text(json.dumps({"id": ind["id"], "history": full}, ensure_ascii=False, indent=2))

    fresh_count = len([i for i in out_inds if i["id"] in fresh])
    fallback_count = len(out_inds) - fresh_count

    payload = {
        "updated_at": datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "indicators": out_inds,
    }

    OUT_LATEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"\n✓ {OUT_LATEST}")
    print(f"  fresh: {fresh_count}  fallback: {fallback_count}  total: {len(out_inds)}")

    # ── 保有株 ────────────────────────────────────────────────────────────────
    print("\n[Portfolio Stocks]")
    portfolio_inds = []
    portfolio_history: dict[str, pd.Series] = {}
    for defn in PORTFOLIO_STOCKS:
        result = fetch_yahoo({**defn, "category": "portfolio"})
        if result:
            full = result.pop("_full_history", None)
            portfolio_inds.append(result)
            if full:
                closes = pd.Series(
                    [p["close"] for p in full],
                    index=pd.to_datetime([p["date"] for p in full])
                )
                portfolio_history[defn["id"]] = closes
                hist_path = OUT_HISTORY / f"{defn['id']}.json"
                hist_path.write_text(json.dumps({"id": defn["id"], "history": full}, ensure_ascii=False, indent=2))

    portfolio_payload = {
        "updated_at": datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "stocks": portfolio_inds,
    }
    OUT_PORTFOLIO.write_text(json.dumps(portfolio_payload, ensure_ascii=False, indent=2))
    print(f"✓ {OUT_PORTFOLIO}  ({len(portfolio_inds)} stocks)")

    # ── 業種代表株 ────────────────────────────────────────────────────────────
    print("\n[Sector Stocks]")
    sector_inds = []
    sector_history: dict[str, pd.Series] = {}
    topix_series: pd.Series | None = None
    for defn in SECTOR_STOCKS:
        result = fetch_yahoo({**defn, "name_ja": defn["name"], "category": "sector",
                              "id": defn["id"], "name": defn["name"]})
        if result:
            full = result.pop("_full_history", None)
            sector_inds.append({**result, "sector_ja": defn["sector_ja"]})
            if full:
                closes = pd.Series(
                    [p["close"] for p in full],
                    index=pd.to_datetime([p["date"] for p in full])
                )
                sector_history[defn["id"]] = closes
                if defn["id"] == "sec_auto":  # TOPIXの代わりにトヨタで正規化テスト
                    pass

    # TOPIXをベンチマークとして取得（既取得のものを流用）
    topix_ind = next((i for i in indicators if i["id"] == "topix"), None)
    if topix_ind:
        topix_hist_path = OUT_HISTORY / "topix.json"
        if topix_hist_path.exists():
            topix_data = json.loads(topix_hist_path.read_text())
            topix_series = pd.Series(
                [p["close"] for p in topix_data["history"]],
                index=pd.to_datetime([p["date"] for p in topix_data["history"]])
            )

    # 各業種の対TOPIX相対パフォーマンスを計算
    for s in sector_inds:
        sid = s["id"]
        if sid in sector_history and topix_series is not None:
            sc = sector_history[sid]
            tp = topix_series
            aligned = pd.DataFrame({"sector": sc, "topix": tp}).dropna()
            if len(aligned) >= 20:
                month_ago = aligned.index[-1] - pd.Timedelta(days=30)
                year_ago  = aligned.index[-1] - pd.Timedelta(days=365)
                for label, cutoff in [("relative_1m", month_ago), ("relative_1y", year_ago)]:
                    sub = aligned[aligned.index >= cutoff]
                    if len(sub) >= 2:
                        sec_ret = (sub["sector"].iloc[-1] / sub["sector"].iloc[0] - 1) * 100
                        top_ret = (sub["topix"].iloc[-1]  / sub["topix"].iloc[0]  - 1) * 100
                        s[label] = round(sec_ret - top_ret, 2)

    sector_payload = {
        "updated_at": datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "sectors": sector_inds,
    }
    OUT_SECTOR.write_text(json.dumps(sector_payload, ensure_ascii=False, indent=2))
    print(f"✓ {OUT_SECTOR}  ({len(sector_inds)} sectors)")

    # ── 相関行列 ──────────────────────────────────────────────────────────────
    print("\n[Correlation Matrix]")
    macro_ids = ["wti", "us10y", "usdjpy", "gold", "nikkei", "nasdaq100"]
    macro_series: dict[str, pd.Series] = {}

    for mid in macro_ids:
        hist_path = OUT_HISTORY / f"{mid}.json"
        if hist_path.exists():
            data = json.loads(hist_path.read_text())
            macro_series[mid] = pd.Series(
                [p["close"] for p in data["history"]],
                index=pd.to_datetime([p["date"] for p in data["history"]])
            )

    corr_matrix: dict[str, dict[str, float | None]] = {}
    for pid, pseries in portfolio_history.items():
        corr_matrix[pid] = {}
        for mid, mseries in macro_series.items():
            aligned = pd.DataFrame({"p": pseries, "m": mseries}).dropna()
            if len(aligned) >= 60:
                # 日次リターンで相関を計算（水準ではなく変化率）
                p_ret = aligned["p"].pct_change().dropna()
                m_ret = aligned["m"].pct_change().dropna()
                corr = p_ret.corr(m_ret)
                corr_matrix[pid][mid] = round(float(corr), 3) if not np.isnan(corr) else None
            else:
                corr_matrix[pid][mid] = None

    corr_payload = {
        "updated_at": datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "portfolio_ids": list(portfolio_history.keys()),
        "macro_ids": macro_ids,
        "matrix": corr_matrix,
    }
    OUT_CORRELATIONS.write_text(json.dumps(corr_payload, ensure_ascii=False, indent=2))
    print(f"✓ {OUT_CORRELATIONS}")

if __name__ == "__main__":
    main()
