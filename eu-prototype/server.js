const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Material to CN code mapping (same as US HTS codes - they align)
const materialCodes = {
    'Cigarette Paper': '4813100000',
    'Tipping Paper': '4813200000',
    'Plugwrap': '4813900000',
    'Filter Tow': '5502100000',
    'Filter Rods': '5601220000',
    'Adhesive': '3506911000',
    'Capsules': '3926909990',
    'Plasticizer': '2917120000',
    'Adsorbent': '3802100000',
    'Board Packaging': '4819100000',
    'Paper Packaging': '4819200000'
};

// 10 test countries
const testCountries = ['CN', 'JP', 'DE', 'US', 'KR', 'IN', 'VN', 'BR', 'MX', 'TH'];

// Function to call TARIC API
async function getTaricRate(cnCode, countryCode) {
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://goodsNomenclatureForWS.ws.taric.dds.s/">
  <soap:Body>
    <tns:goodsMeasForWs>
      <tns:goodsCode>${cnCode}</tns:goodsCode>
      <tns:countryCode>${countryCode}</tns:countryCode>
      <tns:referenceDate>${new Date().toISOString().split('T')[0]}</tns:referenceDate>
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

        // Parse the XML to extract duty rates
        const measures = [];

        // Extract all measures with their types and rates
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
            return { rate: preference.rate, type: 'Preference', description: preference.description };
        } else if (thirdCountry) {
            return { rate: thirdCountry.rate, type: 'MFN', description: thirdCountry.description };
        }

        return { rate: null, type: 'Unknown', description: 'No rate found' };
    } catch (error) {
        console.error(`Error fetching rate for ${cnCode} from ${countryCode}:`, error.message);
        return { rate: null, type: 'Error', description: error.message };
    }
}

// Endpoint to get all EU rates
app.get('/api/eu-rates', async (req, res) => {
    const results = [];

    for (const country of testCountries) {
        const countryData = { country, materials: {} };

        for (const [material, cnCode] of Object.entries(materialCodes)) {
            const rateData = await getTaricRate(cnCode, country);
            countryData.materials[material] = rateData;
        }

        results.push(countryData);
        console.log(`Fetched rates for ${country}`);
    }

    res.json(results);
});

// Endpoint to get rate for single material/country
app.get('/api/eu-rate/:cnCode/:countryCode', async (req, res) => {
    const { cnCode, countryCode } = req.params;
    const rateData = await getTaricRate(cnCode, countryCode);
    res.json(rateData);
});

// Endpoint to get material code mapping
app.get('/api/material-codes', (req, res) => {
    res.json(materialCodes);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`EU Prototype server running on http://localhost:${PORT}`);
});
