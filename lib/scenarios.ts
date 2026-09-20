export type ScenarioId = 'profile' | 'price' | 'preferences';
export const scenarios = [
  {
    id: 'profile' as const,
    title: 'The overwritten name',
    subtitle: 'Optional fields & defaults',
    file: 'profile.ts',
    headline: 'A missing name becomes “Guest”.',
    description:
      'A photo-only profile update can quietly overwrite an existing name.',
    input: '{}',
    outputLabel: 'PARSED RESULT',
    before: '{}',
    after: '{\n  "name": "Guest"\n}',
    beforeOutcome: 'Saved name: Ama',
    afterOutcome: 'Saved name: Guest',
    change:
      'Defaults inside optional object properties are now applied. Code that relies on key presence can behave differently.',
    url: 'https://zod.dev/v4/changelog#defaults-applied-within-optional-fields',
    finding: 'The user never asked to change their name.',
    explanation:
      'This handler saves every parsed field into the profile. The new default introduces a name that was absent from the request, so the existing name can be overwritten.',
  },
  {
    id: 'price' as const,
    title: 'The rejected price',
    subtitle: 'Number validation',
    file: 'checkout.ts',
    headline: '19.99 was a price. Now it’s an error.',
    description:
      'A number validator starts rejecting decimals your checkout previously accepted.',
    input: '19.99',
    outputLabel: 'VALIDATION RESULT',
    before: '{\n  "success": true,\n  "data": 19.99\n}',
    after: '{\n  "success": false\n}',
    beforeOutcome: 'Price accepted: 19.99',
    afterOutcome: 'Checkout rejects the price',
    change:
      'z.number().safe() now behaves like .int(). Decimal numbers that were previously accepted fail validation.',
    url: 'https://zod.dev/v4/changelog#safe-no-longer-accepts-floats',
    finding: 'A valid purchase can stop at validation.',
    explanation:
      'This checkout uses .safe() to validate decimal prices. The changed rule rejects 19.99 before the purchase can continue.',
  },
  {
    id: 'preferences' as const,
    title: 'The incomplete preferences',
    subtitle: 'Enum keys in records',
    file: 'preferences.ts',
    headline: 'One preference now needs all the others.',
    description:
      'A partial settings update fails because every enum key is now required.',
    input: '{ "email": true }',
    outputLabel: 'VALIDATION RESULT',
    before: '{\n  "success": true,\n  "data": { "email": true }\n}',
    after: '{\n  "success": false\n}',
    beforeOutcome: 'Email preference updated',
    afterOutcome: 'Update rejected: sms is missing',
    change:
      'Records with enum keys are now exhaustive. Every enum key must be present. z.partialRecord() supports partial records.',
    url: 'https://zod.dev/v4/changelog#improves-enum-support',
    finding: 'Changing email preferences suddenly requires SMS.',
    explanation:
      'This settings handler accepts partial updates, but the enum record now requires both email and sms. The same request is rejected after the upgrade.',
  },
];
export function getSource(id: ScenarioId, guarded = false) {
  if (id === 'profile')
    return guarded
      ? `const schema = z.object({\n  name: z.string().default("Guest").optional(),\n});\nconst result = schema.safeParse(input);\n\nif (!result.success) {\n  return { status: "rejected" };\n}\nconst displayName = result.data.name ?? "Guest";\nreturn { displayName };`
      : `const profile = { name: "Ama" };\nconst schema = z.object({\n  name: z.string().default("Guest").optional(),\n});\nconst result = schema.safeParse(input);\n\nif (!result.success) {\n  return { status: "rejected" };\n}\nObject.assign(profile, result.data);\nreturn profile;`;
  if (id === 'price')
    return `const price = z.number().safe();\nconst result = price.safeParse(input);\n\nif (!result.success) {\n  return { status: "rejected" };\n}\nreturn { status: "accepted", price: result.data };`;
  return `const preferences = z.record(\n  z.enum(["email", "sms"]),\n  z.boolean(),\n);\nconst result = preferences.safeParse(input);\n\nif (!result.success) {\n  return { status: "rejected" };\n}\nreturn { status: "updated", patch: result.data };`;
}
