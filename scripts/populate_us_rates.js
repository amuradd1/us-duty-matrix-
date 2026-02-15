const REQUIRED_ENVS = [
  'WOVE_CLIENT_ID',
  'WOVE_CLIENT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_KEY'
];

const MATERIALS = {
  'Cigarette Paper': '4813100000',
  'Tipping Paper': '4813200000',
  Plugwrap: '4813900000',
  'Filter Tow': '5502100000',
  'Filter Rods': '5601220000',
  Adhesive: '3506910000',
  Capsules: '3926909990',
  Plasticizer: '2917125000',
  Adsorbent: '3802100000',
  'Board Packaging': '4819100000',
  'Paper Packaging': '4819200000',
  'Inner Bundling': '4811900000',
  'Board Inner Frame': '4819100000'
};

const COUNTRIES = [
  // Non-EU countries
  'CN', 'MX', 'CA', 'AU', 'CL', 'CO', 'KR', 'SG', 'HN', 'JP',
  'CH', 'GB', 'IN', 'ID', 'VN', 'TH', 'MY', 'BR', 'AR', 'TR',
  'ZA', 'EG', 'AE', 'NO', 'PK', 'BD', 'LK',
  // EU countries
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

const RESET_EXISTING = process.env.RESET_EXISTING !== 'false';
const DRY_RUN = process.env.DRY_RUN === 'true';

function assertEnv() {
  const missing = REQUIRED_ENVS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? safeParseJson(text) : null;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url} -> ${text.slice(0, 400)}`);
  }

  return data;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWoveToken() {
  const response = await requestJson('https://api.wove.com/api/v1/external/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.WOVE_CLIENT_ID,
      client_secret: process.env.WOVE_CLIENT_SECRET
    })
  });

  if (!response || !response.access_token) {
    throw new Error('Wove token response missing access_token');
  }
  return response.access_token;
}

async function getWoveRate(token, hsCode, country) {
  const url = `https://api.wove.com/api/v1/external/tariffs/lookup?hsCode=${hsCode}&originCountry=${country}&destinationCountry=US&includeFtaOptions=true`;
  const response = await requestJson(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response || !response.success || !response.data) return null;

  const data = response.data;
  if (data.ftaOptions?.[0]?.adValoremRate !== undefined) {
    return { rate: data.ftaOptions[0].adValoremRate, rateType: 'FTA' };
  }
  if (data.applicableRate?.adValoremRate !== undefined) {
    const hasAdditional = Array.isArray(data.additionalDuties) && data.additionalDuties.length > 0;
    return { rate: data.applicableRate.adValoremRate, rateType: hasAdditional ? 'MFN+Additional' : 'MFN' };
  }
  return null;
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function clearExistingRows() {
  const deleteUrl = `${process.env.SUPABASE_URL}/rest/v1/duty_rates?destination=eq.US&source=eq.WOVE`;
  await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal'
    }
  });
}

async function insertRate(country, material, hsCode, rate, rateType) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/duty_rates`;
  const body = JSON.stringify({
    country_iso: country,
    destination: 'US',
    material,
    cn_code: hsCode,
    rate,
    rate_type: rateType,
    source: 'WOVE'
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=minimal'
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${errorBody.slice(0, 400)}`);
  }
}

async function main() {
  assertEnv();

  console.log('Starting duty rate sync to Supabase...');
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'WRITE'}`);

  if (RESET_EXISTING) {
    console.log('Clearing existing WOVE US rows...');
    if (!DRY_RUN) {
      await clearExistingRows();
    }
  }

  console.log('Getting Wove token...');
  const token = await getWoveToken();
  console.log('Token obtained');

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const country of COUNTRIES) {
    console.log(`\n=== ${country} ===`);

    for (const [material, hsCode] of Object.entries(MATERIALS)) {
      try {
        const rateData = await getWoveRate(token, hsCode, country);
        if (!rateData) {
          skipped += 1;
          console.log(`  SKIP: ${material} (no rate in Wove response)`);
          continue;
        }

        if (!DRY_RUN) {
          await insertRate(country, material, hsCode, rateData.rate, rateData.rateType);
        }
        success += 1;
        console.log(`  OK: ${material} = ${rateData.rate}% (${rateData.rateType})`);
      } catch (error) {
        errors += 1;
        console.log(`  ERROR: ${material} - ${error.message}`);
      }

      await sleep(75);
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
  console.error('Fatal sync error:', error.message);
  process.exit(1);
});
