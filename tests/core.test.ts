import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import { runComparison } from '../lib/compare.ts';
import { getSource, type ScenarioId } from '../lib/scenarios.ts';
import {
  buildJevRequest,
  getAssessment,
  jevResponseSchema,
} from '../lib/jev.ts';
import { POST } from '../app/api/analyze/route.ts';

await test('optional defaults overwrite a profile only after the upgrade', () => {
  const result = runComparison('profile', {});
  assert.deepEqual(result.before.output, {});
  assert.deepEqual(result.after.output, { name: 'Guest' });
  assert.deepEqual(result.before.consumer, { name: 'Ama' });
  assert.deepEqual(result.after.consumer, { name: 'Guest' });
  assert.equal(result.changed, true);
});
await test('a fallback consumer preserves its result despite the parse difference', () => {
  const result = runComparison('profile', {}, true);
  assert.notDeepEqual(result.before.output, result.after.output);
  assert.deepEqual(result.before.consumer, { displayName: 'Guest' });
  assert.deepEqual(result.before.consumer, result.after.consumer);
  assert.equal(result.changed, false);
});
await test('an explicit name does not trigger the default change', () => {
  assert.equal(runComparison('profile', { name: 'Kofi' }).changed, false);
});
await test('decimal prices fail only under the newer validator', () => {
  const result = runComparison('price', 19.99);
  assert.equal(result.before.success, true);
  assert.equal(result.after.success, false);
  assert.equal(result.changed, true);
});
await test('integer prices pass under both versions', () => {
  const result = runComparison('price', 20);
  assert.equal(result.before.success && result.after.success, true);
  assert.equal(result.changed, false);
});
await test('partial enum records fail only under the newer validator', () => {
  const result = runComparison('preferences', { email: true });
  assert.equal(result.before.success, true);
  assert.equal(result.after.success, false);
  assert.equal(result.changed, true);
});
await test('complete enum records work under both versions', () => {
  assert.equal(
    runComparison('preferences', { email: true, sms: false }).changed,
    false,
  );
});
await test('invalid inputs reject consistently', () => {
  const result = runComparison('price', 'nineteen');
  assert.equal(result.before.success || result.after.success, false);
  assert.equal(result.changed, false);
});
const sourceCases: {
  scenario: ScenarioId;
  guarded: boolean;
  inputs: unknown[];
}[] = [
  {
    scenario: 'profile',
    guarded: false,
    inputs: [{}, { name: 'Kofi' }, { name: 42 }, { name: null }, null],
  },
  {
    scenario: 'profile',
    guarded: true,
    inputs: [{}, { name: 'Kofi' }, { name: 42 }, { name: null }, null],
  },
  {
    scenario: 'price',
    guarded: false,
    inputs: [19.99, 20, 'nineteen', null, Number.MAX_SAFE_INTEGER + 1],
  },
  {
    scenario: 'preferences',
    guarded: false,
    inputs: [
      { email: true },
      { email: true, sms: false },
      {},
      { email: 'yes', sms: false },
      null,
    ],
  },
];

for (const { scenario, guarded, inputs } of sourceCases) {
  await test(`${scenario} source matches both runtime consumers${guarded ? ' with fallback' : ''}`, () => {
    // Only trusted, repository-authored fixture source is compiled. User input is data.
    const runSource = compileFunction(getSource(scenario, guarded), [
      'z',
      'input',
    ]);
    for (const input of inputs) {
      const comparison = runComparison(scenario, input, guarded);
      assert.deepEqual(runSource(z3, input), comparison.before.consumer);
      assert.deepEqual(runSource(z4, input), comparison.after.consumer);
    }
  });
}

await test('Jev receives source evidence but not execution results or authored verdicts', () => {
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

await test('missing API key fails without calling the upstream service', async () => {
  const response = await POST(makeRequest({ ...body, apiKey: '' }));
  assert.equal(response.status, 400);
  assert.equal(
    'answers' in ((await response.json()) as Record<string, unknown>),
    false,
  );
});
await test('oversized inputs are rejected before an upstream call', async () => {
  const response = await POST(
    makeRequest({ ...body, input: 'a'.repeat(4001) }),
  );
  assert.equal(response.status, 413);
});
await test('transport errors never turn into fabricated model answers', async () => {
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
await test('a mocked successful transport returns validated answers without exposing the key', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
      assert.ok(init);
      assert.equal(
        new Headers(init.headers).get('Authorization'),
        `Bearer ${body.apiKey}`,
      );
      assert.ok(typeof init.body === 'string');
      const requestBody = JSON.parse(init.body) as { model: string };
      assert.equal(requestBody.model, 'jev-1.13.0');
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
await test('malformed model responses fail visibly', async () => {
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
await test('invalid probabilities cannot become a displayed assessment', () => {
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
await test('uncertainty is a first-class result', () => {
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
