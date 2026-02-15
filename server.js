const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// System prompt for Import DutyGPT
const SYSTEM_PROMPT = `You are Import DutyGPT, an assistant for this import-duty dashboard.

CRITICAL RULES:
1. Use only the dashboard context data provided in this request. Do not invent rates.
2. The loaded context may represent US or EU destination data. Respect dataset labels in context.
3. Do not mention specific companies, brands, or manufacturers.
4. If data is missing for a query, return a concise explanation in JSON.

RANKING RULES:
1. Rank by requested metric exactly as asked.
2. If values tie, use the same rank for tied items.
3. Keep numeric values precise (use decimals when provided by context).

RESPONSE FORMAT:
You MUST return valid JSON in one of these formats:

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

Always return JSON only. No text outside the JSON object.`;

// Search endpoint
app.post('/api/search', async (req, res) => {
    try {
        const { query, context } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({
                error: 'Anthropic API is not configured',
                details: 'Missing ANTHROPIC_API_KEY'
            });
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

// Supabase duty-rate proxy
app.get('/api/duty-rates', async (req, res) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(503).json({
            error: 'Duty rate API is not configured',
            details: 'Missing SUPABASE_URL or SUPABASE_KEY'
        });
    }

    const source = req.query.source || 'WOVE';
    const destination = req.query.destination || 'US';
    const url = `${SUPABASE_URL}/rest/v1/duty_rates?destination=eq.${encodeURIComponent(destination)}&source=eq.${encodeURIComponent(source)}&select=country_iso,material,rate,rate_type`;

    try {
        const response = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Accept: 'application/json'
            }
        });

        const body = await response.text();
        if (!response.ok) {
            return res.status(502).json({
                error: 'Failed to fetch duty rates from Supabase',
                status: response.status,
                details: body.slice(0, 500)
            });
        }

        let rows = [];
        try {
            rows = JSON.parse(body);
        } catch (parseError) {
            return res.status(502).json({
                error: 'Supabase response was not valid JSON',
                details: parseError.message
            });
        }

        return res.json({
            source,
            destination,
            count: rows.length,
            rows
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Unexpected error while loading duty rates',
            details: error.message
        });
    }
});

// Supabase countries proxy
app.get('/api/countries', async (req, res) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(503).json({ error: 'Not configured' });
    }
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/countries?select=iso_code,name&order=name`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Accept: 'application/json'
            }
        });
        const body = await response.text();
        if (!response.ok) return res.status(502).json({ error: body.slice(0, 300) });
        return res.json(JSON.parse(body));
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// EU TARIC API Proxy - bypasses CORS
app.get('/api/eu-rate/:cnCode/:countryCode', async (req, res) => {
    const { cnCode, countryCode } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://goodsNomenclatureForWS.ws.taric.dds.s/">
  <soap:Body>
    <tns:goodsMeasForWs>
      <tns:goodsCode>${cnCode}</tns:goodsCode>
      <tns:countryCode>${countryCode}</tns:countryCode>
      <tns:referenceDate>${today}</tns:referenceDate>
      <tns:tradeMovement>I</tns:tradeMovement>
    </tns:goodsMeasForWs>
  </soap:Body>
</soap:Envelope>`;

    try {
        const response = await fetch('https://ec.europa.eu/taxation_customs/dds2/taric/services/goods', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '""'
            },
            body: soapRequest
        });

        const xml = await response.text();

        // Parse measures from XML
        const measures = [];
        const measureRegex = /<measure>([\s\S]*?)<\/measure>/g;
        let match;

        while ((match = measureRegex.exec(xml)) !== null) {
            const measureXml = match[1];
            const typeMatch = measureXml.match(/<measure_type>(\d+)<\/measure_type>/);
            const rateMatch = measureXml.match(/<duty_rate>([\d.]+)\s*%/);
            const descMatch = measureXml.match(/<description>([^<]+)<\/description>/);

            if (typeMatch && rateMatch) {
                measures.push({
                    type: parseInt(typeMatch[1]),
                    rate: parseFloat(rateMatch[1]),
                    description: descMatch ? descMatch[1] : ''
                });
            }
        }

        // Priority: Tariff preference (142) > Third country duty (103)
        const preference = measures.find(m => m.type === 142);
        const thirdCountry = measures.find(m => m.type === 103);

        if (preference) {
            res.json({ rate: preference.rate, type: 'FTA', cnCode, countryCode });
        } else if (thirdCountry) {
            res.json({ rate: thirdCountry.rate, type: 'MFN', cnCode, countryCode });
        } else {
            res.json({ rate: null, type: 'N/A', cnCode, countryCode, measures });
        }
    } catch (error) {
        console.error('TARIC API error:', error);
        res.status(500).json({ error: error.message, cnCode, countryCode });
    }
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
