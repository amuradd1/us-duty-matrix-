const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const US_BUSINESS_COUNTRY_SCOPE_PATH = path.join(__dirname, 'data', 'us_business_country_scope.json');
const US_BUSINESS_COUNTRY_SCOPE_BY_MATERIAL_PATH = path.join(__dirname, 'data', 'us_business_country_scope_by_material.json');
const WOVE_ENTRY_DATE_PRE_SC = '2026-02-15';
const WOVE_ENTRY_DATE_POST_SC = '2026-02-26';
const WOVE_DEFAULT_ORIGIN_FOR_BASE_LOOKUP = 'JP';
const WOVE_TOKEN_TTL_MS = 45 * 60 * 1000;

const MATERIAL_HS_CODES = {
    'Cigarette Paper': '4813100000',
    'Tipping Paper': '4813200000',
    Plugwrap: '4813900000',
    'Filter Tow': '5502100000',
    'Filter Rods': '5601220091',
    Adhesive: '3506915000',
    Capsules: '3926909990',
    Plasticizer: '2917125000',
    Adsorbent: '3802100000',
    'Board Packaging': '4819100000',
    'Paper Packaging': '4819200000',
    'MO Cans': '3923900000',
    'Inner Bundling': '4811909000',
    'Board Inner Frame': '4819100000'
};

const MATERIAL_QUERY_ALIASES = {
    'Cigarette Paper': ['cigarette paper'],
    'Tipping Paper': ['tipping paper'],
    Plugwrap: ['plugwrap', 'plug wrap'],
    'Filter Tow': ['filter tow'],
    'Filter Rods': ['filter rods', 'filter rod'],
    Adhesive: ['adhesive', 'adhesives'],
    Capsules: ['capsules', 'capsule'],
    Plasticizer: ['plasticizer', 'plasticizers'],
    Adsorbent: ['adsorbent', 'activated carbon'],
    'Board Packaging': ['board packaging', 'carton board', 'corrugated board'],
    'Paper Packaging': ['paper packaging', 'folding cartons'],
    'MO Cans': ['mo cans', 'modern oral cans', 'modern oral can'],
    'Inner Bundling': ['inner bundling'],
    'Board Inner Frame': ['board inner frame', 'inner frame']
};

let cachedWoveToken = null;
let cachedWoveTokenFetchedAt = 0;

function loadUsBusinessCountryScope() {
    try {
        const raw = fs.readFileSync(US_BUSINESS_COUNTRY_SCOPE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((row) => row && typeof row.country_iso === 'string')
            .map((row) => ({
                country_iso: String(row.country_iso).toUpperCase(),
                country_name: row.country_name || null
            }));
    } catch (_) {
        return [];
    }
}

const US_BUSINESS_COUNTRY_SCOPE = loadUsBusinessCountryScope();
const US_BUSINESS_COUNTRY_ISOS = US_BUSINESS_COUNTRY_SCOPE.map((row) => row.country_iso);

function loadUsBusinessCountryScopeByMaterial() {
    try {
        const raw = fs.readFileSync(US_BUSINESS_COUNTRY_SCOPE_BY_MATERIAL_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const cleaned = {};
        Object.entries(parsed).forEach(([material, isos]) => {
            if (!Array.isArray(isos)) return;
            const valid = isos
                .map((iso) => String(iso || '').toUpperCase())
                .filter(Boolean);
            if (valid.length) cleaned[material] = [...new Set(valid)];
        });
        return cleaned;
    } catch (_) {
        return {};
    }
}

const US_BUSINESS_COUNTRY_ISOS_BY_MATERIAL = loadUsBusinessCountryScopeByMaterial();

function parseJsonSafe(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

function hasWoveCredentials() {
    return Boolean(process.env.WOVE_CLIENT_ID && process.env.WOVE_CLIENT_SECRET);
}

function queryNeedsBaseDutyEnrichment(query) {
    const text = String(query || '').toLowerCase();
    if (!text) return false;
    return /\b(base|mfn|breakdown|component|additional|section\s*301|section\s*232|section\s*122|ieepa|surcharge)\b/i.test(text);
}

function extractMaterialsFromQuery(query) {
    const text = String(query || '').toLowerCase();
    const found = new Set();

    Object.entries(MATERIAL_QUERY_ALIASES).forEach(([material, aliases]) => {
        if (aliases.some((alias) => text.includes(alias))) {
            found.add(material);
        }
    });

    return [...found];
}

function inferEntryDateFromContext(context) {
    const text = String(context || '');
    if (!text) return null;

    if (/US Snapshot Selector:\s*pre/i.test(text)) {
        return WOVE_ENTRY_DATE_PRE_SC;
    }
    if (/US Snapshot Selector:\s*post/i.test(text)) {
        return WOVE_ENTRY_DATE_POST_SC;
    }
    if (/Active Dataset Source:\s*WOVE_TODAY\b/i.test(text) || /source=WOVE_TODAY\b/i.test(text)) {
        return WOVE_ENTRY_DATE_POST_SC;
    }
    if (/Active Dataset Source:\s*WOVE\b/i.test(text) || /source=WOVE\b/i.test(text)) {
        return WOVE_ENTRY_DATE_PRE_SC;
    }
    return null;
}

async function getWoveTokenCached() {
    if (!hasWoveCredentials()) {
        throw new Error('Missing WOVE_CLIENT_ID or WOVE_CLIENT_SECRET');
    }

    const now = Date.now();
    if (cachedWoveToken && now - cachedWoveTokenFetchedAt < WOVE_TOKEN_TTL_MS) {
        return cachedWoveToken;
    }

    const tokenRes = await fetch('https://api.wove.com/api/v1/external/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: process.env.WOVE_CLIENT_ID,
            client_secret: process.env.WOVE_CLIENT_SECRET
        })
    });
    const tokenBodyText = await tokenRes.text();
    const tokenData = parseJsonSafe(tokenBodyText);

    if (!tokenRes.ok || !tokenData || !tokenData.access_token) {
        throw new Error(`Wove token fetch failed (${tokenRes.status})`);
    }

    cachedWoveToken = tokenData.access_token;
    cachedWoveTokenFetchedAt = now;
    return cachedWoveToken;
}

async function fetchWoveMaterialDetail(material, entryDate, originCountry = WOVE_DEFAULT_ORIGIN_FOR_BASE_LOOKUP) {
    const hsCode = MATERIAL_HS_CODES[material];
    if (!hsCode) {
        return { material, error: 'Unknown material HTS mapping' };
    }

    const lookupUrl = `https://api.wove.com/api/v1/external/tariffs/lookup?hsCode=${hsCode}&originCountry=${originCountry}&destinationCountry=US&includeFtaOptions=true&entryDate=${entryDate}`;
    let lookupData = null;
    let lookupStatus = 0;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const token = await getWoveTokenCached();
        const lookupRes = await fetch(lookupUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        lookupStatus = lookupRes.status;
        const lookupText = await lookupRes.text();
        lookupData = parseJsonSafe(lookupText);

        if (lookupRes.status === 401 && attempt === 0) {
            cachedWoveToken = null;
            cachedWoveTokenFetchedAt = 0;
            continue;
        }
        break;
    }

    if (!lookupData || !lookupData.success || !lookupData.data) {
        return { material, hsCode, error: `Lookup failed (${lookupStatus || 'unknown'})` };
    }

    const raw = lookupData.data;
    const baseRate = Number(raw.baseRate?.adValoremRate);
    const applicableRate = Number(raw.applicableRate?.adValoremRate);
    const additionalDuties = Array.isArray(raw.additionalDuties) ? raw.additionalDuties : [];

    return {
        material,
        hsCode,
        entryDate,
        originCountry,
        baseRate: Number.isFinite(baseRate) ? baseRate : null,
        applicableRate: Number.isFinite(applicableRate) ? applicableRate : null,
        baseProgram: raw.baseRate?.programCode || null,
        applicableProgram: raw.applicableRate?.programCode || null,
        additionalDuties: additionalDuties.map((duty) => ({
            programCode: duty.programCode || null,
            htsCode: duty.htsCode || null,
            rate: Number.isFinite(Number(duty.rate)) ? Number(duty.rate) : null
        }))
    };
}

async function buildWoveBaseDutyEnrichment(query, context) {
    const materials = extractMaterialsFromQuery(query);
    if (!materials.length || !queryNeedsBaseDutyEnrichment(query)) {
        return '';
    }

    if (!hasWoveCredentials()) {
        return [
            '=== WOVE MATERIAL ENRICHMENT ===',
            'Unavailable: WOVE credentials are not configured on the server.'
        ].join('\n');
    }

    const entryDate = inferEntryDateFromContext(context) || WOVE_ENTRY_DATE_POST_SC;
    const materialSubset = materials.slice(0, 4);
    const details = await Promise.all(
        materialSubset.map((material) => fetchWoveMaterialDetail(material, entryDate))
    );

    const lines = [
        '=== WOVE MATERIAL ENRICHMENT ===',
        `Lookup basis: destination=US, origin=${WOVE_DEFAULT_ORIGIN_FOR_BASE_LOOKUP}, entryDate=${entryDate}`,
        'Interpretation: baseRate = material MFN/base duty; applicableRate = effective duty after overlays.'
    ];

    details.forEach((detail) => {
        if (detail.error) {
            lines.push(`- ${detail.material}: unavailable (${detail.error})`);
            return;
        }

        const extra = detail.additionalDuties.length > 0
            ? detail.additionalDuties
                .map((duty) => `${duty.programCode || 'additional'}${duty.rate !== null ? ` ${duty.rate}%` : ''}`)
                .join(', ')
            : 'none';

        lines.push(
            `- ${detail.material} | HTS ${detail.hsCode} | baseRate=${detail.baseRate !== null ? `${detail.baseRate}%` : 'N/A'} | applicableRate=${detail.applicableRate !== null ? `${detail.applicableRate}%` : 'N/A'} | additional=${extra}`
        );
    });

    return lines.join('\n');
}

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// System prompt for Import DutyGPT
const SYSTEM_PROMPT = `You are Import DutyGPT, an assistant for this import-duty dashboard.

CRITICAL RULES:
1. Use only the dashboard context data provided in this request. Do not invent rates.
2. The loaded context may represent US, EU, or compare-mode data. Respect dataset/source/snapshot labels in context.
3. Do not mention specific companies, brands, or manufacturers.
4. If data is missing for a query, return a concise explanation in JSON.
5. If "WOVE MATERIAL ENRICHMENT" is present, use it for base/MFN/breakdown questions.

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
        try {
            const enrichmentBlock = await buildWoveBaseDutyEnrichment(query, context);
            if (enrichmentBlock) {
                systemPrompt += `\n\n${enrichmentBlock}`;
            }
        } catch (enrichmentError) {
            console.warn('Wove enrichment skipped:', enrichmentError.message);
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

// Temporary debug endpoint – shows raw Wove API response for a single HTS + country
app.get('/api/debug-wove', async (req, res) => {
    const { hsCode = '3506915000', country = 'CN', entryDate } = req.query;
    const WOVE_CLIENT_ID = process.env.WOVE_CLIENT_ID;
    const WOVE_CLIENT_SECRET = process.env.WOVE_CLIENT_SECRET;

    if (!WOVE_CLIENT_ID || !WOVE_CLIENT_SECRET) {
        return res.status(503).json({ error: 'Missing WOVE_CLIENT_ID or WOVE_CLIENT_SECRET' });
    }

    try {
        // Get token
        const tokenRes = await fetch('https://api.wove.com/api/v1/external/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'client_credentials', client_id: WOVE_CLIENT_ID, client_secret: WOVE_CLIENT_SECRET })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return res.status(502).json({ error: 'Token fetch failed', tokenData });

        // Lookup
        const entryDateQuery = entryDate ? `&entryDate=${encodeURIComponent(entryDate)}` : '';
        const url = `https://api.wove.com/api/v1/external/tariffs/lookup?hsCode=${hsCode}&originCountry=${country}&destinationCountry=US&includeFtaOptions=true${entryDateQuery}`;
        const rateRes = await fetch(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
        const rawJson = await rateRes.json();

        return res.json({ hsCode, country, entryDate: entryDate || null, raw: rawJson });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
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
    const scope = req.query.scope || 'all';

    const queryParts = [
        `destination=eq.${encodeURIComponent(destination)}`,
        `source=eq.${encodeURIComponent(source)}`,
        'select=country_iso,material,rate,rate_type'
    ];

    if (
        destination.toUpperCase() === 'US'
        && scope === 'business'
        && US_BUSINESS_COUNTRY_ISOS.length > 0
    ) {
        queryParts.push(`country_iso=in.(${US_BUSINESS_COUNTRY_ISOS.join(',')})`);
    }

    const url = `${SUPABASE_URL}/rest/v1/duty_rates?${queryParts.join('&')}`;

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
            scope,
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

app.get('/api/country-scope', (req, res) => {
    const destination = String(req.query.destination || 'US').toUpperCase();
    const scope = String(req.query.scope || 'business').toLowerCase();

    if (destination !== 'US' || scope !== 'business') {
        return res.status(400).json({
            error: 'Unsupported country scope request',
            details: 'Only destination=US&scope=business is currently supported'
        });
    }

    return res.json({
        destination,
        scope,
        count: US_BUSINESS_COUNTRY_SCOPE.length,
        rows: US_BUSINESS_COUNTRY_SCOPE,
        material_country_iso_map: US_BUSINESS_COUNTRY_ISOS_BY_MATERIAL
    });
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

        // ── Measure-type priority (Series C – Applicable Duty) ──
        // Preferential / agreement-based rates (origin-dependent)
        //   142 = Tariff preference (FTA / GSP)
        //   143 = Preferential tariff quota
        //   144 = Preferential ceiling
        //   141 = Preferential suspension
        //   145 = Preference under authorised use (end-use)
        //   146 = Preferential tariff quota under authorised use
        // Customs Union rates
        //   106 = Customs Union Duty  (Turkey, Andorra, San Marino)
        //   147 = Customs Union Quota
        // Autonomous / erga-omnes reductions
        //   112 = Autonomous tariff suspension
        //   122 = Non-preferential tariff quota
        // MFN baseline
        //   103 = Third country duty
        //
        // We pick the lowest-rate preferential measure first; fall back to MFN.
        // Sector-specific suspensions (117 ships, 119 airworthiness) are excluded
        // as they require special end-use authorisation not relevant to our materials.

        const preferentialTypes = new Set([142, 143, 144, 141, 145, 146, 106, 147, 112, 122]);
        const preferentialMeasures = measures.filter(m => preferentialTypes.has(m.type));
        const thirdCountry = measures.find(m => m.type === 103);

        // Labels for response
        const typeLabels = {
            142: 'FTA', 143: 'FTA Quota', 144: 'FTA Ceiling', 141: 'FTA Suspension',
            145: 'FTA End-Use', 146: 'FTA Quota End-Use',
            106: 'Customs Union', 147: 'CU Quota',
            112: 'Autonomous Suspension', 122: 'MFN Quota'
        };

        if (preferentialMeasures.length > 0) {
            // Pick the lowest rate among all preferential measures
            const best = preferentialMeasures.reduce((a, b) => a.rate <= b.rate ? a : b);
            res.json({
                rate: best.rate,
                type: typeLabels[best.type] || 'Preferential',
                cnCode,
                countryCode,
                mfnRate: thirdCountry ? thirdCountry.rate : null,
                allMeasures: measures.map(m => ({ type: m.type, rate: m.rate, description: m.description }))
            });
        } else if (thirdCountry) {
            res.json({
                rate: thirdCountry.rate,
                type: 'MFN',
                cnCode,
                countryCode,
                allMeasures: measures.map(m => ({ type: m.type, rate: m.rate, description: m.description }))
            });
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
