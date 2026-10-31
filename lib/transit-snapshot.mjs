const FEED_URLS = Object.freeze({
  bus: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json',
  gmb: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json',
});

const HK_BOUNDS = Object.freeze({ minLat: 21.8, maxLat: 23.0, minLng: 113.5, maxLng: 115.0 });
const DISTANCE_THRESHOLDS = Object.freeze([250, 500, 1000, 2000, 5000]);
export const MAX_WEBSITE_TRANSIT_SNAPSHOT_BYTES = 2 * 1024 * 1024;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertSnapshotSize(snapshot, label) {
  let serialized;
  try { serialized = JSON.stringify(snapshot); }
  catch { throw new Error(`${label} cannot be serialized as JSON`); }
  const bytes = Buffer.byteLength(serialized || '', 'utf8');
  if (bytes > MAX_WEBSITE_TRANSIT_SNAPSHOT_BYTES) {
    throw new Error(`${label} exceeds ${MAX_WEBSITE_TRANSIT_SNAPSHOT_BYTES} byte website limit (${bytes} bytes)`);
  }
}

function requiredText(value, label, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${label} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value.trim();
}

function optionalText(value, label, maxLength = 200) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${label} must be null or a string no longer than ${maxLength} characters`);
  }
  return value.trim() || null;
}

function finiteNumber(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} is outside its valid range`);
  }
  return value;
}

function expectedSiteIndex(sites) {
  if (!Array.isArray(sites) || sites.length < 100) {
    throw new Error(`Expected at least 100 campsites, got ${Array.isArray(sites) ? sites.length : 'non-array'}`);
  }
  const byId = new Map();
  for (const site of sites) {
    const id = requiredText(site?.id, 'campsite id', 80);
    const name = requiredText(site?.name, `campsite ${id} name`, 200);
    if (byId.has(id)) throw new Error(`Duplicate expected campsite id: ${id}`);
    byId.set(id, { id, name });
  }
  return byId;
}

function normalizeRoutes(routes, siteId, mode) {
  if (!Array.isArray(routes) || routes.length > 8) {
    throw new Error(`${siteId} ${mode} routes must be an array of at most 8 entries`);
  }
  return routes.map((route, index) => {
    if (!object(route)) throw new Error(`${siteId} ${mode} route ${index + 1} is invalid`);
    const normalized = {
      companyCode: optionalText(route.companyCode, `${siteId} route companyCode`, 40),
      routeId: optionalText(route.routeId, `${siteId} route routeId`, 80),
      routeNameC: optionalText(route.routeNameC, `${siteId} route routeNameC`, 120),
      routeNameE: optionalText(route.routeNameE, `${siteId} route routeNameE`, 120),
      routeSeq: route.routeSeq === null || route.routeSeq === undefined
        ? null : finiteNumber(route.routeSeq, `${siteId} route routeSeq`, { min: 0, max: 1000, integer: true }),
      originC: optionalText(route.originC, `${siteId} route originC`, 160),
      originE: optionalText(route.originE, `${siteId} route originE`, 160),
      destinationC: optionalText(route.destinationC, `${siteId} route destinationC`, 160),
      destinationE: optionalText(route.destinationE, `${siteId} route destinationE`, 160),
    };
    if (!normalized.routeId && !normalized.routeNameC && !normalized.routeNameE) {
      throw new Error(`${siteId} ${mode} route ${index + 1} has no route identifier or name`);
    }
    return normalized;
  });
}

function normalizeStops(stops, siteId, mode) {
  if (!Array.isArray(stops) || stops.length > 5) {
    throw new Error(`${siteId} ${mode} stops must be an array of at most 5 entries`);
  }
  return stops.map((stop, index) => {
    if (!object(stop)) throw new Error(`${siteId} ${mode} stop ${index + 1} is invalid`);
    const companyCode = requiredText(stop.companyCode, `${siteId} ${mode} companyCode`, 40);
    const stopId = requiredText(stop.stopId, `${siteId} ${mode} stopId`, 100);
    const nameC = optionalText(stop.nameC, `${siteId} ${mode} stop nameC`, 200);
    const nameE = optionalText(stop.nameE, `${siteId} ${mode} stop nameE`, 200);
    if (!nameC && !nameE) throw new Error(`${siteId} ${mode} stop ${stopId} has no name`);
    const lat = finiteNumber(stop.lat, `${siteId} ${mode} stop ${stopId} latitude`, {
      min: HK_BOUNDS.minLat, max: HK_BOUNDS.maxLat,
    });
    const lng = finiteNumber(stop.lng, `${siteId} ${mode} stop ${stopId} longitude`, {
      min: HK_BOUNDS.minLng, max: HK_BOUNDS.maxLng,
    });
    const distanceM = finiteNumber(stop.distanceM, `${siteId} ${mode} stop ${stopId} distance`, {
      min: 0, max: 1_000_000, integer: true,
    });

    return {
      companyCode,
      stopId,
      nameC,
      nameE,
      lat,
      lng,
      distanceM,
      lastUpdateDate: optionalText(stop.lastUpdateDate, `${siteId} ${mode} stop update date`, 40),
      routes: normalizeRoutes(stop.routes, siteId, mode),
    };
  });
}

function normalizeSources(sources) {
  if (!object(sources)) throw new Error('Transit snapshot sources are missing');
  const normalized = {};
  for (const mode of ['bus', 'gmb']) {
    const source = sources[mode];
    if (!object(source) || source.sourceUrl !== FEED_URLS[mode]) {
      throw new Error(`Transit ${mode} source URL is missing or is not the official feed`);
    }
    normalized[mode] = {
      sourceUrl: FEED_URLS[mode],
      latestSourceUpdate: optionalText(source.latestSourceUpdate, `Transit ${mode} latestSourceUpdate`, 40),
    };
  }
  return normalized;
}

function normalizeTransitCampsites(rawCampsites, expectedById, source = 'snapshot') {
  if (!Array.isArray(rawCampsites) || rawCampsites.length !== expectedById.size) {
    throw new Error(`${source} must contain all ${expectedById.size} campsites`);
  }
  const byId = new Map();
  for (const camp of rawCampsites) {
    const id = requiredText(camp?.id, `${source} campsite id`, 80);
    if (byId.has(id)) throw new Error(`${source} contains duplicate campsite id: ${id}`);
    const expected = expectedById.get(id);
    if (!expected) throw new Error(`${source} contains unknown campsite id: ${id}`);
    if (camp.name !== undefined && camp.name !== expected.name) {
      throw new Error(`${source} campsite name mismatch for ${id}`);
    }
    byId.set(id, {
      id,
      bus: normalizeStops(camp.bus ?? camp.nearest?.bus, id, 'bus'),
      gmb: normalizeStops(camp.gmb ?? camp.nearest?.gmb, id, 'gmb'),
    });
  }
  if (byId.size !== expectedById.size) throw new Error(`${source} campsite coverage is incomplete`);
  return [...expectedById.keys()].map((id) => byId.get(id));
}

function normalizeSummary(summary, expectedCount) {
  if (!object(summary) || summary.campsiteCount !== expectedCount) {
    throw new Error(`Transit summary must report all ${expectedCount} campsites`);
  }
  const uniqueBusStopCount = finiteNumber(summary.uniqueBusStopCount, 'Transit uniqueBusStopCount', {
    min: 1, max: 100_000, integer: true,
  });
  const uniqueGmbStopCount = finiteNumber(summary.uniqueGmbStopCount, 'Transit uniqueGmbStopCount', {
    min: 1, max: 100_000, integer: true,
  });
  const coverageWithinMeters = {};
  for (const mode of ['bus', 'gmb']) {
    const source = summary.coverageWithinMeters?.[mode];
    if (!object(source)) throw new Error(`Transit ${mode} coverage summary is missing`);
    coverageWithinMeters[mode] = {};
    for (const threshold of DISTANCE_THRESHOLDS) {
      const count = source[String(threshold)];
      coverageWithinMeters[mode][String(threshold)] = finiteNumber(count, `Transit ${mode} ${threshold}m coverage`, {
        min: 0, max: expectedCount, integer: true,
      });
    }
  }
  return { campsiteCount: expectedCount, uniqueBusStopCount, uniqueGmbStopCount, coverageWithinMeters };
}

function normalizeGeneratedAt(value) {
  const generatedAt = requiredText(value, 'Transit generatedAt', 50);
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Transit generatedAt must be a valid timestamp');
  return generatedAt;
}

/** Convert the larger POC report into the small, public website snapshot. */
export function createWebsiteTransitSnapshot(poc, expectedSites) {
  const expectedById = expectedSiteIndex(expectedSites);
  if (!object(poc) || poc.schemaVersion !== 1) throw new Error('Transit POC schemaVersion must be 1');
  if (poc.quality?.allCampsitesProcessed !== true
      || poc.quality.processedCampsites !== expectedById.size
      || poc.quality.expectedCampsites !== expectedById.size) {
    throw new Error(`Transit POC did not process all ${expectedById.size} campsites`);
  }

  const sources = normalizeSources(poc.sources);
  const rawCampsites = Array.isArray(poc.campsites)
    ? poc.campsites.map((camp) => ({ id: camp.id, name: camp.name, nearest: camp.nearest }))
    : poc.campsites;
  const campsites = normalizeTransitCampsites(rawCampsites, expectedById, 'Transit POC');
  const summary = normalizeSummary(poc.summary, expectedById.size);

  const websiteSnapshot = {
    schemaVersion: 1,
    generatedAt: normalizeGeneratedAt(poc.generatedAt),
    scope: 'Official Transport Department bus and GMB route-stop data; straight-line proximity only. Not walking directions, accessibility, service adequacy or real-time ETA.',
    sources,
    summary,
    campsites,
  };
  assertSnapshotSize(websiteSnapshot, 'Website transit snapshot');
  return websiteSnapshot;
}

/** Validate and normalize the checked-in website snapshot before embedding it. */
export function validateWebsiteTransitSnapshot(snapshot, expectedSites) {
  if (snapshot === null) return null;
  assertSnapshotSize(snapshot, 'Website transit snapshot');
  const expectedById = expectedSiteIndex(expectedSites);
  if (!object(snapshot) || snapshot.schemaVersion !== 1) {
    throw new Error('Website transit snapshot schemaVersion must be 1');
  }
  const sources = normalizeSources(snapshot.sources);
  const campsites = normalizeTransitCampsites(snapshot.campsites, expectedById);
  const summary = normalizeSummary(snapshot.summary, expectedById.size);
  return {
    schemaVersion: 1,
    generatedAt: normalizeGeneratedAt(snapshot.generatedAt),
    scope: 'Official Transport Department bus and GMB route-stop data; straight-line proximity only. Not walking directions, accessibility, service adequacy or real-time ETA.',
    sources,
    summary,
    campsites,
  };
}

export const TRANSIT_FEED_URLS = FEED_URLS;
