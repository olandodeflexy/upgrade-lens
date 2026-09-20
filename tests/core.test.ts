import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runComparison } from '../lib/compare.ts';
import {
  buildJevRequest,
  getAssessment,
  jevResponseSchema,
} from '../lib/jev.ts';
import { POST } from '../app/api/analyze/route.ts';

test('optional defaults overwrite a profile only after the upgrade', () => {
  const result = runComparison('profile', {});
  assert.deepEqual(result.before.output, {});
  assert.deepEqual(result.after.output, { name: 'Guest' });
  assert.deepEqual(result.before.consumer, { name: 'Ama' });
  assert.deepEqual(result.after.consumer, { name: 'Guest' });
  assert.equal(result.changed, true);
});
test('a fallback consumer preserves its result despite the parse difference', () => {
  const result = runComparison('profile', {}, true);
  assert.notDeepEqual(result.before.output, result.after.output);
  assert.deepEqual(result.before.consumer, { displayName: 'Guest' });
  assert.deepEqual(result.before.consumer, result.after.consumer);
  assert.equal(result.changed, false);
});
test('an explicit name does not trigger the default change', () => {
  assert.equal(runComparison('profile', { name: 'Kofi' }).changed, false);
});
test('decimal prices fail only under the newer validator', () => {
  const result = runComparison('price', 19.99);
  assert.equal(result.before.success, true);
  assert.equal(result.after.success, false);
  assert.equal(result.changed, true);
});
test('integer prices pass under both versions', () => {
  const result = runComparison('price', 20);
  assert.equal(result.before.success && result.after.success, true);
  assert.equal(result.changed, false);
});
test('partial enum records fail only under the newer validator', () => {
  const result = runComparison('preferences', { email: true });
  assert.equal(result.before.success, true);
  assert.equal(result.after.success, false);
  assert.equal(result.changed, true);
});
test('complete enum records work under both versions', () => {
  assert.equal(
    runComparison('preferences', { email: true, sms: false }).changed,
    false,
  );
});
test('invalid inputs reject consistently', () => {
  const result = runComparison('price', 'nineteen');
  assert.equal(result.before.success || result.after.success, false);
  assert.equal(result.changed, false);
});
test('Jev receives source evidence but not execution results or authored verdicts', () => {
  const request = buildJevRequest('profile', {}, true);
  assert.match(request.state.application_source, /displayName/);
  assert.deepEqual(Object.keys(request.questions), [
    'api_match',
    'trigger',
    'impact',
  ]);
  assert.equal('execution' in request.state, false);
  assert.equal('finding' in request.state, false);
  assert.equal('apiKey' in request, false);
});

const answer = {
  type: 'choice',
  choice: 'yes',
  confidence: 0.8,
  probabilities: { yes: 0.9, no: 0.05, insufficient_context: 0.05 },
};
const mockResponse = {
  model: 'test-model',
  answers: { api_match: answer, trigger: answer, impact: answer },
  usage: { input_tokens: 200, output_tokens: 40 },
};
const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const body = {
  scenario: 'profile',
  guarded: false,
  input: {},
  apiKey: 'test-only-not-a-real-key',
};

test('missing API key fails without calling the upstream service', async () => {
  const response = await POST(makeRequest({ ...body, apiKey: '' }));
  assert.equal(response.status, 400);
  assert.equal(
    'answers' in ((await response.json()) as Record<string, unknown>),
    false,
  );
});
test('oversized inputs are rejected before an upstream call', async () => {
  const response = await POST(
    makeRequest({ ...body, input: 'a'.repeat(4001) }),
  );
  assert.equal(response.status, 413);
});
test('transport errors never turn into fabricated model answers', async () => {
  const original = globalThis.fetch;
  try {
    for (const [upstream, expected] of [
      [401, 401],
      [429, 429],
      [500, 502],
    ]) {
      globalThis.fetch = async () =>
        new Response('upstream failure', { status: upstream });
      const response = await POST(makeRequest(body));
      assert.equal(response.status, expected);
      assert.equal(
        'answers' in ((await response.json()) as Record<string, unknown>),
        false,
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});
test('a mocked successful transport returns validated answers without exposing the key', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        `Bearer ${body.apiKey}`,
      );
      assert.equal(JSON.parse(init?.body as string).model, 'jev-1.13.0');
      return Response.json(mockResponse);
    };
    const response = await POST(makeRequest(body));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const data = (await response.json()) as {
      mode: string;
      answers: { impact: { choice: string } };
    };
    assert.equal(data.mode, 'live');
    assert.equal(data.answers.impact.choice, 'yes');
    assert.equal(JSON.stringify(data).includes(body.apiKey), false);
  } finally {
    globalThis.fetch = original;
  }
});
test('malformed model responses fail visibly', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ model: 'test-model', answers: {} });
    const response = await POST(makeRequest(body));
    assert.equal(response.status, 502);
    assert.equal(
      'answers' in ((await response.json()) as Record<string, unknown>),
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('invalid probabilities cannot become a displayed assessment', () => {
  assert.equal(
    jevResponseSchema.safeParse({
      ...mockResponse,
      answers: {
        ...mockResponse.answers,
        impact: {
          ...answer,
          probabilities: { yes: 2, no: -1, insufficient_context: 0 },
        },
      },
    }).success,
    false,
  );
});
test('uncertainty is a first-class result', () => {
  const response = jevResponseSchema.parse({
    ...mockResponse,
    answers: {
      ...mockResponse.answers,
      impact: { ...answer, choice: 'insufficient_context', confidence: 0.1 },
    },
  });
  assert.equal(
    getAssessment({
      ...response,
      mode: 'live',
      elapsedMs: 1,
      analyzedAt: new Date().toISOString(),
    }).tone,
    'uncertain',
  );
});
