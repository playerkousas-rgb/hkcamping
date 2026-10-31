const HK_BOUNDS = Object.freeze({ minLat: 21.8, maxLat: 23.0, minLng: 113.5, maxLng: 115.0 });
const EARTH_RADIUS_M = 6_371_008.8;

const keyOf = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const propertyIndexes = new WeakMap();

function propertyIndex(properties = {}) {
  let index = propertyIndexes.get(properties);
  if (!index) {
    index = new Map(Object.entries(properties).map(([key, value]) => [keyOf(key), value]));
    propertyIndexes.set(properties, index);
  }
  return index;
}

function property(properties, ...aliases) {
  const index = propertyIndex(properties);
  for (const alias of aliases) {
    const value = index.get(keyOf(alias));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

const text = (value) => String(value ?? '').trim();
const number = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

function validCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isHongKongCoordinate(lat, lng) {
  return lat >= HK_BOUNDS.minLat && lat <= HK_BOUNDS.maxLat
    && lng >= HK_BOUNDS.minLng && lng <= HK_BOUNDS.maxLng;
}

export function haversineMeters(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeDescriptor(properties, companyCode) {
  const routeId = text(property(properties, 'routeId', 'route_id', 'routeld', 'routeID'));
  const routeNameC = text(property(properties, 'routeNameC', 'routeNameTc', 'route_name_tc'));
  const routeNameE = text(property(properties, 'routeNameE', 'routeNameEn', 'route_name_en'));
  const routeSeqValue = property(properties, 'routeSeq', 'route_seq', 'direction');
  const routeSeq = number(routeSeqValue);
  const originC = text(property(properties, 'locStartNameC', 'orig_tc', 'origin_tc'));
  const originE = text(property(properties, 'locStartNameE', 'orig_en', 'origin_en'));
  const destinationC = text(property(properties, 'locEndNameC', 'dest_tc', 'destination_tc'));
  const destinationE = text(property(properties, 'locEndNameE', 'dest_en', 'destination_en'));
  const label = routeNameC || routeNameE || routeId;

  if (!routeId && !label) return null;

  return {
    companyCode,
    routeId: routeId || null,
    routeNameC: routeNameC || null,
    routeNameE: routeNameE || null,
    routeSeq,
    originC: originC || null,
    originE: originE || null,
    destinationC: destinationC || null,
    destinationE: destinationE || null,
  };
}

function routeKey(route) {
  return [
    route.companyCode,
    route.routeId,
    route.routeNameC,
    route.routeNameE,
    route.routeSeq,
    route.originC,
    route.originE,
    route.destinationC,
    route.destinationE,
  ].join('|');
}

/**
 * Parse the official TD route/fare GeoJSON format into unique physical stops.
 * Source features are route-stop records; multiple routes can reference one stop.
 */
export function parseRouteGeoJson(geojson, { mode, sourceUrl = '', minFeatures = 500 } = {}) {
  if (!['bus', 'gmb'].includes(mode)) throw new Error(`Invalid transit mode: ${mode}`);
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error(`${mode} feed is not a GeoJSON FeatureCollection`);
  }
  if (geojson.features.length < minFeatures) {
    throw new Error(`${mode} feed unexpectedly small: ${geojson.features.length} features (< ${minFeatures})`);
  }

  const stats = {
    sourceUrl,
    featureCount: geojson.features.length,
    pointFeatureCount: 0,
    usableFeatureCount: 0,
    skippedNonPoint: 0,
    skippedOutsideHongKong: 0,
    skippedInvalid: 0,
    missingCompanyCode: 0,
    missingStopName: 0,
    coordinateConflicts: 0,
    latestSourceUpdate: null,
  };
  const stops = new Map();
  const conflicts = [];

  for (let index = 0; index < geojson.features.length; index += 1) {
    const feature = geojson.features[index];
    if (!feature || feature.type !== 'Feature') {
      stats.skippedInvalid += 1;
      continue;
    }
    if (feature.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
      stats.skippedNonPoint += 1;
      continue;
    }

    stats.pointFeatureCount += 1;
    const [lngValue, latValue] = feature.geometry.coordinates;
    const lat = number(latValue);
    const lng = number(lngValue);
    const p = feature.properties || {};
    const stopId = text(property(p, 'stopId', 'stop_id', 'stop', 'stopNo'));
    const companyCode = text(property(p, 'companyCode', 'company_code', 'co', 'company')).toUpperCase();
    const stopNameC = text(property(p, 'stopNameC', 'stopNameTc', 'name_tc', 'stop_name_tc'));
    const stopNameE = text(property(p, 'stopNameE', 'stopNameEn', 'name_en', 'stop_name_en'));

    if (!validCoordinate(lat, lng) || !stopId) {
      stats.skippedInvalid += 1;
      continue;
    }
    if (!isHongKongCoordinate(lat, lng)) {
      stats.skippedOutsideHongKong += 1;
      continue;
    }

    stats.usableFeatureCount += 1;
    if (!companyCode) stats.missingCompanyCode += 1;
    if (!stopNameC && !stopNameE) stats.missingStopName += 1;

    const safeCompanyCode = companyCode || 'UNKNOWN';
    const baseKey = `${safeCompanyCode}|${stopId}`;
    const route = routeDescriptor(p, safeCompanyCode);
    const lastUpdate = text(property(p, 'lastUpdateDate', 'last_update_date')) || null;
    if (lastUpdate && (!stats.latestSourceUpdate || lastUpdate > stats.latestSourceUpdate)) {
      stats.latestSourceUpdate = lastUpdate;
    }

    let stop = stops.get(baseKey);
    if (!stop) {
      stop = {
        mode,
        companyCode: safeCompanyCode,
        stopId,
        lat,
        lng,
        nameC: stopNameC || null,
        nameE: stopNameE || null,
        lastUpdateDate: lastUpdate,
        routes: new Map(),
        coordinateSamples: 1,
        _latSum: lat,
        _lngSum: lng,
      };
      stops.set(baseKey, stop);
    } else {
      const distance = haversineMeters(stop, { lat, lng });
      if (distance > 50) {
        stats.coordinateConflicts += 1;
        if (conflicts.length < 20) {
          conflicts.push({ companyCode: safeCompanyCode, stopId, distanceM: Math.round(distance) });
        }
      } else {
        stop.coordinateSamples += 1;
        stop._latSum += lat;
        stop._lngSum += lng;
        stop.lat = stop._latSum / stop.coordinateSamples;
        stop.lng = stop._lngSum / stop.coordinateSamples;
      }
      if (!stop.nameC && stopNameC) stop.nameC = stopNameC;
      if (!stop.nameE && stopNameE) stop.nameE = stopNameE;
      if (lastUpdate && (!stop.lastUpdateDate || lastUpdate > stop.lastUpdateDate)) {
        stop.lastUpdateDate = lastUpdate;
      }
    }

    if (route) stop.routes.set(routeKey(route), route);
  }

  if (stats.pointFeatureCount === 0 || stats.usableFeatureCount < minFeatures) {
    throw new Error(`${mode} feed has too few usable Hong Kong stop features: ${stats.usableFeatureCount}`);
  }
  const invalidRatio = stats.skippedInvalid / Math.max(1, stats.pointFeatureCount);
  if (invalidRatio > 0.05) {
    throw new Error(`${mode} feed has ${(invalidRatio * 100).toFixed(1)}% invalid point records (> 5%)`);
  }
  if (stats.missingCompanyCode / stats.usableFeatureCount > 0.05) {
    throw new Error(`${mode} feed has more than 5% stop records without a company code`);
  }

  const normalizedStops = [...stops.values()].map((stop) => {
    const { routes, _latSum, _lngSum, coordinateSamples, ...publicStop } = stop;
    return {
      ...publicStop,
      routes: [...routes.values()].sort((a, b) => {
        const routeA = a.routeNameE || a.routeNameC || a.routeId || '';
        const routeB = b.routeNameE || b.routeNameC || b.routeId || '';
        return routeA.localeCompare(routeB, 'en', { numeric: true })
          || (a.routeSeq ?? 0) - (b.routeSeq ?? 0);
      }),
    };
  });

  return { mode, stops: normalizedStops, stats, conflicts };
}

export function validateCampsites(campsites) {
  if (!Array.isArray(campsites) || campsites.length < 100) {
    throw new Error(`Expected at least 100 campsites, got ${Array.isArray(campsites) ? campsites.length : 'non-array'}`);
  }
  const ids = new Set();
  for (const camp of campsites) {
    if (!camp?.id || !camp.name || ids.has(camp.id)) {
      throw new Error(`Invalid or duplicate campsite record: ${camp?.id || '(missing id)'}`);
    }
    ids.add(camp.id);
    const lat = number(camp.lat);
    const lng = number(camp.lng);
    if (!validCoordinate(lat, lng) || !isHongKongCoordinate(lat, lng)) {
      throw new Error(`Invalid Hong Kong coordinate for ${camp.id} ${camp.name}: ${camp.lat}, ${camp.lng}`);
    }
  }
  return campsites;
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-Hant')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .replace(/(?:營地|营地|camp\s*site)$/i, '');
}

function nearestForMode(camp, stops, limit) {
  const nearest = [];
  for (const stop of stops) {
    const distanceM = haversineMeters(camp, stop);
    let index = nearest.findIndex((item) => distanceM < item.distanceM);
    if (index < 0) index = nearest.length;
    if (index < limit) {
      nearest.splice(index, 0, { stop, distanceM: Math.round(distanceM) });
      if (nearest.length > limit) nearest.pop();
    }
  }
  return nearest.map(({ stop, distanceM }) => ({
    companyCode: stop.companyCode,
    stopId: stop.stopId,
    nameC: stop.nameC,
    nameE: stop.nameE,
    lat: Number(stop.lat.toFixed(7)),
    lng: Number(stop.lng.toFixed(7)),
    distanceM,
    lastUpdateDate: stop.lastUpdateDate,
    routes: stop.routes.slice(0, 8),
  }));
}

function coverageCounts(campsites, matches, mode, thresholdsM) {
  const nearestDistance = new Map(matches.map((match) => [match.id, match.nearest[mode][0]?.distanceM ?? null]));
  return Object.fromEntries(thresholdsM.map((thresholdM) => [
    String(thresholdM), campsites.filter((camp) => {
      const distance = nearestDistance.get(camp.id);
      return distance !== null && distance <= thresholdM;
    }).length,
  ]));
}

export function buildTransitPoc({ busFeed, gmbFeed, campsites, generatedAt = new Date().toISOString(), nearestLimit = 5 }) {
  validateCampsites(campsites);
  if (!busFeed?.stops?.length || !gmbFeed?.stops?.length) {
    throw new Error('Both bus and GMB stop feeds are required');
  }

  const busStops = busFeed.stops;
  const gmbStops = gmbFeed.stops;
  const allStops = [...busStops, ...gmbStops];
  const matches = campsites.map((camp) => ({
    id: camp.id,
    name: camp.name,
    district: camp.district || null,
    lat: Number(camp.lat),
    lng: Number(camp.lng),
    nearest: {
      bus: nearestForMode(camp, busStops, nearestLimit),
      gmb: nearestForMode(camp, gmbStops, nearestLimit),
    },
  }));

  const thresholdsM = [250, 500, 1000, 2000, 5000];
  const operatorStopCounts = {};
  for (const stop of allStops) {
    operatorStopCounts[stop.companyCode] = (operatorStopCounts[stop.companyCode] || 0) + 1;
  }

  const stopNameIndex = new Map();
  for (const stop of allStops) {
    const stopNames = new Set([stop.nameC, stop.nameE].map(normalizeName).filter(Boolean));
    for (const stopName of stopNames) {
      if (!stopNameIndex.has(stopName)) stopNameIndex.set(stopName, []);
      stopNameIndex.get(stopName).push(stop);
    }
  }
  const exactNameMatches = campsites.flatMap((camp) => {
    const campName = normalizeName(camp.name);
    if (!campName) return [];
    const candidates = (stopNameIndex.get(campName) || []).map((stop) => ({
      mode: stop.mode,
      companyCode: stop.companyCode,
      stopId: stop.stopId,
      nameC: stop.nameC,
      nameE: stop.nameE,
      distanceM: Math.round(haversineMeters(camp, stop)),
    }));
    return candidates.length ? [{ campsiteId: camp.id, campsiteName: camp.name, stops: candidates }] : [];
  });

  return {
    schemaVersion: 1,
    generatedAt,
    scope: 'Official bus and green-minibus route-stop proximity only; straight-line distance, not walking directions or real-time ETA.',
    sources: {
      bus: busFeed.stats,
      gmb: gmbFeed.stats,
    },
    quality: {
      processedCampsites: matches.length,
      expectedCampsites: campsites.length,
      allCampsitesProcessed: matches.length === campsites.length,
      coordinateConflictCount: (busFeed.stats.coordinateConflicts || 0) + (gmbFeed.stats.coordinateConflicts || 0),
      coordinateConflicts: [
        ...(busFeed.conflicts || []).map((item) => ({ mode: 'bus', ...item })),
        ...(gmbFeed.conflicts || []).map((item) => ({ mode: 'gmb', ...item })),
      ].slice(0, 40),
      exactNameMatchCount: exactNameMatches.length,
    },
    summary: {
      campsiteCount: matches.length,
      uniqueBusStopCount: busStops.length,
      uniqueGmbStopCount: gmbStops.length,
      operatorStopCounts,
      coverageWithinMeters: {
        bus: coverageCounts(campsites, matches, 'bus', thresholdsM),
        gmb: coverageCounts(campsites, matches, 'gmb', thresholdsM),
      },
      exactNameMatches,
    },
    campsites: matches,
  };
}

function nearestLabel(stop) {
  if (!stop) return '—';
  const route = stop.routes[0];
  const routeName = route?.routeNameC || route?.routeNameE || route?.routeId || '路線待查';
  const stopName = stop.nameC || stop.nameE || `站點 ${stop.stopId}`;
  return `${stop.companyCode} ${routeName}／${stopName}`;
}

export function renderTransitPocMarkdown(poc) {
  const fmtCoverage = (byMode) => [250, 500, 1000, 2000, 5000]
    .map((distance) => `${distance}m: ${byMode[String(distance)]}/${poc.summary.campsiteCount}`)
    .join('；');
  const busTable = Object.entries(poc.summary.operatorStopCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([operator, count]) => `| ${operator} | ${count} |`);
  const campRows = poc.campsites.map((camp) => {
    const bus = camp.nearest.bus[0];
    const gmb = camp.nearest.gmb[0];
    const escape = (value) => String(value ?? '—').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
    return `| ${escape(camp.id)} | ${escape(camp.name)} | ${escape(nearestLabel(bus))} | ${bus?.distanceM ?? '—'} | ${escape(nearestLabel(gmb))} | ${gmb?.distanceM ?? '—'} |`;
  });

  return [
    '# 全自動交通資料配對 POC',
    '',
    `- 產生時間：${poc.generatedAt}`,
    `- 場地處理：${poc.quality.processedCampsites}/${poc.quality.expectedCampsites}`,
    `- 唯一巴士站：${poc.summary.uniqueBusStopCount}；唯一專線小巴站：${poc.summary.uniqueGmbStopCount}`,
    `- 座標衝突：${poc.quality.coordinateConflictCount}；場地與站名完全相同：${poc.quality.exactNameMatchCount}`,
    '- 只計官方站點與場地座標的直線距離；不是步行路線、可達性評估或 ETA。沒有人工挑選或改配對。',
    '',
    '## 最近巴士站覆蓋',
    '',
    `- ${fmtCoverage(poc.summary.coverageWithinMeters.bus)}`,
    '',
    '## 最近專線小巴站覆蓋',
    '',
    `- ${fmtCoverage(poc.summary.coverageWithinMeters.gmb)}`,
    '',
    '## 來源營運者站點數',
    '',
    '| 營運者代碼 | 站點數 |',
    '|---|---:|',
    ...busTable,
    '',
    '## 全部場地最近站點（直線距離，米）',
    '',
    '| ID | 場地 | 最近巴士站 | 距離 | 最近小巴站 | 距離 |',
    '|---|---|---|---:|---|---:|',
    ...campRows,
    '',
    '## Feed 品質',
    '',
    '| 來源 | Features | 有效站點記錄 | 唯一站點 | 最新資料更新欄位 | 座標衝突 |',
    '|---|---:|---:|---:|---|---:|',
    `| 巴士 | ${poc.sources.bus.featureCount} | ${poc.sources.bus.usableFeatureCount} | ${poc.summary.uniqueBusStopCount} | ${poc.sources.bus.latestSourceUpdate || '—'} | ${poc.sources.bus.coordinateConflicts} |`,
    `| 專線小巴 | ${poc.sources.gmb.featureCount} | ${poc.sources.gmb.usableFeatureCount} | ${poc.summary.uniqueGmbStopCount} | ${poc.sources.gmb.latestSourceUpdate || '—'} | ${poc.sources.gmb.coordinateConflicts} |`,
    '',
  ].join('\n');
}
