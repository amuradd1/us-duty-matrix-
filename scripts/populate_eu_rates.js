const REQUIRED_ENVS = ['SUPABASE_URL', 'SUPABASE_KEY'];

const MATERIALS = {
  'Cigarette Paper': '4813100000',
  'Tipping Paper': '4813200000',
  Plugwrap: '4813900000',
  'Filter Tow': '5502100000',
  'Filter Rods': '5601220000',
  Adhesive: '3506911000',
  Capsules: '3926909990',
  Plasticizer: '2917120000',
  Adsorbent: '3802100000',
  'Board Packaging': '4819100000',
  'Paper Packaging': '4819200000'
};

// Priority non-EU supplier countries for EU import scenarios.
const COUNTRIES = [
  'US', 'CN', 'HK', 'JP', 'KR', 'IN', 'ID', 'VN', 'TH', 'MY',
  'PH', 'TW', 'SG', 'AU', 'GB', 'CH', 'NO', 'TR', 'PK', 'BD',
  'LK', 'BR', 'AR', 'MX', 'CA', 'CL', 'CO', 'ZA', 'EG', 'AE'
];

const RESET_EXISTING = process.env.RESET_EXISTING !== 'false';
const DRY_RUN = process.env.DRY_RUN === 'true';

function assertEnv() {
  const missing = REQUIRED_ENVS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function clearExistingRows() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/duty_rates?destination=eq.EU&source=eq.TARIC`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to clear EU TARIC rows (${response.status}): ${body.slice(0, 400)}`);
  }
}

async function insertRate(country, material, cnCode, rate, rateType) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/duty_rates`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      country_iso: country,
      destination: 'EU',
      material,
      cn_code: cnCode,
      rate,
      rate_type: rateType,
      source: 'TARIC'
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${body.slice(0, 400)}`);
  }
}

async function getTaricRate(cnCode, countryCode) {
  const referenceDate = new Date().toISOString().split('T')[0];
  const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://goodsNomenclatureForWS.ws.taric.dds.s/">
  <soap:Body>
    <tns:goodsMeasForWs>
      <tns:goodsCode>${cnCode}</tns:goodsCode>
      <tns:countryCode>${countryCode}</tns:countryCode>
      <tns:referenceDate>${referenceDate}</tns:referenceDate>
      <tns:tradeMovement>I</tns:tradeMovement>
    </tns:goodsMeasForWs>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch('https://ec.europa.eu/taxation_customs/dds2/taric/services/goods', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '""'
    },
    body: soapRequest
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TARIC request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const xml = await response.text();
  const measures = [];
  const measureRegex = /<measure>([\s\S]*?)<\/measure>/g;
  let match;

  while ((match = measureRegex.exec(xml)) !== null) {
    const measureXml = match[1];
    const typeMatch = measureXml.match(/<measure_type>(\d+)<\/measure_type>/);
    const rateMatch = measureXml.match(/<duty_rate>([\d.]+)\s*%/);
    if (!typeMatch || !rateMatch) continue;

    measures.push({
      type: Number(typeMatch[1]),
      rate: Number(rateMatch[1])
    });
  }

  const preference = measures.find((m) => m.type === 142);
  const thirdCountry = measures.find((m) => m.type === 103);

  if (preference) return { rate: preference.rate, rateType: 'FTA' };
  if (thirdCountry) return { rate: thirdCountry.rate, rateType: 'MFN' };
  return null;
}

async function main() {
  assertEnv();

  console.log('Starting EU duty rate sync to Supabase...');
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'WRITE'}`);

  if (RESET_EXISTING) {
    console.log('Clearing existing TARIC EU rows...');
    if (!DRY_RUN) {
      await clearExistingRows();
    }
  }

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const country of COUNTRIES) {
    console.log(`\n=== ${country} ===`);
    for (const [material, cnCode] of Object.entries(MATERIALS)) {
      try {
        const rateData = await getTaricRate(cnCode, country);
        if (!rateData) {
          skipped += 1;
          console.log(`  SKIP: ${material} (no tariff measure found)`);
          continue;
        }

        if (!DRY_RUN) {
          await insertRate(country, material, cnCode, rateData.rate, rateData.rateType);
        }

        success += 1;
        console.log(`  OK: ${material} = ${rateData.rate}% (${rateData.rateType})`);
      } catch (error) {
        errors += 1;
        console.log(`  ERROR: ${material} - ${error.message}`);
      }

      await sleep(120);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Inserted/Prepared: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Fatal EU sync error:', error.message);
  process.exit(1);
});
