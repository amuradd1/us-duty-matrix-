const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// System prompt for Import DutyGPT
const SYSTEM_PROMPT = `You are Import DutyGPT, an expert assistant for US import duties. You help users understand duty rates from their dashboard data.

CRITICAL RULES:
1. The user provides ACTUAL DUTY DATA with each question. Always use this data for answers.
2. NEVER mention specific companies, brands, or manufacturers.
3. Data includes all tariffs (MFN + IEEPA reciprocal + Section 301 where applicable).

RESPONSE FORMAT:
You MUST respond with valid JSON in one of these formats:

For RANKED LISTS (top/bottom countries, comparisons):
{
  "type": "ranked_list",
  "title": "Top 5 Countries by Average Duty Rate",
  "items": [
    {"rank": 1, "country": "China", "iso": "CN", "value": 47.7, "label": "47.7%", "detail": "Section 301 + IEEPA"},
    {"rank": 2, "country": "Hong Kong", "iso": "HK", "value": 47.7, "label": "47.7%", "detail": "Same as China"}
  ],
  "summary": "Brief explanation if needed"
}

For SINGLE VALUE queries (what is the rate for X from Y):
{
  "type": "single_value",
  "title": "Filter Tow from Malaysia",
  "value": 26.5,
  "label": "26.5%",
  "breakdown": [
    {"name": "MFN Base", "value": 7.5},
    {"name": "IEEPA Reciprocal", "value": 19}
  ],
  "summary": "Trade Deal rate applied"
}

For COMPARISON queries:
{
  "type": "comparison",
  "title": "Malaysia vs Thailand - Filter Tow",
  "items": [
    {"country": "Malaysia", "iso": "MY", "value": 26.5, "label": "26.5%"},
    {"country": "Thailand", "iso": "TH", "value": 26.5, "label": "26.5%"}
  ],
  "summary": "Both countries have same Trade Deal rates"
}

For EXPLANATIONS (how does X work, what is Y):
{
  "type": "explanation",
  "title": "How Tier 2 Suppliers Affect USMCA",
  "content": "Markdown formatted explanation here...",
  "related": ["USMCA Rules of Origin", "Non-qualifying rates"]
}

Material groups: Cigarette Paper (4813.10), Tipping Paper (4813.20), Plugwrap (4813.90), Filter Tow (5502), Filter Rods (5601.22), Adhesive (3506), Capsules (3926.90), Plasticizer (2917.12), Adsorbent (3802.10), Board Packaging (4819.10), Paper Packaging (4819.20), Inner Bundling (4811.90), Board Inner Frame (4819.10).

Key concepts: USMCA (0% qualifying, 25% non-qualifying), Section 301 (+25% China), IEEPA Reciprocal (country-specific), FTA countries (0%).

ALWAYS respond with valid JSON only. No text outside the JSON object.`;

// Search endpoint
app.post('/api/search', async (req, res) => {
    try {
        const { query, context } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        let systemPrompt = SYSTEM_PROMPT;
        if (context) {
            systemPrompt += `\n\nDASHBOARD DATA:\n${context}`;
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: query }]
        });

        const rawAnswer = response.content[0].text;

        // Try to parse as JSON
        let structuredResponse;
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                structuredResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found');
            }
        } catch (parseError) {
            // Fallback to text response
            structuredResponse = {
                type: 'explanation',
                title: 'Response',
                content: rawAnswer
            };
        }

        res.json({
            ...structuredResponse,
            usage: {
                input_tokens: response.usage.input_tokens,
                output_tokens: response.usage.output_tokens
            }
        });

    } catch (error) {
        console.error('Claude API error:', error);
        res.status(500).json({
            error: 'Failed to get response',
            type: 'error',
            details: error.message
        });
    }
});

// Keep old chat endpoint for compatibility
app.post('/api/chat', async (req, res) => {
    const { message, context } = req.body;
    // Redirect to search
    req.body.query = message;
    return res.redirect(307, '/api/search');
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
