import json
from datetime import datetime
from pathlib import Path


PORTFOLIO_FILE = "portfolio_state.json"


def load_portfolio() -> dict:
    if Path(PORTFOLIO_FILE).exists():
        with open(PORTFOLIO_FILE) as f:
            return json.load(f)
    return {
        "cash": 1000.0,
        "holdings": {},  # {ticker: {"shares": float, "avg_cost": float}}
        "trades": [],
        "start_value": 1000.0,
        "started_at": datetime.now().isoformat(),
    }


def save_portfolio(portfolio: dict) -> None:
    with open(PORTFOLIO_FILE, "w") as f:
        json.dump(portfolio, f, indent=2)


def get_total_value(portfolio: dict, prices: dict[str, float]) -> float:
    total = portfolio["cash"]
    for ticker, pos in portfolio["holdings"].items():
        price = prices.get(ticker, 0)
        total += pos["shares"] * price
    return total


def apply_trade(portfolio: dict, action: str, ticker: str, shares: float, price: float) -> str:
    cost = shares * price
    if action == "BUY":
        if cost > portfolio["cash"]:
            return f"REJECTED: insufficient cash (need ${cost:.2f}, have ${portfolio['cash']:.2f})"
        portfolio["cash"] -= cost
        if ticker in portfolio["holdings"]:
            existing = portfolio["holdings"][ticker]
            total_shares = existing["shares"] + shares
            avg_cost = (existing["shares"] * existing["avg_cost"] + cost) / total_shares
            portfolio["holdings"][ticker] = {"shares": total_shares, "avg_cost": avg_cost}
        else:
            portfolio["holdings"][ticker] = {"shares": shares, "avg_cost": price}

    elif action == "SELL":
        if ticker not in portfolio["holdings"]:
            return f"REJECTED: no position in {ticker}"
        held = portfolio["holdings"][ticker]["shares"]
        if shares > held:
            shares = held  # sell all
        portfolio["cash"] += shares * price
        remaining = portfolio["holdings"][ticker]["shares"] - shares
        if remaining < 0.0001:
            del portfolio["holdings"][ticker]
        else:
            portfolio["holdings"][ticker]["shares"] = remaining

    trade = {
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "ticker": ticker,
        "shares": shares,
        "price": price,
        "value": shares * price,
    }
    portfolio["trades"].append(trade)
    return f"OK: {action} {shares:.4f} {ticker} @ ${price:.2f} = ${cost:.2f}"
