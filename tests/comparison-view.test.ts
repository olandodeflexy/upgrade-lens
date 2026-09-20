import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getComparisonView } from '../lib/comparison-view.ts';
import { scenarios } from '../lib/scenarios.ts';

await test('malformed JSON cannot be presented as an unchanged comparison', () => {
  for (const scenario of scenarios) {
    for (const guarded of [false, true]) {
      const view = getComparisonView(scenario.id, '{', guarded);
      assert.equal(view.result, null);
      assert.equal(view.input, undefined);
      assert.match(view.error, /valid JSON/);
      assert.equal(view.label, 'COMPARISON UNAVAILABLE');
      assert.match(view.title, /valid JSON/);
      assert.match(view.note, /No comparison has run/);
      assert.doesNotMatch(view.description, /same name|same outcome/i);
    }
  }
});

await test('valid JSON rejected by a schema remains a real comparison', () => {
  for (const guarded of [false, true]) {
    const view = getComparisonView('profile', '{"name":123}', guarded);
    assert.equal(view.error, '');
    assert.ok(view.result);
    assert.equal(view.result.changed, false);
    assert.equal(view.title, 'Both versions reject this input.');
    assert.deepEqual(view.result.after.consumer, { status: 'rejected' });
  }
  assert.ok(getComparisonView('profile', 'null').result);
});

await test('editing back to valid JSON restores evidence-based guidance', () => {
  assert.equal(getComparisonView('price', '{').result, null);
  const changed = getComparisonView('price', '19.99');
  assert.equal(changed.result?.changed, true);
  assert.equal(changed.label, 'OBSERVED BEHAVIOR CHANGE');
  const unchanged = getComparisonView('price', '20');
  assert.equal(unchanged.result?.changed, false);
  assert.equal(unchanged.title, 'Same outcome for this input.');
});

await test('safe consumer guidance distinguishes defaults from explicit names', () => {
  assert.equal(
    getComparisonView('profile', '{}', true).title,
    'Different data. Same displayed name.',
  );
  assert.equal(
    getComparisonView('profile', '{"name":"Kofi"}', true).title,
    'Same outcome for this input.',
  );
});
