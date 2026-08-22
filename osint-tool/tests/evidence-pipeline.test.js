const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const FaceSearchEngine = require('../src/modules/faceSearchEngine');
const ImageAnalyzer = require('../src/modules/imageAnalyzer');
const EvidenceScorer = require('../src/modules/multiDimensionalSearch');

const projectRoot = path.resolve(__dirname, '..');

test('face search explicitly returns unavailable instead of fabricated matches', async () => {
  const engine = new FaceSearchEngine({});
  const result = await engine.searchFace('/tmp/not-used.jpg');
  assert.equal(result.success, false);
  assert.equal(result.unavailable, true);
  assert.deepEqual(result.results, { high: [], medium: [], low: [] });
  assert.equal(result.stats.total, 0);
});

test('local image analyzer rejects remote URLs to prevent implicit remote fetching', () => {
  const analyzer = new ImageAnalyzer({});
  assert.throws(
    () => analyzer.validateLocalPath('https://example.com/image.jpg'),
    /Remote image URLs are not accepted/
  );
});

test('evidence scorer reports attribute similarity rather than identity probability', () => {
  const scorer = new EvidenceScorer({});
  const result = scorer.scoreCandidate(
    { username: 'alice', displayName: 'Alice Smith', company: 'Example Inc' },
    { username: 'alice', name: 'Alice Smith', company: 'Example Inc' }
  );

  assert.equal(result.score, 100);
  assert.equal(result.meaning, 'attribute_similarity_not_identity_probability');
  assert.equal(result.factors.length, 3);
});

test('known fabricated-evidence patterns are absent from production source modules', () => {
  const files = [
    'src/modules/faceSearchEngine.js',
    'src/modules/imageAnalyzer.js',
    'src/modules/holeheCollector.js',
    'src/modules/googleDorksCollector.js',
    'src/modules/whoisCollector.js'
  ];

  for (const relative of files) {
    const content = fs.readFileSync(path.join(projectRoot, relative), 'utf8');
    assert.doesNotMatch(content, /generateMockResults\s*\(/, `${relative} must not generate mock results`);
    assert.doesNotMatch(content, /example\.com\/image\d+/i, `${relative} must not contain synthetic result URLs`);
    assert.doesNotMatch(content, /Math\.random\s*\(/, `${relative} must not fabricate random evidence`);
  }
});
