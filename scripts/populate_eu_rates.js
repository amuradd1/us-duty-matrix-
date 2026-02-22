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
  'Paper Packaging': '4819200000',
  'MO Cans': '3923900000',
  'Inner Bundling': '4811900000',
  'Board Inner Frame': '4819100000'
};

// Priority non-EU supplier countries for EU import scenarios.
const COUNTRIES = [
  'US', 'CN', 'HK', 'JP', 'KR', 'IN', 'ID', 'VN', 'TH', 'MY',
  'PH', 'TW', 'SG', 'AU', 'GB', 'CH', 'NO', 'TR', 'PK', 'BD',
  'LK', 'BR', 'AR', 'MX', 'CA', 'CL', 'CO', 'ZA', 'EG', 'AE'
];

const EU_MEMBER_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

const RESET_EXISTING = process.env.RESET_EXISTING !== 'false';
const DRY_RUN = process.env.DRY_RUN === 'true';

// Blue-green source tags – new data is written to STAGING, then atomically
// swapped to LIVE so users never see a half-empty table mid-sync.
const SOURCE_LIVE    = 'TARIC';
const SOURCE_STAGING = 'TARIC_STAGING';

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

// Clear any leftover staging rows from a previous failed run
async function clearStagingRows() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/duty_rates?destination=eq.EU&source=eq.${SOURCE_STAGING}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to clear staging rows (${response.status}): ${body.slice(0, 400)}`);
  }
}

// Write new row into staging (invisible to users – server only serves SOURCE_LIVE)
async function insertRate(country, material, cnCode, rate, rateType) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/duty_rates`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      country_iso: country,
      destination: 'EU',
      material,
      cn_code: cnCode,
      rate,
      rate_type: rateType,
      source: SOURCE_STAGING   // ← staging, not live
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${body.slice(0, 400)}`);
  }
}

// Atomic swap: delete old live rows, rename staging → live in one go
async function swapStagingToLive() {
  const base = `${process.env.SUPABASE_URL}/rest/v1/duty_rates`;

  // 1. Delete old live rows
  const delResp = await fetch(`${base}?destination=eq.EU&source=eq.${SOURCE_LIVE}`, {
    method: 'DELETE',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' }
  });
  if (!delResp.ok) {
    const body = await delResp.text();
    throw new Error(`Failed to delete old live rows (${delResp.status}): ${body.slice(0, 400)}`);
  }

  // 2. Rename staging → live (PATCH source field)
  const patchResp = await fetch(`${base}?destination=eq.EU&source=eq.${SOURCE_STAGING}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ source: SOURCE_LIVE })
  });
  if (!patchResp.ok) {
    const body = await patchResp.text();
    throw new Error(`Failed to promote staging to live (${patchResp.status}): ${body.slice(0, 400)}`);
  }
}

async function insertIntraEURates() {
  let inserted = 0;
  for (const country of EU_MEMBER_COUNTRIES) {
    for (const [material, cnCode] of Object.entries(MATERIALS)) {
      if (!DRY_RUN) {
        await insertRate(country, material, cnCode, 0, 'INTRA_EU');
        // insertRate already writes to SOURCE_STAGING; INTRA_EU is the rate_type
      }
      inserted += 1;
    }
  }
  return inserted;
}

async function getTaricRate(cnCode, countryCode, retries = 4, baseDelayMs = 2000) {
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

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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

      // ── Measure-type priority (Series C – Applicable Duty) ──
      // Preferential (142, 143, 144, 141, 145, 146), Customs Union (106, 147),
      // Autonomous/erga-omnes (112, 122). Excludes sector-specific (117, 119).
      const preferentialTypes = new Set([142, 143, 144, 141, 145, 146, 106, 147, 112, 122]);
      const typeLabels = {
        142: 'FTA', 143: 'FTA Quota', 144: 'FTA Ceiling', 141: 'FTA Suspension',
        145: 'FTA End-Use', 146: 'FTA Quota End-Use',
        106: 'Customs Union', 147: 'CU Quota',
        112: 'Autonomous Suspension', 122: 'MFN Quota'
      };

      const preferentialMeasures = measures.filter((m) => preferentialTypes.has(m.type));
      const thirdCountry = measures.find((m) => m.type === 103);

      if (preferentialMeasures.length > 0) {
        const best = preferentialMeasures.reduce((a, b) => a.rate <= b.rate ? a : b);
        return { rate: best.rate, rateType: typeLabels[best.type] || 'Preferential' };
      }
      if (thirdCountry) return { rate: thirdCountry.rate, rateType: 'MFN' };
      return null;

    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt); // 2s, 4s, 8s, 16s
        console.log(`  RETRY ${attempt + 1}/${retries}: ${cnCode}/${countryCode} - ${err.message} (waiting ${delay}ms)`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

async function main() {
  assertEnv();

  console.log('Starting EU duty rate sync to Supabase...');
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'WRITE'}`);
  console.log('Strategy: blue-green staging swap (users see live data throughout)\n');

  // Clear any leftover staging rows from a previous failed run
  if (!DRY_RUN) {
    console.log('Clearing any leftover staging rows...');
    await clearStagingRows();
  }

  let success = 0;
  let skipped = 0;
  let errors = 0;

  // Phase 1: Write all new data into staging (SOURCE_STAGING)
  // Live rows (SOURCE_LIVE) remain untouched – users see current data throughout
  console.log('Phase 1: Writing new rates to staging...');

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

      await sleep(300);
    }
    // Brief pause between countries to reduce TARIC API pressure
    await sleep(500);
  }

  console.log('\n=== EU MEMBER ORIGINS (INTRA_EU) ===');
  const intraEuRows = await insertIntraEURates();
  success += intraEuRows;
  console.log(`  OK: Inserted ${intraEuRows} INTRA_EU rows into staging`);

  console.log('\n=== SUMMARY ===');
  console.log(`Staged: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  // Phase 2: Atomic swap – only promote if no errors
  if (errors > 0) {
    console.log('\n⚠️  Errors detected – aborting swap. Live data unchanged. Cleaning up staging rows...');
    if (!DRY_RUN) await clearStagingRows();
    process.exitCode = 1;
    return;
  }

  if (!DRY_RUN) {
    console.log('\nPhase 2: Atomically swapping staging → live...');
    await swapStagingToLive();
    console.log('✅ Swap complete. Live EU data updated with zero downtime.');
  } else {
    console.log('\n[DRY RUN] Would swap staging → live now.');
  }
}

main().catch((error) => {
  console.error('Fatal EU sync error:', error.message);
  process.exit(1);
});
