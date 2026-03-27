"""
Simulated market data engine.
Uses correlated random walks with realistic starting prices (March 2026),
sector correlations, and configurable volatility.
"""

import json
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

MARKET_STATE_FILE = "market_state.json"

# Starting prices (approximate March 2026 realistic levels)
UNIVERSE = {
    "AAPL":  {"name": "Apple Inc",              "price": 228.0,  "sector": "tech",     "vol": 0.018},
    "MSFT":  {"name": "Microsoft Corp",          "price": 415.0,  "sector": "tech",     "vol": 0.016},
    "NVDA":  {"name": "NVIDIA Corp",             "price": 118.0,  "sector": "tech",     "vol": 0.030},
    "GOOGL": {"name": "Alphabet Inc",            "price": 172.0,  "sector": "tech",     "vol": 0.017},
    "AMZN":  {"name": "Amazon.com Inc",          "price": 210.0,  "sector": "tech",     "vol": 0.019},
    "META":  {"name": "Meta Platforms",          "price": 590.0,  "sector": "tech",     "vol": 0.022},
    "TSLA":  {"name": "Tesla Inc",               "price": 265.0,  "sector": "tech",     "vol": 0.038},
    "JPM":   {"name": "JPMorgan Chase",          "price": 238.0,  "sector": "finance",  "vol": 0.014},
    "BRK-B": {"name": "Berkshire Hathaway",      "price": 485.0,  "sector": "finance",  "vol": 0.011},
    "SPY":   {"name": "S&P 500 ETF",             "price": 558.0,  "sector": "market",   "vol": 0.010},
    "QQQ":   {"name": "Nasdaq 100 ETF",          "price": 473.0,  "sector": "market",   "vol": 0.013},
    "EFA":   {"name": "Developed Markets ETF",   "price": 82.0,   "sector": "global",   "vol": 0.011},
    "EEM":   {"name": "Emerging Markets ETF",    "price": 44.0,   "sector": "global",   "vol": 0.015},
    "VEU":   {"name": "All-World ex-US ETF",     "price": 63.0,   "sector": "global",   "vol": 0.012},
    "FXI":   {"name": "China Large-Cap ETF",     "price": 31.0,   "sector": "global",   "vol": 0.020},
    "EWJ":   {"name": "Japan ETF",               "price": 71.0,   "sector": "global",   "vol": 0.013},
    "EWG":   {"name": "Germany ETF",             "price": 38.0,   "sector": "global",   "vol": 0.014},
    "EWU":   {"name": "UK ETF",                  "price": 37.0,   "sector": "global",   "vol": 0.012},
    "GLD":   {"name": "Gold ETF",                "price": 247.0,  "sector": "macro",    "vol": 0.009},
    "TLT":   {"name": "20Y Treasury ETF",        "price": 92.0,   "sector": "macro",    "vol": 0.012},
    "XLE":   {"name": "Energy Sector ETF",       "price": 89.0,   "sector": "energy",   "vol": 0.016},
    "XLF":   {"name": "Financial Sector ETF",    "price": 48.0,   "sector": "finance",  "vol": 0.013},
    "XLK":   {"name": "Tech Sector ETF",         "price": 215.0,  "sector": "tech",     "vol": 0.014},
}

# Sector correlations: what fraction of move comes from sector vs idiosyncratic
SECTOR_WEIGHTS = {
    "tech": 0.55, "finance": 0.45, "global": 0.40,
    "macro": 0.20, "energy": 0.35, "market": 0.70,
}

# Market regime drift (slight positive long-run drift, realistic)
MARKET_DRIFT = 0.0003  # ~7.5% annual


def _load_market_state() -> dict:
    if Path(MARKET_STATE_FILE).exists():
        with open(MARKET_STATE_FILE) as f:
            return json.load(f)
    # Initialise with 30-day seeded history so day-1 movers are meaningful
    seed_prices = {t: info["price"] for t, info in UNIVERSE.items()}
    history = {t: [] for t in UNIVERSE}
    prices_tmp = {t: p for t, p in seed_prices.items()}
    for _ in range(30):
        for ticker, info in UNIVERSE.items():
            move = random.gauss(MARKET_DRIFT, info["vol"])
            prices_tmp[ticker] = round(prices_tmp[ticker] / math.exp(move), 2)
    for _ in range(30):
        for ticker, info in UNIVERSE.items():
            move = random.gauss(MARKET_DRIFT, info["vol"])
            prices_tmp[ticker] = round(prices_tmp[ticker] * math.exp(move), 2)
            history[ticker].append(prices_tmp[ticker])
    state = {
        "day": 0,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "prices": seed_prices,
        "history": {t: history[t] + [seed_prices[t]] for t in UNIVERSE},
        "regime": "normal",
        "regime_days_left": random.randint(5, 20),
    }
    _save_market_state(state)
    return state


def _save_market_state(state: dict) -> None:
    with open(MARKET_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def _gauss() -> float:
    return random.gauss(0, 1)


def advance_market_day(state: dict) -> dict:
    """Simulate one trading day and update prices."""
    regime = state.get("regime", "normal")

    regime_params = {
        "normal":   {"drift": MARKET_DRIFT,      "market_vol": 0.008, "sector_vol": 0.006},
        "bull":     {"drift": MARKET_DRIFT * 3,  "market_vol": 0.006, "sector_vol": 0.005},
        "bear":     {"drift": -MARKET_DRIFT * 2, "market_vol": 0.015, "sector_vol": 0.012},
        "volatile": {"drift": 0,                  "market_vol": 0.020, "sector_vol": 0.018},
    }
    p = regime_params.get(regime, regime_params["normal"])

    market_shock = _gauss() * p["market_vol"] + p["drift"]

    sectors = set(info["sector"] for info in UNIVERSE.values())
    sector_shocks = {s: _gauss() * p["sector_vol"] for s in sectors}

    new_prices = {}
    for ticker, info in UNIVERSE.items():
        sector = info["sector"]
        vol = info["vol"]
        sw = SECTOR_WEIGHTS.get(sector, 0.4)
        idio = _gauss() * vol * (1 - sw)
        move = (sw * market_shock) + ((1 - sw) * sector_shocks[sector] * 0.5) + idio
        old_price = state["prices"][ticker]
        new_price = round(old_price * math.exp(move), 2)
        new_prices[ticker] = max(new_price, 0.01)
        state["history"][ticker].append(new_price)
        if len(state["history"][ticker]) > 60:
            state["history"][ticker] = state["history"][ticker][-60:]

    state["prices"] = new_prices
    state["day"] += 1

    dt = datetime.strptime(state["date"], "%Y-%m-%d") + timedelta(days=1)
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    state["date"] = dt.strftime("%Y-%m-%d")

    state["regime_days_left"] -= 1
    if state["regime_days_left"] <= 0:
        state["regime"] = random.choices(
            ["normal", "bull", "bear", "volatile"],
            weights=[50, 25, 15, 10]
        )[0]
        state["regime_days_left"] = random.randint(5, 25)

    return state


def fetch_prices(tickers: list[str] = None) -> dict[str, float]:
    state = _load_market_state()
    if tickers is None:
        tickers = list(UNIVERSE.keys())
    return {t: state["prices"][t] for t in tickers if t in state["prices"]}


def fetch_market_summary(tickers: list[str] = None, advance_day: bool = True) -> list[dict]:
    """Fetch market summary, optionally advancing one simulated trading day."""
    state = _load_market_state()

    if advance_day and state["day"] > 0:
        state = advance_market_day(state)
    elif state["day"] == 0:
        state["day"] = 1

    _save_market_state(state)

    if tickers is None:
        tickers = list(UNIVERSE.keys())

    summary = []
    for ticker in tickers:
        if ticker not in state["prices"]:
            continue
        history = state["history"].get(ticker, [state["prices"][ticker]])
        current = state["prices"][ticker]
        week_ago = history[-6] if len(history) >= 6 else history[0]
        month_ago = history[-22] if len(history) >= 22 else history[0]
        summary.append({
            "ticker": ticker,
            "name": UNIVERSE[ticker]["name"],
            "price": current,
            "1w_pct": round((current - week_ago) / week_ago * 100, 2),
            "1m_pct": round((current - month_ago) / month_ago * 100, 2),
            "regime": state["regime"],
            "sim_day": state["day"],
            "sim_date": state["date"],
        })

    return summary


def get_market_state() -> dict:
    return _load_market_state()
