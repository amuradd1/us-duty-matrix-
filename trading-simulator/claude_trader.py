import anthropic
import json
import re
from datetime import datetime


def build_prompt(portfolio: dict, market_summary: list[dict], total_value: float) -> str:
    pnl = total_value - portfolio["start_value"]
    pnl_pct = pnl / portfolio["start_value"] * 100

    holdings_text = ""
    if portfolio["holdings"]:
        for ticker, pos in portfolio["holdings"].items():
            holdings_text += f"  {ticker}: {pos['shares']:.4f} shares @ avg ${pos['avg_cost']:.2f}\n"
    else:
        holdings_text = "  (none — fully in cash)\n"

    market_text = ""
    for m in market_summary:
        market_text += (
            f"  {m['ticker']:6s} ({m['name']:<30s}) "
            f"${m['price']:>10.2f}  1W: {m['1w_pct']:>+6.2f}%  1M: {m['1m_pct']:>+6.2f}%\n"
        )

    recent_trades = portfolio["trades"][-5:] if portfolio["trades"] else []
    trades_text = ""
    for t in recent_trades:
        trades_text += f"  {t['timestamp'][:10]} {t['action']:4s} {t['shares']:.4f} {t['ticker']} @ ${t['price']:.2f}\n"
    if not trades_text:
        trades_text = "  (none yet)\n"

    return f"""You are Claude, an AI trading agent competing against ChatGPT in a trading simulator.
You started with $1,000 USD and your goal is to maximise total portfolio returns.
Today is {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}.

=== PORTFOLIO STATUS ===
Cash available : ${portfolio['cash']:.2f}
Total value    : ${total_value:.2f}
P&L            : ${pnl:+.2f} ({pnl_pct:+.2f}%)

Holdings:
{holdings_text}
Recent trades:
{trades_text}

=== MARKET DATA (30-day window) ===
{market_text}

=== YOUR TASK ===
Analyse the market data and your current portfolio, then decide on trades to execute.
You may BUY and/or SELL any instruments in the universe above.

Rules:
- You cannot spend more cash than you have
- Minimum trade size: $10
- You can hold cash - it is sometimes the best position
- Fractional shares are allowed
- Think about diversification, momentum, macro trends

Respond with ONLY a JSON object in this exact format (no markdown, no explanation outside JSON):
{{
  "reasoning": "your concise investment thesis in 2-3 sentences",
  "trades": [
    {{"action": "BUY", "ticker": "TICKER", "usd_amount": 100.0}},
    {{"action": "SELL", "ticker": "TICKER", "usd_amount": 50.0}}
  ]
}}

If you want to hold, return an empty trades list. usd_amount is the dollar value to trade.
"""


def get_claude_trades(portfolio: dict, market_summary: list[dict], total_value: float) -> dict:
    client = anthropic.Anthropic()
    prompt = build_prompt(portfolio, market_summary, total_value)

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        decision = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            decision = json.loads(match.group())
        else:
            decision = {"reasoning": "Parse error - holding", "trades": []}

    return decision
