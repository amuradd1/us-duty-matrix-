/**
 * Tariff Data Update Checker
 *
 * This script checks official US government sources for tariff updates:
 * 1. USITC HTS Database (via data.gov catalog)
 * 2. CBP IEEPA FAQ page
 * 3. USTR Presidential Tariff Actions
 *
 * Run: node scripts/check-tariff-updates.js
 */

const fs = require('fs');
const path = require('path');

// Store last check state
const STATE_FILE = path.join(__dirname, '.tariff-check-state.json');

// Official source URLs
const SOURCES = {
  hts_catalog: 'https://catalog.data.gov/dataset/harmonized-tariff-schedule-of-the-united-states-2024',
  cbp_ieepa: 'https://www.cbp.gov/trade/programs-administration/trade-remedies/IEEPA-FAQ',
  ustr_tariffs: 'https://ustr.gov/trade-topics/presidential-tariff-actions',
  cbp_csms: 'https://www.cbp.gov/trade/automated/cargo-systems-messaging-service',
  whitehouse_annex: 'https://www.whitehouse.gov/wp-content/uploads/2025/04/Annex-I.pdf'
};

// Load previous state
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('No previous state found, starting fresh');
  }
  return {
    lastCheck: null,
    htsVersion: null,
    lastModified: {}
  };
}

// Save current state
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Fetch page and check for updates
async function checkSource(url, name) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'TariffDataChecker/1.0 (GitHub Actions)'
      }
    });

    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');

    return {
      name,
      url,
      status: response.status,
      lastModified,
      etag,
      accessible: response.ok
    };
  } catch (error) {
    return {
      name,
      url,
      status: 'error',
      error: error.message,
      accessible: false
    };
  }
}

// Check HTS catalog for new versions
async function checkHTSCatalog() {
  try {
    const response = await fetch(SOURCES.hts_catalog, {
      headers: {
        'User-Agent': 'TariffDataChecker/1.0 (GitHub Actions)'
      }
    });
    const html = await response.text();

    // Look for revision information in the page
    const revisionMatch = html.match(/hts_(\d{4})_revision_(\d+)/i);
    const lastUpdatedMatch = html.match(/Last Updated[:\s]+([A-Za-z]+ \d+, \d{4})/i);

    return {
      name: 'HTS Catalog',
      url: SOURCES.hts_catalog,
      currentVersion: revisionMatch ? `${revisionMatch[1]} Rev ${revisionMatch[2]}` : 'Unknown',
      lastUpdated: lastUpdatedMatch ? lastUpdatedMatch[1] : 'Unknown',
      accessible: true
    };
  } catch (error) {
    return {
      name: 'HTS Catalog',
      url: SOURCES.hts_catalog,
      error: error.message,
      accessible: false
    };
  }
}

// Check CBP IEEPA FAQ for updates
async function checkCBPIEEPA() {
  try {
    const response = await fetch(SOURCES.cbp_ieepa, {
      headers: {
        'User-Agent': 'TariffDataChecker/1.0 (GitHub Actions)'
      }
    });
    const html = await response.text();

    // Look for CSMS message references (they indicate updates)
    const csmsMatches = html.match(/CSMS\s*#?\s*(\d+)/gi) || [];
    const uniqueCSMS = [...new Set(csmsMatches)];

    // Look for last updated date
    const lastUpdatedMatch = html.match(/last\s+updated[:\s]+([A-Za-z]+ \d+,?\s*\d{4})/i);

    return {
      name: 'CBP IEEPA FAQ',
      url: SOURCES.cbp_ieepa,
      csmsReferences: uniqueCSMS.slice(0, 5), // Latest 5
      lastUpdated: lastUpdatedMatch ? lastUpdatedMatch[1] : 'Unknown',
      accessible: true
    };
  } catch (error) {
    return {
      name: 'CBP IEEPA FAQ',
      url: SOURCES.cbp_ieepa,
      error: error.message,
      accessible: false
    };
  }
}

// Main check function
async function main() {
  console.log('=== Tariff Data Update Check ===');
  console.log(`Check Time: ${new Date().toISOString()}\n`);

  const state = loadState();
  const results = [];
  let updatesFound = false;
  const changes = [];

  // Check HTS Catalog
  console.log('Checking USITC HTS Catalog...');
  const htsResult = await checkHTSCatalog();
  results.push(htsResult);

  if (htsResult.accessible) {
    console.log(`  Current Version: ${htsResult.currentVersion}`);
    console.log(`  Last Updated: ${htsResult.lastUpdated}`);

    if (state.htsVersion && state.htsVersion !== htsResult.currentVersion) {
      updatesFound = true;
      changes.push(`HTS version changed: ${state.htsVersion} -> ${htsResult.currentVersion}`);
    }
    state.htsVersion = htsResult.currentVersion;
  }

  // Check CBP IEEPA FAQ
  console.log('\nChecking CBP IEEPA FAQ...');
  const cbpResult = await checkCBPIEEPA();
  results.push(cbpResult);

  if (cbpResult.accessible) {
    console.log(`  CSMS References: ${cbpResult.csmsReferences.join(', ')}`);
    console.log(`  Last Updated: ${cbpResult.lastUpdated}`);

    if (state.lastCSMS && cbpResult.csmsReferences[0] !== state.lastCSMS) {
      updatesFound = true;
      changes.push(`New CSMS message detected: ${cbpResult.csmsReferences[0]}`);
    }
    state.lastCSMS = cbpResult.csmsReferences[0];
  }

  // Check other sources (HEAD request for last-modified)
  console.log('\nChecking other sources...');
  for (const [key, url] of Object.entries(SOURCES)) {
    if (key !== 'hts_catalog' && key !== 'cbp_ieepa') {
      const result = await checkSource(url, key);
      results.push(result);
      console.log(`  ${key}: ${result.accessible ? 'OK' : 'Error'}`);

      if (result.lastModified) {
        if (state.lastModified[key] && state.lastModified[key] !== result.lastModified) {
          updatesFound = true;
          changes.push(`${key} page modified: ${result.lastModified}`);
        }
        state.lastModified[key] = result.lastModified;
      }
    }
  }

  // Update state
  state.lastCheck = new Date().toISOString();
  saveState(state);

  // Output for GitHub Actions
  console.log('\n=== Summary ===');
  console.log(`Updates Found: ${updatesFound}`);
  if (changes.length > 0) {
    console.log('Changes:');
    changes.forEach(c => console.log(`  - ${c}`));
  }

  // Set GitHub Actions outputs
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `updates_found=${updatesFound}\n`);
    fs.appendFileSync(outputFile, `update_summary=${changes.join('; ') || 'No changes'}\n`);
    fs.appendFileSync(outputFile, `changes_detail=${changes.map(c => `- ${c}`).join('\\n') || 'No changes detected'}\n`);
  }

  // Also output to console for local testing
  console.log(`\n::set-output name=updates_found::${updatesFound}`);

  return {
    updatesFound,
    changes,
    results
  };
}

main().catch(console.error);
