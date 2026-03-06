window.PMI_DATA = {
  asOfDate: '2026-02-26',
  focus: 'Philip Morris International (PMI) modern oral / nicotine pouch intelligence cockpit',
  caveat:
    'PMI does not publicly disclose full supplier-country mapping by pouch input. Material origins below combine direct PMI disclosures with trade-flow indicators and are confidence-scored.',
  kpis: [
    {
      id: 'global_pouch_2025',
      label: 'Global nicotine pouch shipments (2025)',
      value: '879.6M',
      detail: 'cans/can-equivalent units',
      delta: '+36.6% vs 2024',
      sourceIds: ['s1']
    },
    {
      id: 'global_pouch_growth',
      label: 'Nicotine pouch growth (2025 vs 2024)',
      value: '+36.6%',
      detail: 'from 644.0M to 879.6M',
      delta: 'Strong double-digit expansion',
      sourceIds: ['s1']
    },
    {
      id: 'us_zyn_2025',
      label: 'U.S. ZYN shipment volume (2025)',
      value: '794M',
      detail: 'cans shipped in U.S.',
      delta: '+37% YoY (company disclosures)',
      sourceIds: ['s2', 's3']
    },
    {
      id: 'pouch_markets',
      label: 'PMI nicotine pouch market footprint',
      value: '56',
      detail: 'markets with nicotine pouch availability',
      delta: 'As of Dec 31, 2025',
      sourceIds: ['s1']
    },
    {
      id: 'oral_factories',
      label: 'Oral smoke-free factories',
      value: '10',
      detail: 'PMI global oral smoke-free manufacturing facilities',
      delta: 'largest facility located in the U.S.',
      sourceIds: ['s1']
    },
    {
      id: 'oral_net_revenue',
      label: 'Oral smoke-free net revenues (2025)',
      value: '$4.03B',
      detail: 'PMI oral smoke-free net revenues',
      delta: '+53.2% YoY',
      sourceIds: ['s1']
    },
    {
      id: 'sf_users',
      label: 'PMI smoke-free users',
      value: '43.2M',
      detail: 'estimated adult users',
      delta: 'As of Dec 31, 2025',
      sourceIds: ['s1']
    }
  ],
  volumeTrend: [
    { year: 2023, value: 421.1, unit: 'million cans', sourceIds: ['s1'] },
    { year: 2024, value: 644.0, unit: 'million cans', sourceIds: ['s1'] },
    { year: 2025, value: 879.6, unit: 'million cans', sourceIds: ['s1'] }
  ],
  factories: [
    {
      name: 'Owensboro Site',
      location: 'Owensboro, Kentucky, USA',
      lat: 37.7719,
      lon: -87.1112,
      category: 'Nicotine pouch manufacturing',
      status: 'Operating',
      note:
        'PMI identifies Owensboro as an existing smoke-free manufacturing site; annual report states the largest oral smoke-free facility is in the U.S.',
      confidence: 'high',
      sourceIds: ['s1', 's4']
    },
    {
      name: 'Aurora Site',
      location: 'Aurora, Colorado, USA',
      lat: 39.7294,
      lon: -104.8319,
      category: 'Nicotine pouch manufacturing expansion',
      status: 'Ramp-up',
      note:
        'USD 600M investment. Initial operations started late 2025, full regular production expected during 2026; projected annual capacity up to 550M cans.',
      confidence: 'high',
      sourceIds: ['s4']
    },
    {
      name: 'Wilson Site',
      location: 'Wilson, North Carolina, USA',
      lat: 35.7213,
      lon: -77.9155,
      category: 'Smoke-free manufacturing site',
      status: 'Operating',
      note:
        'Publicly identified by PMI as an existing smoke-free manufacturing location in the U.S.',
      confidence: 'medium',
      sourceIds: ['s4']
    },
    {
      name: 'Swedish Match manufacturing footprint',
      location: 'Sweden, Denmark, Netherlands, Dominican Republic, Philippines, Brazil, U.S.',
      lat: 58.9,
      lon: 13.8,
      category: 'Multi-country manufacturing footprint',
      status: 'Operating',
      note:
        'Swedish Match public profile states production facilities across these countries; not all sites are necessarily nicotine pouch lines.',
      confidence: 'medium',
      sourceIds: ['s11']
    }
  ],
  materials: [
    {
      material: 'Resin (plastic cans and lids)',
      useCase: 'Primary pouch container and lid components',
      pmiDisclosure:
        'PMI lists plastic cans and lids as direct materials for oral smoke-free products.',
      likelySourceCountries: ['India', 'Philippines'],
      evidence:
        'Trade-profile indicators for Swedish Match North Europe AB include significant HS 3923 activity (plastic packing articles) from these origins.',
      confidence: 'low',
      sourceIds: ['s1', 's8']
    },
    {
      material: 'Nicotine liquid / nicotine salt premix',
      useCase: 'Nicotine active ingredient in pouch filling',
      pmiDisclosure:
        'PMI lists nicotine salt and premix as direct materials. ZYN disclosures list nicotine bitartrate dihydrate as active ingredient.',
      likelySourceCountries: ['India', 'Philippines'],
      evidence:
        'Trade-profile indicators show HS 2939 (alkaloids, incl. nicotine and derivatives) in Swedish Match North Europe AB imports. PMI does not name suppliers publicly.',
      confidence: 'low',
      sourceIds: ['s1', 's8', 's15']
    },
    {
      material: 'MCC (microcrystalline cellulose)',
      useCase: 'Pouch filler/carrier substrate',
      pmiDisclosure: 'ZYN ingredient disclosure lists microcrystalline cellulose.',
      likelySourceCountries: ['Not publicly disclosed'],
      evidence:
        'Ingredient is confirmed, but no PMI public disclosure was found mapping MCC supplier countries.',
      confidence: 'medium',
      sourceIds: ['s15']
    },
    {
      material: 'Fleece / pouch nonwoven material',
      useCase: 'Outer pouch wrapper material',
      pmiDisclosure: 'PMI lists pouch material as a direct oral input.',
      likelySourceCountries: ['Germany', 'United Kingdom'],
      evidence:
        'Customs records for Swedish Match North America show recurring nonwoven/fleece-like shipments, including PELY-TEX GmbH (DE) and Glatfelter Lydney Ltd (UK).',
      confidence: 'medium',
      sourceIds: ['s1', 's6', 's7']
    }
  ],
  tradeSignals: [
    {
      material: 'Fleece / nonwoven (HS 5603)',
      flow: 'Germany -> United States',
      value: '$615.5M (2023)',
      note:
        'Macro trade flow for nonwovens to U.S.; not PMI-specific but useful context for supplier-base concentration.',
      sourceIds: ['s9']
    },
    {
      material: 'Fleece / nonwoven (HS 5603)',
      flow: 'United Kingdom -> United States',
      value: '$117.4M (2023)',
      note: 'Supports UK as a meaningful nonwoven export source into U.S. market.',
      sourceIds: ['s10']
    },
    {
      material: 'Nonwoven/pouch inputs (company-level indicator)',
      flow: 'Pely-Tex GmbH (DE) -> Swedish Match North America',
      value: '1,887 shipments since 2022',
      note: 'Shipment count from public customs aggregator profile.',
      sourceIds: ['s6']
    },
    {
      material: 'Nonwoven/pouch inputs (company-level indicator)',
      flow: 'Glatfelter Lydney Ltd (UK) -> Swedish Match North America',
      value: '577 shipments since 2022',
      note: 'Shipment count from public customs aggregator profile.',
      sourceIds: ['s6']
    }
  ],
  comparators: {
    caveat:
      'BAT and PMI disclose oral volume in different units (BAT: billion pouches; PMI: million cans/can-equivalent). The volume chart uses dual axes; growth index normalizes both series to 2023=100. PMI 2022 is structurally low because Swedish Match was acquired late 2022. Input volatility uses public BLS PPI proxies via FRED and reflects market proxies, not company-specific purchase prices.',
    companies: [
      {
        company: 'PMI',
        brand: 'ZYN',
        oralVolume: '879.6M cans/can-equivalent units (2025)',
        growth: '+36.6% YoY (2025 vs 2024)',
        footprint: '56 nicotine pouch markets (Dec 2025)',
        shareSignal: 'U.S. ZYN shipments 794M cans in 2025 (+37% YoY)',
        factorySignal:
          '10 oral smoke-free factories globally; largest facility in U.S.; Aurora expansion ramping in 2026.',
        materialsDisclosure:
          'Direct oral inputs include nicotine salt/premix, plastic cans/lids, pouch material.',
        sourcingDisclosure:
          'No full supplier-country disclosure; partial customs indicators suggest DE/UK nonwoven links and IND/PHL signals for some inputs.',
        confidence: 'high',
        sourceIds: ['s1', 's3', 's4', 's6', 's7', 's8']
      },
      {
        company: 'BAT',
        brand: 'VELO',
        oralVolume: '12.2B pouches (2025)',
        growth: '+47.1% YoY volume; +47.4% YoY category revenue (2025)',
        footprint: '49 Modern Oral markets (2025)',
        shareSignal: 'U.S. modern oral volume share 18.0% in 2025.',
        factorySignal:
          'Pecs modern oral factory + Trieste facility for added capacity in Modern Oral and Heated Products.',
        materialsDisclosure:
          'Discloses high-purity nicotine, water, cellulose-based filler, flavours, and fleece-wrapped pouch format.',
        sourcingDisclosure:
          'No country-by-country supplier disclosure for nicotine, fibres, resin or pouch substrate.',
        confidence: 'high',
        sourceIds: ['s12', 's13', 's14', 's16']
      }
    ],
    volumeSeries: [
      {
        year: 2022,
        pmi: 42.5,
        bat: 4.0,
        pmiUnit: 'million cans',
        batUnit: 'billion pouches',
        sourceIds: ['s16', 's21']
      },
      {
        year: 2023,
        pmi: 421.1,
        bat: 5.4,
        pmiUnit: 'million cans',
        batUnit: 'billion pouches',
        sourceIds: ['s1', 's16']
      },
      {
        year: 2024,
        pmi: 644.0,
        bat: 8.3,
        pmiUnit: 'million cans',
        batUnit: 'billion pouches',
        sourceIds: ['s1', 's14']
      },
      {
        year: 2025,
        pmi: 879.6,
        bat: 12.2,
        pmiUnit: 'million cans',
        batUnit: 'billion pouches',
        sourceIds: ['s1', 's12']
      }
    ],
    growthSeriesIndex: [
      { year: 2022, pmi: 10.1, bat: 74.1, sourceIds: ['s16', 's21'] },
      { year: 2023, pmi: 100.0, bat: 100.0, sourceIds: ['s1', 's16'] },
      { year: 2024, pmi: 152.9, bat: 153.7, sourceIds: ['s1', 's14'] },
      { year: 2025, pmi: 208.9, bat: 225.9, sourceIds: ['s1', 's12'] }
    ],
    growthSeriesYoy: [
      {
        year: 2023,
        pmi: 890.8,
        bat: 33.6,
        note: 'PMI 2023 YoY reflects a structural step-up after Swedish Match acquisition late 2022.',
        sourceIds: ['s16', 's21']
      },
      { year: 2024, pmi: 52.9, bat: 55.0, sourceIds: ['s1', 's14'] },
      { year: 2025, pmi: 36.6, bat: 47.1, sourceIds: ['s1', 's12'] }
    ],
    inputVolatility: {
      asOfMonth: '2025-12',
      method:
        'Annualized volatility is calculated as standard deviation of monthly returns over trailing 12 and 24 months (monthly sigma * sqrt(12)).',
      rows: [
        {
          input: 'Polymer resin (can/lid proxy)',
          proxySeries: 'Thermoplastic resins and plastics materials PPI',
          seriesCode: 'PCU3252113252111',
          latestIndex: 265.035,
          yoyPercent: -5.16,
          vol12AnnualizedPercent: 5.35,
          vol24AnnualizedPercent: 5.17,
          riskSignal: 'medium',
          sourceIds: ['s22']
        },
        {
          input: 'Nicotine derivatives (proxy)',
          proxySeries: 'Medicinal and botanical chemicals PPI',
          seriesCode: 'WPU0631',
          latestIndex: 197.217,
          yoyPercent: 0.85,
          vol12AnnualizedPercent: 1.06,
          vol24AnnualizedPercent: 2.81,
          riskSignal: 'low',
          sourceIds: ['s23']
        },
        {
          input: 'Nonwoven fleece',
          proxySeries: 'Nonwoven fabrics PPI',
          seriesCode: 'WPU03450321',
          latestIndex: 201.524,
          yoyPercent: 1.88,
          vol12AnnualizedPercent: 0.90,
          vol24AnnualizedPercent: 2.11,
          riskSignal: 'low',
          sourceIds: ['s24']
        },
        {
          input: 'Cellulose / MCC proxy',
          proxySeries: 'Wood pulp PPI',
          seriesCode: 'WPU09110501',
          latestIndex: 141.721,
          yoyPercent: -10.87,
          vol12AnnualizedPercent: 6.21,
          vol24AnnualizedPercent: 7.17,
          riskSignal: 'high',
          sourceIds: ['s25']
        }
      ]
    },
    inputComparison: [
      {
        input: 'Nicotine active ingredient',
        pmi:
          'Pharmaceutical-grade tobacco-derived nicotine salts; ZYN disclosure includes nicotine bitartrate dihydrate.',
        bat:
          'High-purity nicotine extracted from tobacco and refined/purified for oral nicotine pouch products.',
        implication:
          'Both companies disclose purified tobacco-derived nicotine, but neither discloses supplier-country mapping in public filings.',
        sourceIds: ['s1', 's13', 's15']
      },
      {
        input: 'Primary filler / substrate',
        pmi:
          'Plant-based fiber pouch and fillers including microcrystalline cellulose, maltitol, and gum arabic.',
        bat: 'Cellulose-based filler in oral nicotine pouches.',
        implication:
          'Cellulose-based formulation is common to both; BAT gives category-level disclosure, PMI provides more product-level ingredient detail.',
        sourceIds: ['s13', 's15']
      },
      {
        input: 'Pouch wrapper material',
        pmi:
          'PMI oral direct-material disclosure includes pouch material; ZYN uses plant-fiber pouch format.',
        bat: 'BAT describes pouch material as fleece-wrapped.',
        implication:
          'Both rely on nonwoven/fleece-like pouch media, with limited supplier transparency.',
        sourceIds: ['s1', 's13', 's15']
      },
      {
        input: 'Flavourings / sweeteners',
        pmi:
          'Food-grade flavourings and sweetener (Acesulfame K) disclosed on ZYN ingredient page.',
        bat:
          'BAT discloses flavours as a core modern oral ingredient set; scientific page describes flavour-inclusive pouch design.',
        implication:
          'Both companies emphasize flavor systems; BAT disclosure is broader while PMI is more explicit at ingredient-name level.',
        sourceIds: ['s12', 's13', 's15']
      },
      {
        input: 'Water / pH handling',
        pmi:
          'ZYN ingredient page discloses water plus pH adjusters (sodium carbonate, sodium bicarbonate).',
        bat: 'BAT 2025 report lists water among core modern oral ingredients.',
        implication:
          'Water and pH control are explicit in PMI product-level disclosures and present at BAT category level.',
        sourceIds: ['s12', 's15']
      },
      {
        input: 'Packaging resin / can',
        pmi:
          'PMI lists plastic cans and lids as direct oral smoke-free materials.',
        bat:
          'BAT discloses Velo can innovation with 90% bio-based plastic (mass-balance approach).',
        implication:
          'Both rely on plastic can architecture; BAT discloses a bio-based plastics initiative while PMI disclosure remains material-category level.',
        sourceIds: ['s1', 's12']
      }
    ],
    mapSites: [
      {
        company: 'PMI',
        name: 'Owensboro Site',
        location: 'Owensboro, Kentucky, USA',
        lat: 37.7719,
        lon: -87.1112,
        confidence: 'high',
        sourceIds: ['s1', 's4']
      },
      {
        company: 'PMI',
        name: 'Aurora Site',
        location: 'Aurora, Colorado, USA',
        lat: 39.7294,
        lon: -104.8319,
        confidence: 'high',
        sourceIds: ['s4']
      },
      {
        company: 'BAT',
        name: 'Pecs Modern Oral Facility',
        location: 'Pecs, Hungary',
        lat: 46.0727,
        lon: 18.2323,
        confidence: 'high',
        sourceIds: ['s12']
      },
      {
        company: 'BAT',
        name: 'Trieste Facility',
        location: 'Trieste, Italy',
        lat: 45.6495,
        lon: 13.7768,
        confidence: 'high',
        sourceIds: ['s12']
      }
    ]
  },
  sources: [
    {
      id: 's1',
      title: 'Philip Morris International Form 10-K (FY ended Dec 31, 2025)',
      type: 'Annual filing',
      publisher: 'SEC / PMI',
      date: '2026-02-05',
      url: 'https://www.sec.gov/Archives/edgar/data/1413329/000162828026005939/pm-20251231.htm'
    },
    {
      id: 's2',
      title: 'PMI Q4 2025 Earnings Call Transcript',
      type: 'Earnings transcript',
      publisher: 'Seeking Alpha (transcript of PMI call)',
      date: '2026-02-06',
      url: 'https://seekingalpha.com/article/4762219-philip-morris-international-inc-pm-q4-2025-earnings-call-transcript'
    },
    {
      id: 's3',
      title: 'Building leading brands with purpose (ZYN growth)',
      type: 'Company page',
      publisher: 'PMI',
      date: '2026-02-26',
      url: 'https://www.pmi.com/our-business/building-leading-brands-with-purpose'
    },
    {
      id: 's4',
      title: 'PMI smoke-free progress update (Aurora investment and U.S. site references)',
      type: 'Press release',
      publisher: 'Business Wire / PMI',
      date: '2024-07-16',
      url: 'https://www.businesswire.com/news/home/20240716820095/en/Philip-Morris-International-Progresses-on-Goal-to-Become-Majority-Smoke-Free-by-2030'
    },
    {
      id: 's6',
      title: 'Swedish Match North America LLC importer profile',
      type: 'Customs-derived trade records',
      publisher: 'ImportGenius',
      date: '2026-02-26',
      url: 'https://www.importgenius.com/importers/swedish-match-north-america-llc'
    },
    {
      id: 's7',
      title: 'Swedish Match North America LLC shipment history (example entries)',
      type: 'Customs-derived trade records',
      publisher: 'ImportInfo',
      date: '2026-02-26',
      url: 'https://www.importinfo.com/swedish-match-north-america-llc-1791546?page=6'
    },
    {
      id: 's8',
      title: 'Swedish Match North Europe AB company profile',
      type: 'Trade-flow aggregator profile',
      publisher: 'Volza',
      date: '2026-02-26',
      url: 'https://www.volza.com/company-profile/swedish-match-north-europe-ab-186942/'
    },
    {
      id: 's9',
      title: 'U.S. imports from Germany, HS 5603 (nonwovens), 2023',
      type: 'Macro trade flow',
      publisher: 'WITS / UN Comtrade',
      date: '2023-12-31',
      url: 'https://wits.worldbank.org/trade/comtrade/en/country/USA/year/2023/tradeflow/Imports/partner/DEU/product/5603'
    },
    {
      id: 's10',
      title: 'U.S. imports from United Kingdom, HS 5603 (nonwovens), 2023',
      type: 'Macro trade flow',
      publisher: 'WITS / UN Comtrade',
      date: '2023-12-31',
      url: 'https://wits.worldbank.org/trade/comtrade/en/country/USA/year/2023/tradeflow/Imports/partner/GBR/product/5603'
    },
    {
      id: 's11',
      title: 'Swedish Match Our Business (manufacturing footprint countries)',
      type: 'Company page',
      publisher: 'Swedish Match',
      date: '2026-02-26',
      url: 'https://www.swedishmatch.com/Our-business/'
    },
    {
      id: 's12',
      title: 'BAT Annual Report 2025',
      type: 'Annual report',
      publisher: 'BAT',
      date: '2026-02-18',
      url: 'https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/reporting/combined-annual-and-sustainability-report/BAT_Annual_Report_2025.pdf'
    },
    {
      id: 's13',
      title: 'BAT Science Innovation - Oral Nicotine Pouches',
      type: 'Company science page',
      publisher: 'BAT',
      date: '2026-02-26',
      url: 'https://www.bat-science.com/science-innovation'
    },
    {
      id: 's14',
      title: 'BAT Annual Report and Form 20-F 2024',
      type: 'Annual filing',
      publisher: 'BAT',
      date: '2025-02-13',
      url: 'https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/reporting/combined-annual-and-sustainability-report/BAT_Annual_Report_Form_20-F_2024.pdf'
    },
    {
      id: 's15',
      title: 'ZYN USA About (ingredient-level disclosure)',
      type: 'Company page',
      publisher: 'ZYN USA',
      date: '2026-02-26',
      url: 'https://us.zyn.com/about-zyn/'
    },
    {
      id: 's16',
      title: 'BAT Annual Report and Form 20-F 2023',
      type: 'Annual filing',
      publisher: 'BAT',
      date: '2024-02-08',
      url: 'https://www.bat.com/ar/2023/documents/BAT_Combined_Annual_and_Sustainability_Report_2023_Reduced.pdf'
    },
    {
      id: 's21',
      title: 'PMI 2024 Annual Report',
      type: 'Annual report',
      publisher: 'PMI',
      date: '2025-02-06',
      url: 'https://www.pmi.com/content/dam/pmicom/global/docs/investor_relation/pmi_2024_annualreport.pdf'
    },
    {
      id: 's22',
      title: 'FRED/BLS PPI series: Thermoplastic resins and plastics materials',
      type: 'Public price index',
      publisher: 'Federal Reserve Bank of St. Louis (BLS source)',
      date: '2026-02-26',
      url: 'https://fred.stlouisfed.org/series/PCU3252113252111'
    },
    {
      id: 's23',
      title: 'FRED/BLS PPI series: Medicinal and botanical chemicals',
      type: 'Public price index',
      publisher: 'Federal Reserve Bank of St. Louis (BLS source)',
      date: '2026-02-26',
      url: 'https://fred.stlouisfed.org/series/WPU0631'
    },
    {
      id: 's24',
      title: 'FRED/BLS PPI series: Nonwoven fabrics',
      type: 'Public price index',
      publisher: 'Federal Reserve Bank of St. Louis (BLS source)',
      date: '2026-02-26',
      url: 'https://fred.stlouisfed.org/series/WPU03450321'
    },
    {
      id: 's25',
      title: 'FRED/BLS PPI series: Wood pulp',
      type: 'Public price index',
      publisher: 'Federal Reserve Bank of St. Louis (BLS source)',
      date: '2026-02-26',
      url: 'https://fred.stlouisfed.org/series/WPU09110501'
    }
  ]
};
