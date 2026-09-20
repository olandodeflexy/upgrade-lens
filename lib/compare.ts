import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import type { ScenarioId } from './scenarios';

const oldSchemas = {
  profile: z3.object({ name: z3.string().default('Guest').optional() }),
  price: z3.number().safe(),
  preferences: z3.record(z3.enum(['email', 'sms']), z3.boolean()),
};
const newSchemas = {
  profile: z4.object({ name: z4.string().default('Guest').optional() }),
  // oxlint-disable-next-line typescript/no-deprecated -- This fixture demonstrates the changed behavior of the legacy .safe() API.
  price: z4.number().safe(),
  preferences: z4.record(z4.enum(['email', 'sms']), z4.boolean()),
};

export type RunResult = {
  success: boolean;
  output: unknown;
  consumer: unknown;
  outcome: string;
};
export type Comparison = {
  before: RunResult;
  after: RunResult;
  changed: boolean;
};

function consume(
  id: ScenarioId,
  guarded: boolean,
  result: {
    success: boolean;
    data?: unknown;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  },
): RunResult {
  if (!result.success) {
    return {
      success: false,
      output: { success: false },
      consumer: { status: 'rejected' },
      outcome:
        id === 'price'
          ? 'Price rejected by validation'
          : id === 'preferences'
            ? 'Preferences update rejected'
            : 'Profile update rejected',
    };
  }
  if (id === 'profile') {
    const parsed = result.data as { name?: string };
    const consumer = guarded
      ? { displayName: parsed.name ?? 'Guest' }
      : Object.assign({ name: 'Ama' }, parsed);
    return {
      success: true,
      output: parsed,
      consumer,
      outcome: guarded
        ? `Displayed name: ${'displayName' in consumer ? consumer.displayName : ''}`
        : `Saved name: ${'name' in consumer ? consumer.name : ''}`,
    };
  }
  const consumer =
    id === 'price'
      ? { status: 'accepted', price: result.data }
      : { status: 'updated', patch: result.data };
  return {
    success: true,
    output: { success: true, data: result.data },
    consumer,
    outcome:
      id === 'price'
        ? `Price accepted: ${String(result.data)}`
        : 'Preferences updated',
  };
}

export function runComparison(
  id: ScenarioId,
  input: unknown,
  guarded = false,
): Comparison {
  const before = consume(id, guarded, oldSchemas[id].safeParse(input));
  const after = consume(id, guarded, newSchemas[id].safeParse(input));
  return {
    before,
    after,
    changed: JSON.stringify(before.consumer) !== JSON.stringify(after.consumer),
  };
}
