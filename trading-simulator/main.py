#!/usr/bin/env python3
"""
Claude LLM Trading Simulator
Starting capital: $1,000 USD | Goal: Beat ChatGPT
Each run = one simulated trading day
"""

import sys
from datetime import datetime
from tabulate import tabulate
from dotenv import load_dotenv

import portfolio as pf
import market_data as md
from claude_trader import get_claude_trades

load_dotenv()


def print_header(sim_day: int, sim_date: str, regime: str):
    print("\n" + "=" * 65)
    print("     CLAUDE LLM TRADING SIMULATOR  —  $1,000 START CAPITAL")
    print(f"     Sim Day {sim_day:>4d}  |  Date: {sim_date}  |  Regime: {regime.upper()}")
    print("=" * 65)


def print_portfolio(port: dict, prices: dict, total: float):
    pnl = total - port["start_value"]
    pnl_pct = pnl / port["start_value"] * 100
    print(f"\n{'─'*65}")
    print(f"  Cash      : ${port['cash']:>10.2f}")
    print(f"  Invested  : ${total - port['cash']:>10.2f}")
    print(f"  Total     : ${total:>10.2f}")
    print(f"  P&L       : ${pnl:>+10.2f}  ({pnl_pct:>+.2f}%)")
    print(f"  Trades    : {len(port['trades'])}")

    if port["holdings"]:
        rows = []
        for ticker, pos in port["holdings"].items():
            price = prices.get(ticker, 0)
            value = pos["shares"] * price
            cost = pos["shares"] * pos["avg_cost"]
            gain = value - cost
            rows.append([
                ticker,
                f"{pos['shares']:.4f}",
                f"${pos['avg_cost']:.2f}",
                f"${price:.2f}",
                f"${value:.2f}",
                f"${gain:+.2f}",
            ])
        print("\n  Holdings:")
        print(tabulate(rows, headers=["Ticker", "Shares", "Avg Cost", "Price", "Value", "Gain"],
                       tablefmt="simple", colalign=("left",) + ("right",) * 5))
    print(f"{'─'*65}")


def run_cycle():
    print(f"\n  Simulating trading day...")
    port = pf.load_portfolio()

    # Advance market by one day and fetch data
    summary = md.fetch_market_summary(advance_day=True)
    if not summary:
        print("  ERROR: Market data unavailable.")
        sys.exit(1)

    sim_day = summary[0]["sim_day"]
    sim_date = summary[0]["sim_date"]
    regime = summary[0]["regime"]
    prices = {m["ticker"]: m["price"] for m in summary}

    print_header(sim_day, sim_date, regime)

    total = pf.get_total_value(port, prices)
    print_portfolio(port, prices, total)

    # Show top movers
    movers = sorted(summary, key=lambda x: abs(x["1w_pct"]), reverse=True)[:6]
    print("\n  Top movers (1W):")
    mover_rows = [[m["ticker"], m["name"][:25], f"${m['price']:.2f}",
                   f"{m['1w_pct']:+.2f}%", f"{m['1m_pct']:+.2f}%"] for m in movers]
    print(tabulate(mover_rows, headers=["Ticker", "Name", "Price", "1W", "1M"],
                   tablefmt="simple"))

    print(f"\n  Consulting Claude...")
    decision = get_claude_trades(port, summary, total)

    print(f"\n  Claude's reasoning:")
    print(f"  > {decision.get('reasoning', 'No reasoning provided')}")

    trades = decision.get("trades", [])
    if not trades:
        print("\n  Claude decided to HOLD — no trades this cycle.")
    else:
        print(f"\n  Executing {len(trades)} trade(s):")
        for trade in trades:
            action = trade.get("action", "").upper()
            ticker = trade.get("ticker", "")
            usd = float(trade.get("usd_amount", 0))

            if ticker not in prices:
                print(f"  SKIP: {ticker} not in price data")
                continue
            if usd < 10:
                print(f"  SKIP: {action} {ticker} — ${usd:.2f} below $10 minimum")
                continue

            price = prices[ticker]
            shares = usd / price
            result = pf.apply_trade(port, action, ticker, shares, price)
            status = "OK" if result.startswith("OK") else "!!"
            print(f"  [{status}] {action:4s} {ticker:6s} ${usd:>8.2f}  ->  {result}")

    total_after = pf.get_total_value(port, prices)
    pf.save_portfolio(port)

    pnl = total_after - port["start_value"]
    print(f"\n  Day {sim_day} complete. Portfolio: ${total_after:.2f} (P&L: ${pnl:+.2f})\n")


if __name__ == "__main__":
    run_cycle()
