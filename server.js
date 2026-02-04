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
const SYSTEM_PROMPT = `You are an expert assistant for US import duties on tobacco materials. You have deep knowledge of:

- US Harmonized Tariff Schedule (HTS) codes for tobacco materials
- IEEPA reciprocal tariffs by country
- Section 301 tariffs (especially for China)
- Free Trade Agreements: USMCA, KORUS, CAFTA-DR, and others
- Rules of origin and FTA qualification
- Tier 2 supplier implications on FTA qualification
- Country-specific trade deals (e.g., UK, Japan, Vietnam, Malaysia agreements)

Material groups you know about:
- Cigarette Paper (HTS 4813.10) - MFN: Free
- Tipping Paper (HTS 4813.20) - MFN: Free
- Plugwrap (HTS 4813.90) - MFN: Free
- Filter Tow (HTS 5502) - MFN: 7.5%
- Filter Rods (HTS 5601.22) - MFN: 6.3%
- Adhesive (HTS 3506) - MFN: 2.1%
- Capsules (HTS 3926.90) - MFN: 5.3%
- Plasticizer (HTS 2917.12) - MFN: 6.5%
- Adsorbent (HTS 3802.10) - MFN: Free
- Board Packaging (HTS 4819.10) - MFN: Free
- Paper Packaging (HTS 4819.20) - MFN: Free
- Inner Bundling (HTS 4811.90) - MFN: Free
- Board Inner Frame (HTS 4819.10) - MFN: Free

Key rates to remember:
- USMCA (Canada, Mexico): 0% if qualifying, 25% if non-qualifying
- China: MFN + 10% reciprocal + 10% fentanyl + 25% Section 301 = ~45% for paper
- UK: 10% (May 2025 deal)
- Japan: 15% (CRS R48549)
- Vietnam: 20%, Malaysia/Thailand/Indonesia/Philippines: 19%
- FTA countries (Korea, Australia, Singapore, etc.): 0%

Be concise and direct. If asked about specific rates, give the number. If asked about complex scenarios (like tier 2 suppliers), explain the implications clearly.`;

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
