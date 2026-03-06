(function boot() {
  const data = window.PMI_DATA;
  if (!data) {
    document.body.innerHTML = '<main><p>PMI dataset failed to load.</p></main>';
    return;
  }

  const byId = (id) => document.getElementById(id);
  const sourceMap = new Map(data.sources.map((src) => [src.id, src]));

  let pmiMap = null;
  let compareMap = null;
  let compareVolumeChart = null;
  let compareGrowthChart = null;
  let compareInputVolChart = null;

  const asDate = new Date(data.asOfDate + 'T00:00:00');
  byId('as-of-date').textContent = Number.isNaN(asDate.getTime())
    ? data.asOfDate
    : asDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  byId('hero-focus').textContent = data.focus;
  byId('hero-caveat').textContent = data.caveat;
  byId('comparator-caveat').textContent = data.comparators.caveat;

  renderKpis(data.kpis, sourceMap);
  renderVolumeChart(data.volumeTrend);
  renderTradeSignals(data.tradeSignals, sourceMap);
  renderFactories(data.factories, sourceMap);
  renderMaterials(data.materials, sourceMap);

  renderComparatorCards(data.comparators.companies, sourceMap);
  renderComparisonTable(data.comparators.companies, sourceMap);
  renderComparatorDisclosureList(data.comparators.companies, sourceMap);
  renderComparatorSiteList(data.comparators.mapSites, sourceMap);
  renderInputComparison(data.comparators.inputComparison, sourceMap);
  renderInputVolatilityCards(data.comparators.inputVolatility.rows, sourceMap);
  renderInputVolatilityTable(data.comparators.inputVolatility.rows, sourceMap);
  byId('input-volatility-method').textContent =
    `${data.comparators.inputVolatility.method} As-of month: ${data.comparators.inputVolatility.asOfMonth}.`;

  renderSources(data.sources);

  setupTabs();
  setupExports();

  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-target');
        if (!target) return;

        tabButtons.forEach((other) => other.classList.remove('active'));
        button.classList.add('active');

        document.querySelectorAll('.tab-view').forEach((view) => view.classList.remove('active'));
        const activeView = byId(target);
        if (activeView) activeView.classList.add('active');

        if (target === 'compare-view') {
          initCompareVisuals();
        }

        if (target === 'pmi-view' && pmiMap) {
          setTimeout(() => pmiMap.invalidateSize(), 90);
        }
      });
    });
  }

  function setupExports() {
    const csvButton = byId('export-csv');
    if (csvButton) {
      csvButton.addEventListener('click', () => {
        const csv = buildCsvExport(data);
        downloadFile(
          `modern-oral-competitor-cockpit-${data.asOfDate}.csv`,
          csv,
          'text/csv;charset=utf-8;'
        );
      });
    }

    const pptButton = byId('export-ppt');
    if (pptButton) {
      pptButton.addEventListener('click', () => {
        buildPowerPoint(data);
      });
    }
  }

  function initCompareVisuals() {
    if (!compareVolumeChart) {
      compareVolumeChart = renderCompareVolumeChart(data.comparators.volumeSeries);
    }

    if (!compareGrowthChart) {
      compareGrowthChart = renderCompareGrowthChart(data.comparators.growthSeriesIndex);
    }

    if (!compareInputVolChart) {
      compareInputVolChart = renderInputVolatilityChart(data.comparators.inputVolatility.rows);
    }

    if (!compareMap) {
      compareMap = renderCompareMap(data.comparators.mapSites);
    }

    if (compareMap) {
      setTimeout(() => compareMap.invalidateSize(), 90);
    }
  }

  function renderKpis(kpis, srcMap) {
    const root = byId('kpi-grid');
    root.innerHTML = kpis
      .map((kpi, index) => {
        const delayClass = index > 1 ? 'd2' : 'd1';
        return `
          <article class="kpi-card fade-in ${delayClass}">
            <div class="kpi-label">${escapeHtml(kpi.label)}</div>
            <div class="kpi-value">${escapeHtml(kpi.value)}</div>
            <div class="kpi-detail">${escapeHtml(kpi.detail)}</div>
            <div class="kpi-delta">${escapeHtml(kpi.delta)}</div>
            ${renderRefs(kpi.sourceIds, srcMap)}
          </article>
        `;
      })
      .join('');
  }

  function renderVolumeChart(trend) {
    const canvas = byId('volume-chart');
    if (!canvas || !window.Chart) {
      byId('volume-chart-fallback').textContent = 'Chart library unavailable.';
      return null;
    }

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, 'rgba(11,106,121,0.35)');
    grad.addColorStop(1, 'rgba(11,106,121,0.03)');

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.map((x) => x.year),
        datasets: [
          {
            label: 'PMI Nicotine Pouches (million cans)',
            data: trend.map((x) => x.value),
            borderColor: '#0b6a79',
            pointBackgroundColor: '#1a936f',
            pointRadius: 5,
            borderWidth: 3,
            fill: true,
            backgroundColor: grad,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#193c49',
              font: { family: 'IBM Plex Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctxPoint) => `${ctxPoint.parsed.y.toFixed(1)} million cans`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: { color: '#425466' }
          },
          y: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: {
              color: '#425466',
              callback: (val) => `${val}M`
            }
          }
        }
      }
    });
  }

  function renderCompareVolumeChart(series) {
    const canvas = byId('compare-volume-chart');
    if (!canvas || !window.Chart) {
      byId('compare-volume-fallback').textContent = 'Chart library unavailable.';
      return null;
    }

    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.map((x) => x.year),
        datasets: [
          {
            label: 'PMI volume (million cans)',
            data: series.map((x) => x.pmi),
            borderColor: '#1764ab',
            backgroundColor: 'rgba(23,100,171,0.18)',
            pointBackgroundColor: '#1764ab',
            yAxisID: 'pmiAxis',
            tension: 0.25,
            borderWidth: 3
          },
          {
            label: 'BAT volume (billion pouches)',
            data: series.map((x) => x.bat),
            borderColor: '#0b6a79',
            backgroundColor: 'rgba(11,106,121,0.14)',
            pointBackgroundColor: '#0b6a79',
            yAxisID: 'batAxis',
            tension: 0.25,
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#193c49',
              font: { family: 'IBM Plex Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctxPoint) => {
                const label = ctxPoint.dataset.label || '';
                const val = ctxPoint.parsed.y;
                if (label.includes('PMI')) return `${label}: ${val.toFixed(1)} million cans`;
                return `${label}: ${val.toFixed(1)} billion pouches`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: { color: '#425466' }
          },
          pmiAxis: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: {
              color: '#1764ab',
              callback: (val) => `${val}`
            },
            title: {
              display: true,
              text: 'PMI (million cans)',
              color: '#1764ab'
            }
          },
          batAxis: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#0b6a79',
              callback: (val) => `${val}`
            },
            title: {
              display: true,
              text: 'BAT (billion pouches)',
              color: '#0b6a79'
            }
          }
        }
      }
    });
  }

  function renderCompareGrowthChart(series) {
    const canvas = byId('compare-growth-chart');
    if (!canvas || !window.Chart) {
      byId('compare-growth-fallback').textContent = 'Chart library unavailable.';
      return null;
    }

    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.map((x) => x.year),
        datasets: [
          {
            label: 'PMI growth index',
            data: series.map((x) => x.pmi),
            borderColor: '#1764ab',
            backgroundColor: 'rgba(23,100,171,0.16)',
            pointBackgroundColor: '#1764ab',
            borderWidth: 3,
            tension: 0.25,
            fill: false
          },
          {
            label: 'BAT growth index',
            data: series.map((x) => x.bat),
            borderColor: '#0b6a79',
            backgroundColor: 'rgba(11,106,121,0.16)',
            pointBackgroundColor: '#0b6a79',
            borderWidth: 3,
            tension: 0.25,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#193c49',
              font: { family: 'IBM Plex Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctxPoint) => `${ctxPoint.dataset.label}: ${ctxPoint.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: { color: '#425466' }
          },
          y: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: {
              color: '#425466',
              callback: (val) => `${val}`
            },
            title: {
              display: true,
              text: 'Index (2023 = 100)',
              color: '#425466'
            }
          }
        }
      }
    });
  }

  function renderInputVolatilityChart(rows) {
    const canvas = byId('input-volatility-chart');
    if (!canvas || !window.Chart) {
      byId('input-volatility-fallback').textContent = 'Chart library unavailable.';
      return null;
    }

    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map((x) => shortInputLabel(x.input)),
        datasets: [
          {
            label: '12M annualized vol %',
            data: rows.map((x) => x.vol12AnnualizedPercent),
            backgroundColor: 'rgba(23,100,171,0.75)',
            borderColor: '#1764ab',
            borderWidth: 1
          },
          {
            label: '24M annualized vol %',
            data: rows.map((x) => x.vol24AnnualizedPercent),
            backgroundColor: 'rgba(11,106,121,0.75)',
            borderColor: '#0b6a79',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#193c49',
              font: { family: 'IBM Plex Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctxPoint) => `${ctxPoint.dataset.label}: ${ctxPoint.parsed.y.toFixed(2)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: { color: '#425466' }
          },
          y: {
            grid: { color: 'rgba(25, 60, 73, 0.08)' },
            ticks: {
              color: '#425466',
              callback: (val) => `${val}%`
            },
            title: {
              display: true,
              text: 'Annualized volatility (%)',
              color: '#425466'
            }
          }
        }
      }
    });
  }

  function renderInputVolatilityCards(rows, srcMap) {
    const root = byId('input-volatility-cards');
    root.innerHTML = rows
      .map(
        (row) => `
        <article class="trade-item">
          <div class="trade-head">
            <strong>${escapeHtml(row.input)}</strong>
            <span class="confidence ${riskToConfidence(row.riskSignal)}">${escapeHtml(row.riskSignal)}</span>
          </div>
          <div class="muted">${escapeHtml(row.proxySeries)} (${escapeHtml(row.seriesCode)})</div>
          <p class="muted" style="margin:6px 0 0">
            12M vol: ${escapeHtml(row.vol12AnnualizedPercent.toFixed(2))}% | 24M vol: ${escapeHtml(
          row.vol24AnnualizedPercent.toFixed(2)
        )}% | YoY: ${escapeHtml(formatSignedPercent(row.yoyPercent))}
          </p>
          ${renderRefs(row.sourceIds, srcMap)}
        </article>
      `
      )
      .join('');
  }

  function renderInputVolatilityTable(rows, srcMap) {
    const body = byId('input-volatility-body');
    body.innerHTML = rows
      .map(
        (row) => `
        <tr>
          <td><strong>${escapeHtml(row.input)}</strong></td>
          <td>${escapeHtml(row.proxySeries)}</td>
          <td>${escapeHtml(row.seriesCode)}</td>
          <td>${escapeHtml(row.latestIndex.toFixed(3))}</td>
          <td>${escapeHtml(formatSignedPercent(row.yoyPercent))}</td>
          <td>${escapeHtml(row.vol12AnnualizedPercent.toFixed(2))}%</td>
          <td>${escapeHtml(row.vol24AnnualizedPercent.toFixed(2))}%</td>
          <td><span class="confidence ${riskToConfidence(row.riskSignal)}">${escapeHtml(row.riskSignal)}</span></td>
          <td>${renderRefs(row.sourceIds, srcMap)}</td>
        </tr>
      `
      )
      .join('');
  }

  function renderTradeSignals(signals, srcMap) {
    const root = byId('trade-signals');
    root.innerHTML = signals
      .map(
        (signal) => `
        <article class="trade-item">
          <div class="trade-head">
            <strong>${escapeHtml(signal.material)}</strong>
            <span class="trade-value">${escapeHtml(signal.value)}</span>
          </div>
          <div class="muted">${escapeHtml(signal.flow)}</div>
          <p class="muted" style="margin:6px 0 0">${escapeHtml(signal.note)}</p>
          ${renderRefs(signal.sourceIds, srcMap)}
        </article>
      `
      )
      .join('');
  }

  function renderFactories(factories, srcMap) {
    const listRoot = byId('factory-list');
    listRoot.innerHTML = factories
      .map(
        (f) => `
        <article class="factory-item">
          <div class="factory-head">
            <strong>${escapeHtml(f.name)}</strong>
            <span class="confidence ${escapeHtml(f.confidence)}">${escapeHtml(f.confidence)}</span>
          </div>
          <div class="muted">${escapeHtml(f.location)} | ${escapeHtml(f.category)} | ${escapeHtml(f.status)}</div>
          <p class="muted" style="margin:6px 0 0">${escapeHtml(f.note)}</p>
          ${renderRefs(f.sourceIds, srcMap)}
        </article>
      `
      )
      .join('');

    if (!window.L) {
      byId('factory-map').innerHTML = '<p style="padding:10px">Map library unavailable.</p>';
      return null;
    }

    pmiMap = L.map('factory-map', { zoomControl: true }).setView([34, -20], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(pmiMap);

    const points = [];
    factories.forEach((factory) => {
      if (typeof factory.lat !== 'number' || typeof factory.lon !== 'number') return;
      const marker = L.circleMarker([factory.lat, factory.lon], {
        radius: 7,
        weight: 1,
        color: markerColor(factory.confidence),
        fillColor: markerColor(factory.confidence),
        fillOpacity: 0.82
      }).addTo(pmiMap);
      marker.bindPopup(
        `<strong>${escapeHtml(factory.name)}</strong><br>${escapeHtml(factory.location)}<br>${escapeHtml(
          factory.category
        )}`
      );
      points.push([factory.lat, factory.lon]);
    });

    if (points.length > 1) {
      pmiMap.fitBounds(points, { padding: [24, 24] });
    }

    return pmiMap;
  }

  function renderMaterials(materials, srcMap) {
    const body = byId('materials-body');
    body.innerHTML = materials
      .map(
        (m) => `
        <tr>
          <td><strong>${escapeHtml(m.material)}</strong></td>
          <td>${escapeHtml(m.useCase)}</td>
          <td>${escapeHtml(m.pmiDisclosure)}</td>
          <td>${escapeHtml(
            Array.isArray(m.likelySourceCountries)
              ? m.likelySourceCountries.join(', ')
              : m.likelySourceCountries
          )}</td>
          <td>${escapeHtml(m.evidence)}</td>
          <td>
            <span class="confidence ${escapeHtml(m.confidence)}">${escapeHtml(m.confidence)}</span>
            ${renderRefs(m.sourceIds, srcMap)}
          </td>
        </tr>
      `
      )
      .join('');
  }

  function renderComparatorCards(companies, srcMap) {
    const root = byId('competitor-card-grid');
    root.innerHTML = companies
      .map(
        (item) => `
        <article class="kpi-card fade-in d2">
          <div class="trade-head">
            <strong>${escapeHtml(item.company)} (${escapeHtml(item.brand)})</strong>
            <span class="confidence ${escapeHtml(item.confidence)}">${escapeHtml(item.confidence)}</span>
          </div>
          <div class="kpi-value" style="font-size:1.35rem">${escapeHtml(item.oralVolume)}</div>
          <div class="kpi-detail">${escapeHtml(item.growth)}</div>
          <div class="kpi-delta">${escapeHtml(item.footprint)}</div>
          ${renderRefs(item.sourceIds, srcMap)}
        </article>
      `
      )
      .join('');
  }

  function renderComparisonTable(companies, srcMap) {
    const body = byId('comparison-body');
    body.innerHTML = companies
      .map(
        (item) => `
        <tr>
          <td><strong>${escapeHtml(item.company)}</strong></td>
          <td>${escapeHtml(item.brand)}</td>
          <td>${escapeHtml(item.oralVolume)}</td>
          <td>${escapeHtml(item.growth)}</td>
          <td>${escapeHtml(item.footprint)}</td>
          <td>${escapeHtml(item.factorySignal)}</td>
          <td>${escapeHtml(item.materialsDisclosure)}</td>
          <td>${escapeHtml(item.sourcingDisclosure)}</td>
          <td>
            <span class="confidence ${escapeHtml(item.confidence)}">${escapeHtml(item.confidence)}</span>
            ${renderRefs(item.sourceIds, srcMap)}
          </td>
        </tr>
      `
      )
      .join('');
  }

  function renderComparatorDisclosureList(companies, srcMap) {
    const root = byId('comparator-disclosure-list');
    root.innerHTML = companies
      .map(
        (item) => `
        <article class="trade-item">
          <div class="trade-head">
            <span class="company-badge ${escapeHtml(item.company)}">${escapeHtml(item.company)}</span>
            <span class="muted">${escapeHtml(item.brand)}</span>
          </div>
          <p class="muted" style="margin:8px 0 0"><strong>Share/volume signal:</strong> ${escapeHtml(item.shareSignal)}</p>
          ${renderRefs(item.sourceIds, srcMap)}
        </article>
      `
      )
      .join('');
  }

  function renderComparatorSiteList(sites, srcMap) {
    const root = byId('competitor-site-list');
    root.innerHTML = sites
      .map(
        (site) => `
        <article class="factory-item">
          <div class="factory-head">
            <span class="company-badge ${escapeHtml(site.company)}">${escapeHtml(site.company)}</span>
            <span class="confidence ${escapeHtml(site.confidence)}">${escapeHtml(site.confidence)}</span>
          </div>
          <div><strong>${escapeHtml(site.name)}</strong></div>
          <div class="muted">${escapeHtml(site.location)}</div>
          ${renderRefs(site.sourceIds, srcMap)}
        </article>
      `
      )
      .join('');
  }

  function renderInputComparison(rows, srcMap) {
    const body = byId('input-comparison-body');
    body.innerHTML = rows
      .map(
        (row) => `
        <tr>
          <td><strong>${escapeHtml(row.input)}</strong></td>
          <td>${escapeHtml(row.pmi)}</td>
          <td>${escapeHtml(row.bat)}</td>
          <td>${escapeHtml(row.implication)}</td>
          <td>${renderRefs(row.sourceIds, srcMap)}</td>
        </tr>
      `
      )
      .join('');
  }

  function renderCompareMap(sites) {
    if (!window.L) {
      byId('competitor-map').innerHTML = '<p style="padding:10px">Map library unavailable.</p>';
      return null;
    }

    const map = L.map('competitor-map', { zoomControl: true }).setView([42, 4], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const points = [];
    sites.forEach((site) => {
      if (typeof site.lat !== 'number' || typeof site.lon !== 'number') return;
      const color = companyColor(site.company);
      const marker = L.circleMarker([site.lat, site.lon], {
        radius: 7,
        weight: 1,
        color,
        fillColor: color,
        fillOpacity: 0.86
      }).addTo(map);

      marker.bindPopup(
        `<strong>${escapeHtml(site.company)}</strong><br>${escapeHtml(site.name)}<br>${escapeHtml(site.location)}`
      );
      points.push([site.lat, site.lon]);
    });

    if (points.length > 1) {
      map.fitBounds(points, { padding: [24, 24] });
    }

    return map;
  }

  function renderSources(sources) {
    const root = byId('sources-list');
    root.innerHTML = sources
      .map(
        (src) => `
        <article class="source-item" id="source-${escapeHtml(src.id)}">
          <h4>[${escapeHtml(src.id)}] ${escapeHtml(src.title)}</h4>
          <div class="source-meta">${escapeHtml(src.type)} | ${escapeHtml(src.publisher)} | ${escapeHtml(src.date)}</div>
          <div class="source-link"><a href="${escapeAttr(src.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.url)}</a></div>
        </article>
      `
      )
      .join('');
  }

  function renderRefs(sourceIds, srcMap) {
    if (!Array.isArray(sourceIds) || !sourceIds.length) return '';
    const chips = sourceIds
      .filter((id) => srcMap.has(id))
      .map((id) => `<a class="ref-chip" href="#source-${escapeHtml(id)}">${escapeHtml(id)}</a>`)
      .join('');
    return chips ? `<div class="refs">${chips}</div>` : '';
  }

  function markerColor(confidence) {
    if (confidence === 'high') return '#146356';
    if (confidence === 'medium') return '#9d7e12';
    return '#9b2c2c';
  }

  function companyColor(company) {
    if (company === 'PMI') return '#1764ab';
    if (company === 'BAT') return '#0b6a79';
    return '#44576b';
  }

  function riskToConfidence(signal) {
    if (signal === 'high') return 'high';
    if (signal === 'medium') return 'medium';
    return 'low';
  }

  function formatSignedPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'N/A';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  }

  function shortInputLabel(label) {
    if (label.includes('Polymer')) return 'Polymer';
    if (label.includes('Nicotine')) return 'Nicotine';
    if (label.includes('Nonwoven')) return 'Nonwoven';
    if (label.includes('Cellulose')) return 'Cellulose';
    return label;
  }

  function buildCsvExport(payload) {
    const rows = [
      ['section', 'company', 'metric', 'value', 'detail', 'confidence', 'source_ids', 'source_urls']
    ];

    payload.kpis.forEach((kpi) => {
      rows.push([
        'pmi_kpi',
        'PMI',
        kpi.label,
        kpi.value,
        `${kpi.detail}; ${kpi.delta}`,
        'high',
        joinSourceIds(kpi.sourceIds),
        joinSourceUrls(kpi.sourceIds)
      ]);
    });

    payload.materials.forEach((mat) => {
      rows.push([
        'pmi_material',
        'PMI',
        mat.material,
        Array.isArray(mat.likelySourceCountries)
          ? mat.likelySourceCountries.join(' | ')
          : mat.likelySourceCountries,
        `${mat.useCase}; ${mat.evidence}`,
        mat.confidence,
        joinSourceIds(mat.sourceIds),
        joinSourceUrls(mat.sourceIds)
      ]);
    });

    payload.comparators.volumeSeries.forEach((row) => {
      rows.push([
        'bat_vs_pmi_volume',
        'PMI|BAT',
        `Volume horizon ${row.year}`,
        `PMI ${row.pmi} million cans; BAT ${row.bat} billion pouches`,
        'Dual-axis disclosed volumes',
        'high',
        joinSourceIds(row.sourceIds),
        joinSourceUrls(row.sourceIds)
      ]);
    });

    payload.comparators.growthSeriesIndex.forEach((row) => {
      rows.push([
        'bat_vs_pmi_growth_index',
        'PMI|BAT',
        `Growth index ${row.year}`,
        `PMI ${row.pmi}; BAT ${row.bat}`,
        'Index baseline 2023 = 100',
        'high',
        joinSourceIds(row.sourceIds),
        joinSourceUrls(row.sourceIds)
      ]);
    });

    payload.comparators.companies.forEach((company) => {
      rows.push([
        'bat_vs_pmi_snapshot',
        company.company,
        'comparison_snapshot',
        company.oralVolume,
        `Growth: ${company.growth}; Footprint: ${company.footprint}; Materials: ${company.materialsDisclosure}; Sourcing: ${company.sourcingDisclosure}`,
        company.confidence,
        joinSourceIds(company.sourceIds),
        joinSourceUrls(company.sourceIds)
      ]);
    });

    payload.comparators.inputComparison.forEach((item) => {
      rows.push([
        'bat_vs_pmi_inputs',
        'PMI|BAT',
        item.input,
        `PMI: ${item.pmi}`,
        `BAT: ${item.bat}; Implication: ${item.implication}`,
        'medium',
        joinSourceIds(item.sourceIds),
        joinSourceUrls(item.sourceIds)
      ]);
    });

    payload.comparators.inputVolatility.rows.forEach((row) => {
      rows.push([
        'input_price_volatility',
        'PMI|BAT',
        row.input,
        `${row.proxySeries} (${row.seriesCode})`,
        `Latest index ${row.latestIndex}; YoY ${formatSignedPercent(
          row.yoyPercent
        )}; 12M vol ${row.vol12AnnualizedPercent}% ; 24M vol ${row.vol24AnnualizedPercent}%`,
        row.riskSignal,
        joinSourceIds(row.sourceIds),
        joinSourceUrls(row.sourceIds)
      ]);
    });

    payload.sources.forEach((src) => {
      rows.push([
        'source_register',
        '',
        src.id,
        src.title,
        `${src.type}; ${src.publisher}; ${src.date}`,
        '',
        src.id,
        src.url
      ]);
    });

    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');

    function joinSourceIds(ids) {
      if (!Array.isArray(ids) || !ids.length) return '';
      return ids.join('|');
    }

    function joinSourceUrls(ids) {
      if (!Array.isArray(ids) || !ids.length) return '';
      return ids
        .map((id) => sourceMap.get(id))
        .filter(Boolean)
        .map((src) => src.url)
        .join('|');
    }
  }

  function buildPowerPoint(payload) {
    const PptxCtor = window.PptxGenJS;
    if (!PptxCtor) {
      alert('PowerPoint library is unavailable.');
      return;
    }

    const pptx = new PptxCtor();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Modern Oral Competitor Cockpit';
    pptx.subject = 'PMI / BAT public intelligence';
    pptx.title = `Modern Oral Competitor Cockpit (${payload.asOfDate})`;

    const slide1 = pptx.addSlide();
    slide1.background = { color: '0B6A79' };
    slide1.addText('Modern Oral Competitor Cockpit', {
      x: 0.6,
      y: 0.65,
      w: 11.8,
      h: 0.6,
      color: 'F4FFFC',
      fontSize: 32,
      bold: true,
      fontFace: 'Calibri'
    });
    slide1.addText(`As of ${payload.asOfDate}`, {
      x: 0.6,
      y: 1.35,
      w: 5.2,
      h: 0.3,
      color: 'D8F8F1',
      fontSize: 16,
      fontFace: 'Calibri'
    });
    slide1.addText('Scope: PMI deep dive + BAT vs PMI comparison', {
      x: 0.6,
      y: 1.85,
      w: 8.4,
      h: 0.34,
      color: 'E7FFFA',
      fontSize: 14,
      fontFace: 'Calibri'
    });

    const slide2 = pptx.addSlide();
    slide2.addText('PMI KPI Snapshot', {
      x: 0.4,
      y: 0.22,
      w: 6.0,
      h: 0.4,
      fontSize: 22,
      bold: true,
      color: '0F1724'
    });
    const kpiRows = [['Metric', 'Value', 'Detail']];
    payload.kpis.slice(0, 7).forEach((kpi) => {
      kpiRows.push([kpi.label, kpi.value, `${kpi.detail}; ${kpi.delta}`]);
    });
    slide2.addTable(kpiRows, {
      x: 0.4,
      y: 0.8,
      w: 12.5,
      h: 5.9,
      fontSize: 11,
      border: { type: 'solid', color: 'D5E3DE', pt: 1 },
      fill: 'FFFFFF'
    });

    const slide3 = pptx.addSlide();
    slide3.addText('BAT vs PMI Comparison Snapshot', {
      x: 0.4,
      y: 0.22,
      w: 10.8,
      h: 0.4,
      fontSize: 20,
      bold: true,
      color: '0F1724'
    });
    const compareRows = [['Company', 'Volume (2025)', 'Growth', 'Footprint', 'Sourcing Transparency']];
    payload.comparators.companies.forEach((c) => {
      compareRows.push([c.company, c.oralVolume, c.growth, c.footprint, c.sourcingDisclosure]);
    });
    slide3.addTable(compareRows, {
      x: 0.4,
      y: 0.8,
      w: 12.5,
      h: 5.7,
      fontSize: 10,
      border: { type: 'solid', color: 'D5E3DE', pt: 1 },
      fill: 'FFFFFF'
    });

    const slide4 = pptx.addSlide();
    slide4.addText('Raw Material / Input Comparison', {
      x: 0.4,
      y: 0.22,
      w: 10.4,
      h: 0.4,
      fontSize: 20,
      bold: true,
      color: '0F1724'
    });
    const inputRows = [['Input', 'PMI', 'BAT', 'Implication']];
    payload.comparators.inputComparison.slice(0, 6).forEach((row) => {
      inputRows.push([row.input, row.pmi, row.bat, row.implication]);
    });
    slide4.addTable(inputRows, {
      x: 0.4,
      y: 0.8,
      w: 12.5,
      h: 5.8,
      fontSize: 9,
      border: { type: 'solid', color: 'D5E3DE', pt: 1 },
      fill: 'FFFFFF'
    });

    const slide5 = pptx.addSlide();
    slide5.addText('Input Price Volatility (Public Proxies)', {
      x: 0.4,
      y: 0.22,
      w: 10.8,
      h: 0.4,
      fontSize: 20,
      bold: true,
      color: '0F1724'
    });
    const volRows = [['Input', 'Proxy Series', 'YoY %', '12M Vol %', '24M Vol %', 'Risk']];
    payload.comparators.inputVolatility.rows.forEach((row) => {
      volRows.push([
        row.input,
        `${row.proxySeries} (${row.seriesCode})`,
        formatSignedPercent(row.yoyPercent),
        `${row.vol12AnnualizedPercent.toFixed(2)}%`,
        `${row.vol24AnnualizedPercent.toFixed(2)}%`,
        row.riskSignal
      ]);
    });
    slide5.addTable(volRows, {
      x: 0.4,
      y: 0.8,
      w: 12.5,
      h: 5.8,
      fontSize: 9.5,
      border: { type: 'solid', color: 'D5E3DE', pt: 1 },
      fill: 'FFFFFF'
    });

    const slide6 = pptx.addSlide();
    slide6.addText('Source Register (Top References)', {
      x: 0.4,
      y: 0.22,
      w: 10.2,
      h: 0.4,
      fontSize: 20,
      bold: true,
      color: '0F1724'
    });
    payload.sources.slice(0, 14).forEach((src, idx) => {
      slide6.addText(`[${src.id}] ${src.title}`, {
        x: 0.45,
        y: 0.8 + idx * 0.38,
        w: 12.4,
        h: 0.3,
        fontSize: 9.5,
        color: '1A3340'
      });
    });

    pptx.writeFile({ fileName: `modern-oral-competitor-cockpit-${payload.asOfDate}.pptx` });
  }

  function downloadFile(fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const str = String(value == null ? '' : value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/`/g, '&#96;');
  }
})();
