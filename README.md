# Upgrade Lens

A small TypeScript experiment: run the same input through Zod 3 and 4, then ask TypeSafe Jev whether a documented upgrade change affects the application using it.

Three examples: optional defaults overwriting a name, decimal prices failing `.safe()`, and partial preferences failing an exhaustive enum record. The profile example also includes a consumer with a fallback whose final output stays the same.

## Run locally

Use Node 22.18+ (Node 24+ recommended).

```sh
npm install
npm run dev
```

Open the URL printed by the server. No API key is needed for the actual Zod comparisons. Select **Connect Jev**, enter a TypeSafe API key from https://console.typesafe.ai/, and run an assessment. Requests are charged to that key's TypeSafe account.

Keys are kept in React memory and passed to the server for that request. They are not written to browser storage, source files, report exports, or application logs. Refreshing the page clears the key. Never include a key in a screenshot or a commit.

## What is real, and what is illustrative

- Before/after results execute the installed `zod/v3` and `zod/v4` implementations. The lockfile pins the package version.
- Application snippets and migration summaries are curated fixtures.
- The initial guidance is authored and clearly labeled **no AI call**. It contains no invented probabilities or latency claims.
- Live mode calls `POST https://api.typesafe.ai/v1/systemone`, pinned to the documented `jev-1.13.0` model, with three independent Choice questions. It displays the response's model, distributions, and elapsed time.
- Jev receives the source, input, and migration note; executed results and example verdicts are withheld.
- The app templates result prose. Jev supplies decisions and probabilities, not generated explanations.
- API failures remain errors. They never silently fall back to example results presented as AI responses.
- This is a three-case demo, not a repository scanner or a compatibility guarantee.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Tests execute the real library comparisons. API transport tests use explicitly mocked responses and do not verify live TypeSafe access. A valid key is needed to verify a real Jev result.

## A 45-second demonstration

1. Open the profile example: a missing name becomes `Guest` after upgrading.
2. Open **The code** to show why saving every parsed field causes the problem.
3. Connect Jev and run the three semantic checks.
4. Toggle **Try a safe usage** and run Jev again. The parser still changes, but the displayed name is unchanged.
5. Expand **What exactly does Jev see?** to show the typed questions and context.
6. Export a report; its provenance states whether it contains a live response.

## LinkedIn draft

Use after completing a real Jev run:

> I built Upgrade Lens, a small TypeScript demo exploring a question that comes up during dependency upgrades: a library's behavior changed—but does it actually affect this code?
>
> It runs the same input through Zod 3 and 4, then asks TypeSafe Jev three focused questions about the API usage, trigger condition, and application result.
>
> My favorite example: an optional default changes the parsed data in both cases, but only one consumer ends up with a different result. Context matters.
>
> Jev returns typed decisions and probabilities. The app shows those alongside the executed behavior, so you can inspect the judgment yourself.
>
> A focused experiment with three examples, built to learn by shipping.

If a real Jev run has not been completed, describe it as an integration-ready demo and say live verification is pending.

## Sources

- https://zod.dev/v4/changelog
- https://docs.typesafe.ai/introduction/quickstart
- https://docs.typesafe.ai/confidence
- https://docs.typesafe.ai/models
