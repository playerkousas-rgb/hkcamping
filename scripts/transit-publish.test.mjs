import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWebsiteTransitSnapshot,
  validateWebsiteTransitSnapshot,
  TRANSIT_FEED_URLS,
  MAX_WEBSITE_TRANSIT_SNAPSHOT_BYTES,
} from '../lib/transit-snapshot.mjs';

const expectedSites = Array.from({ length: 108 }, (_, index) => ({
  id: `camp-${String(index + 1).padStart(3, '0')}`,
  name: `測試營地 ${index + 1}`,
  lat: 22.3,
  lng: 114.1,
}));

function route(overrides = {}) {
  return {
    companyCode: 'KMB',
    routeId: '94',
    routeNameC: '94',
    routeNameE: '94',
    routeSeq: 1,
    originC: '黃石碼頭',
    originE: 'Wong Shek Pier',
    destinationC: '西貢',
    destinationE: 'Sai Kung',
    ...overrides,
  };
}

function stop(overrides = {}) {
  return {
    companyCode: 'KMB',
    stopId: 'TEST-STOP-1',
    nameC: '北潭涌',
    nameE: 'Pak Tam Chung',
    lat: 22.3972,
    lng: 114.3193,
    distanceM: 350,
    lastUpdateDate: '2026-10-30',
    routes: [route()],
    ...overrides,
  };
}

function makePoc(overrides = {}) {
  const campsites = expectedSites.map((site, index) => ({
    id: site.id,
    name: site.name,
    nearest: {
      bus: index === 0 ? [stop()] : [],
      gmb: index === 0 ? [stop({
        companyCode: 'GMB-TEST', stopId: 'GMB-STOP-1', nameC: '海下', nameE: 'Hoi Ha',
        routes: [route({ companyCode: 'GMB-TEST', routeId: '7', routeNameC: '7' })],
      })] : [],
    },
  }));
  return {
    schemaVersion: 1,
    generatedAt: '2026-10-31T00:00:00.000Z',
    sources: {
      bus: { sourceUrl: TRANSIT_FEED_URLS.bus, latestSourceUpdate: '2026-10-30' },
      gmb: { sourceUrl: TRANSIT_FEED_URLS.gmb, latestSourceUpdate: '2026-10-30' },
    },
    quality: {
      processedCampsites: 108,
      expectedCampsites: 108,
      allCampsitesProcessed: true,
    },
    summary: {
      campsiteCount: 108,
      uniqueBusStopCount: 8216,
      uniqueGmbStopCount: 4779,
      coverageWithinMeters: {
        bus: { '250': 32, '500': 44, '1000': 53, '2000': 66, '5000': 88 },
        gmb: { '250': 17, '500': 26, '1000': 33, '2000': 48, '5000': 64 },
      },
    },
    campsites,
    ...overrides,
  };
}

test('POC → website snapshot: 108/108 coverage and only compact bus/GMB stop data', () => {
  const snapshot = createWebsiteTransitSnapshot(makePoc(), expectedSites);
  assert.equal(snapshot.campsites.length, 108);
  assert.equal(snapshot.summary.campsiteCount, 108);
  assert.equal(snapshot.campsites[0].id, expectedSites[0].id);
  assert.equal(snapshot.campsites[0].bus[0].distanceM, 350);
  assert.equal(snapshot.campsites[0].bus[0].routes[0].routeNameC, '94');
  assert.equal(snapshot.campsites[0].gmb[0].nameC, '海下');
  assert.deepEqual(snapshot.campsites[1].bus, []);
  assert.equal(snapshot.sources.bus.sourceUrl, TRANSIT_FEED_URLS.bus);
  assert.match(snapshot.scope, /straight-line proximity only/i);
  assert.doesNotMatch(JSON.stringify(snapshot), /coordinateConflicts|exactNameMatches|operatorStopCounts/);
});

test('publisher fails closed for incomplete POC coverage, wrong feed, or invalid coordinates', () => {
  const incomplete = makePoc();
  incomplete.campsites.pop();
  assert.throws(() => createWebsiteTransitSnapshot(incomplete, expectedSites), /all 108 campsites/);

  const wrongSource = makePoc();
  wrongSource.sources.bus.sourceUrl = 'https://example.com/bus.json';
  assert.throws(() => createWebsiteTransitSnapshot(wrongSource, expectedSites), /not the official feed/);

  const badCoordinate = makePoc();
  badCoordinate.campsites[0].nearest.bus[0].lat = 0;
  assert.throws(() => createWebsiteTransitSnapshot(badCoordinate, expectedSites), /latitude is outside/);
});

test('website snapshot is checked against the current campsite IDs and size limits', () => {
  const snapshot = createWebsiteTransitSnapshot(makePoc(), expectedSites);
  assert.equal(validateWebsiteTransitSnapshot(snapshot, expectedSites).campsites.length, 108);
  assert.equal(validateWebsiteTransitSnapshot(null, expectedSites), null);

  const wrongIds = structuredClone(snapshot);
  wrongIds.campsites[0].id = 'unknown-camp';
  assert.throws(() => validateWebsiteTransitSnapshot(wrongIds, expectedSites), /unknown campsite id/);

  const tooManyStops = structuredClone(snapshot);
  tooManyStops.campsites[0].bus = Array.from({ length: 6 }, (_, index) => stop({ stopId: `S${index}` }));
  assert.throws(() => validateWebsiteTransitSnapshot(tooManyStops, expectedSites), /at most 5/);

  const oversized = structuredClone(snapshot);
  oversized.unexpectedPayload = 'x'.repeat(MAX_WEBSITE_TRANSIT_SNAPSHOT_BYTES + 1);
  assert.throws(() => validateWebsiteTransitSnapshot(oversized, expectedSites), /website limit/);
});
