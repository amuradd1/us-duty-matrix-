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

// System prompt for the duty matrix assistant
const SYSTEM_PROMPT = `You are an expert assistant for US import duties. You help users understand duty rates shown in their dashboard.

IMPORTANT RULES:
1. The user will provide ACTUAL DUTY DATA from their dashboard with each question. Always use this data for your answers.
2. NEVER mention or reference any specific companies, brands, or manufacturers. Keep all responses generic and focused only on duty rates and trade regulations.
3. The data contains rates including all tariffs (MFN + IEEPA reciprocal + Section 301 where applicable).

Material groups and HTS codes:
- Cigarette Paper (HTS 4813.10)
- Tipping Paper (HTS 4813.20)
- Plugwrap (HTS 4813.90)
- Filter Tow (HTS 5502)
- Filter Rods (HTS 5601.22)
- Adhesive (HTS 3506)
- Capsules (HTS 3926.90)
- Plasticizer (HTS 2917.12)
- Adsorbent (HTS 3802.10)
- Board Packaging (HTS 4819.10)
- Paper Packaging (HTS 4819.20)
- Inner Bundling (HTS 4811.90)
- Board Inner Frame (HTS 4819.10)

Key concepts you understand:
- USMCA: Canada/Mexico get 0% if goods qualify under rules of origin, 25% if non-qualifying
- Tier 2 suppliers: If raw materials come from outside USMCA region, goods may not qualify for preferential rates
- Section 301: Additional 25% tariff on Chinese goods
- IEEPA Reciprocal tariffs: Country-specific additional tariffs (e.g., 19% for Malaysia, 10% for UK)
- FTA countries: Korea, Australia, Singapore, etc. typically get 0%

Be concise and direct. Reference the actual data provided. If comparing countries, use the real numbers from the dashboard data.`;

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Build messages array
        const messages = [
            { role: 'user', content: message }
        ];

        // Add context about current view if provided
        let systemPrompt = SYSTEM_PROMPT;
        if (context) {
            systemPrompt += `\n\nCurrent user context: ${context}`;
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages
        });

        const answer = response.content[0].text;

        res.json({
            answer,
            usage: {
                input_tokens: response.usage.input_tokens,
                output_tokens: response.usage.output_tokens
            }
        });

    } catch (error) {
        console.error('Claude API error:', error);
        res.status(500).json({
            error: 'Failed to get response',
            details: error.message
        });
    }
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
