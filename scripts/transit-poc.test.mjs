import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  buildTransitPoc,
  haversineMeters,
  parseRouteGeoJson,
  renderTransitPocMarkdown,
  validateCampsites,
} from './transit-poc-core.mjs';
import { parseGeoJsonText } from './transit-poc.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadCampsites() {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'data.js'), 'utf8'), sandbox, { filename: 'data.js' });
  return sandbox.window.CAMPSITES;
}

function point({
  companyCode = 'KMB', routeId = '1', routeNameC = '1', routeNameE = '1', routeSeq = 1,
  stopId, stopNameC = '測試站', stopNameE = 'Test Stop', lat, lng,
}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      companyCode,
      routeId,
      routeNameC,
      routeNameE,
      routeSeq,
      stopId,
      stopNameC,
      stopNameE,
      lastUpdateDate: '2026-10-08T00:00:00',
    },
  };
}

const feed = (features) => ({ type: 'FeatureCollection', features });

test('parses official JSON feeds that begin with a UTF-8 BOM', () => {
  const parsed = parseGeoJsonText('\uFEFF{"type":"FeatureCollection","features":[]}', 'fixture');
  assert.deepEqual(parsed, { type: 'FeatureCollection', features: [] });
  assert.throws(() => parseGeoJsonText('\uFEFF{broken', 'fixture'), /Invalid JSON from fixture/);
});

function parseFixture(features, mode) {
  return parseRouteGeoJson(feed(features), { mode, sourceUrl: `fixture:${mode}`, minFeatures: 1 });
}

test('parses official-style route-stop features and merges routes by operator/stop ID', () => {
  const parsed = parseFixture([
    point({ stopId: 'S-1', lat: 22.2533, lng: 113.9862, routeId: '1', routeNameC: '1' }),
    point({ stopId: 'S-1', lat: 22.2533, lng: 113.9862, routeId: '2', routeNameC: '2', routeSeq: 2 }),
    {
      ...point({ stopId: 'C-1', companyCode: 'CTB', lat: 22.25, lng: 113.98 }),
      properties: {
        companyCode: 'CTB', routeld: 88, routeNameE: '88', stopId: 'C-1',
        stopNameC: '城巴站', stopNameE: 'Citybus Stop', lastUpdateDate: '2026-10-09',
      },
    },
    point({ stopId: 'outside', lat: 25, lng: 120 }),
  ], 'bus');

  assert.equal(parsed.stats.featureCount, 4);
  assert.equal(parsed.stats.usableFeatureCount, 3);
  assert.equal(parsed.stats.skippedOutsideHongKong, 1);
  assert.equal(parsed.stops.length, 2);
  const shared = parsed.stops.find((stop) => stop.stopId === 'S-1');
  assert.equal(shared.routes.length, 2);
  assert.equal(shared.routes[1].routeSeq, 2);
  assert.ok(parsed.stops.some((stop) => stop.stopId === 'C-1' && stop.routes[0].routeId === '88'));
});

test('automatically matches all 108 current camps, reports nearest modes and straight-line distance', () => {
  const campsites = loadCampsites();
  assert.equal(campsites.length, 108);
  const namShan = campsites.find((camp) => camp.id === 'a27');
  assert.equal(namShan.name, '南山營地');

  const bus = parseFixture([
    point({
      companyCode: 'NLB', routeId: '4', routeNameC: '2', routeNameE: '2', stopId: '9',
      stopNameC: '南山營地', stopNameE: 'Nam Shan Camp Site', lat: 22.255451, lng: 113.986811,
    }),
  ], 'bus');
  const gmb = parseFixture([
    point({
      companyCode: 'GMB', routeId: '2002339', routeNameC: '7', routeNameE: '7', stopId: '20001128',
      stopNameC: '北潭涌巴士總站', stopNameE: 'Pak Tam Chung Bus Terminus', lat: 22.3972348, lng: 114.3193594,
    }),
  ], 'gmb');

  const poc = buildTransitPoc({ busFeed: bus, gmbFeed: gmb, campsites, generatedAt: '2026-10-31T00:00:00Z' });
  assert.equal(poc.quality.processedCampsites, 108);
  assert.equal(poc.quality.expectedCampsites, 108);
  assert.equal(poc.quality.allCampsitesProcessed, true);
  const result = poc.campsites.find((camp) => camp.id === 'a27');
  assert.equal(result.nearest.bus[0].stopId, '9');
  assert.ok(result.nearest.bus[0].distanceM >= 220 && result.nearest.bus[0].distanceM <= 270);
  assert.equal(result.nearest.gmb[0].stopId, '20001128');
  assert.ok(poc.summary.exactNameMatches.some((match) => match.campsiteId === 'a27'));
  assert.equal(poc.summary.coverageWithinMeters.bus['500'] >= 1, true);

  const markdown = renderTransitPocMarkdown(poc);
  assert.match(markdown, /108\/108/);
  assert.match(markdown, /直線距離/);
  assert.match(markdown, /\| a27 \| 南山營地 \|/);
});

test('fails closed on incomplete feeds, invalid coordinate ratios and malformed campsite collections', () => {
  assert.throws(() => parseRouteGeoJson({ features: [] }, { mode: 'bus' }), /FeatureCollection/);
  assert.throws(() => parseRouteGeoJson(feed([point({ stopId: 'one', lat: 22.3, lng: 114.1 })]), {
    mode: 'bus', minFeatures: 2,
  }), /unexpectedly small/);

  const mostlyInvalid = Array.from({ length: 10 }, (_, index) => point({
    stopId: `stop-${index}`,
    lat: index === 0 ? 999 : 22.3,
    lng: 114.1,
  }));
  assert.throws(() => parseRouteGeoJson(feed(mostlyInvalid), { mode: 'bus', minFeatures: 1 }), /invalid point records/);

  const campsites = loadCampsites();
  assert.throws(() => validateCampsites([...campsites, { ...campsites[0] }]), /duplicate campsite/);
  assert.throws(() => validateCampsites(campsites.map((camp, index) => (
    index === 0 ? { ...camp, lat: 0 } : camp
  ))), /Invalid Hong Kong coordinate/);
});

test('Haversine reports the known Nam Shan straight-line distance within rounding tolerance', () => {
  const distanceM = haversineMeters(
    { lat: 22.2533, lng: 113.9862 },
    { lat: 22.255451, lng: 113.986811 },
  );
  assert.ok(distanceM > 240 && distanceM < 255, `distance=${distanceM}`);
});
