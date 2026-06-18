// Golden-fixture accuracy gate.
//
// Locks the graph CodeGraphX produces against hand-labeled ground truth. A
// parser/linker regression (dropped symbol, misrouted API call, broken impact
// trace) fails the suite here. Same harness powers `npm run benchmark`.

const fs = require('fs');
const path = require('path');
const H = require('./harness');
const { db } = require('../../src/db');

jest.setTimeout(30000);

const STRUCTURAL = ['CALLS', 'IMPORTS', 'INHERITS'];

afterAll(async () => {
  await db.destroy();
});

for (const fixture of H.CORPUS) {
  describe(`golden fixture: ${fixture}`, () => {
    let snapshot;
    let gt;
    let impact;
    let doctor;
    let deterministic;
    let cleanup;

    beforeAll(async () => {
      gt = H.loadGroundTruth(fixture);

      const run1 = await H.scanGolden(fixture, gt.extensions);
      snapshot = run1.snapshot;
      // Impact + doctor must be read before the next scan resets the DB.
      impact = await H.scoreImpact(gt);
      doctor = H.scoreDoctor(snapshot, gt);
      const sig = (s) => JSON.stringify([...H.symbolKeys(s)].sort()) +
        JSON.stringify([...H.edgeKeys(s, [...STRUCTURAL, 'API_CALLS'])].sort());
      const sig1 = sig(snapshot);
      run1.cleanup();

      const run2 = await H.scanGolden(fixture, gt.extensions);
      deterministic = sig(run2.snapshot) === sig1;
      cleanup = run2.cleanup;
    });

    afterAll(() => cleanup && cleanup());

    test('extracts exactly the labeled symbols', () => {
      const score = H.scoreSet(H.symbolKeys(snapshot), H.expectedSymbolKeys(gt));
      expect({ missing: score.missing, extra: score.extra }).toEqual({ missing: [], extra: [] });
      expect(score.recall).toBe(1);
      expect(score.precision).toBe(1);
    });

    test('builds exactly the labeled structural edges', () => {
      const score = H.scoreSet(H.edgeKeys(snapshot, STRUCTURAL), H.expectedEdgeKeys(gt, STRUCTURAL));
      expect({ missing: score.missing, extra: score.extra }).toEqual({ missing: [], extra: [] });
    });

    test('links cross-language API calls at expected confidence', () => {
      const score = H.scoreApiCalls(snapshot, gt);
      expect(score.missing).toEqual([]);
      expect(score.extra).toEqual([]);
      expect(score.confidenceViolations).toEqual([]);
    });

    test('tags expected route handlers as endpoints', () => {
      const score = H.scoreSet(H.endpointKeys(snapshot), new Set(gt.endpoints || []));
      expect(score.missing).toEqual([]);
    });

    test('impact traces reach the expected symbols', () => {
      expect(impact.failures).toEqual([]);
      expect(impact.passed).toBe(impact.total);
    });

    test('doctor detects labeled import cycles with no false positives', () => {
      expect(doctor.detectedCycles).toBe(doctor.expectedCycles);
      expect(doctor.falsePositives).toBe(0);
    });

    test('produces an identical graph on re-scan (deterministic)', () => {
      expect(deterministic).toBe(true);
    });
  });
}

test('benchmark + harness files are present', () => {
  expect(fs.existsSync(path.join(__dirname, 'harness.js'))).toBe(true);
  expect(fs.existsSync(path.join(__dirname, '..', '..', 'scripts', 'benchmark.js'))).toBe(true);
});
