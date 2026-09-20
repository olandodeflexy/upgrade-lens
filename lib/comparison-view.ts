import { runComparison } from './compare.ts';
import { scenarios, type ScenarioId } from './scenarios.ts';

export function getComparisonView(
  id: ScenarioId,
  inputText: string,
  guarded = false,
) {
  let input: unknown;
  try {
    input = JSON.parse(inputText);
  } catch {
    return {
      input: undefined,
      result: null,
      error: 'Enter valid JSON to compare the two versions.',
      note: 'No comparison has run for this input.',
      label: 'COMPARISON UNAVAILABLE',
      title: 'Enter valid JSON to compare.',
      description:
        'Correct the input above before comparing results or asking Jev for an assessment.',
    };
  }

  const scenario = scenarios.find((item) => item.id === id)!;
  const result = runComparison(id, input, guarded);
  const original = inputText === scenario.input;
  const safeExample = id === 'profile' && guarded && original;
  const bothRejected = !result.before.success && !result.after.success;

  return {
    input,
    result,
    error: '',
    note: `Executed with Zod 3 & 4. ${
      result.changed
        ? 'The final application result differs.'
        : 'The final application result is the same for this input.'
    }`,
    label: result.changed ? 'OBSERVED BEHAVIOR CHANGE' : 'NO OBSERVED IMPACT',
    title: bothRejected
      ? 'Both versions reject this input.'
      : safeExample
        ? 'Different data. Same displayed name.'
        : original
          ? scenario.finding
          : result.changed
            ? 'Your input changes the outcome.'
            : 'Same outcome for this input.',
    description: bothRejected
      ? 'Validation fails in both versions, so neither consumer applies this input. This is an invalid value, not an observed upgrade difference.'
      : safeExample
        ? 'Both versions display the same name because the consumer already supplies a fallback. This example shows why the surrounding code matters.'
        : original
          ? scenario.explanation
          : 'The panels above show the actual results for your input. Ask Jev to independently assess the migration note and application source.',
  };
}
