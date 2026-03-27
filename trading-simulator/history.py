#!/usr/bin/env python3
"""Show full trade history and performance summary."""

import json
from pathlib import Path
from tabulate import tabulate
from datetime import datetime

import market_data as md
import portfolio as pf


def main():
    if not Path("portfolio_state.json").exists():
        print("No portfolio found. Run main.py first.")
        return

    port = pf.load_portfolio()
    summary = md.fetch_prices()
    total = pf.get_total_value(port, summary)
    pnl = total - port["start_value"]
    pnl_pct = pnl / port["start_value"] * 100

    started = port.get("started_at", "unknown")[:10]
    days = (datetime.now() - datetime.fromisoformat(port["started_at"])).days if "started_at" in port else "?"

    print("\n" + "=" * 60)
    print("  CLAUDE TRADING SIMULATOR — PERFORMANCE REPORT")
    print("=" * 60)
    print(f"  Started       : {started}  ({days} days ago)")
    print(f"  Start capital : ${port['start_value']:.2f}")
    print(f"  Current value : ${total:.2f}")
    print(f"  P&L           : ${pnl:+.2f}  ({pnl_pct:+.2f}%)")
    print(f"  Total trades  : {len(port['trades'])}")
    print(f"  Cash held     : ${port['cash']:.2f}")

    if port["trades"]:
        print("\n  Full Trade History:")
        rows = [
            [
                t["timestamp"][:16],
                t["action"],
                t["ticker"],
                f"{t['shares']:.4f}",
                f"${t['price']:.2f}",
                f"${t['value']:.2f}",
            ]
            for t in port["trades"]
        ]
        print(tabulate(rows, headers=["Time", "Action", "Ticker", "Shares", "Price", "Value"],
                       tablefmt="simple"))

    print()


if __name__ == "__main__":
    main()
