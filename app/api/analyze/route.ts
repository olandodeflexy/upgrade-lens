import { z } from 'zod/v4';
import { buildJevRequest, jevResponseSchema } from '../../../lib/jev.ts';

const requestSchema = z.object({
  scenario: z.enum(['profile', 'price', 'preferences']),
  guarded: z.boolean().default(false),
  input: z.json(),
  apiKey: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((value) => !/[\r\n]/.test(value)),
});
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const error = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return error('Send a JSON request.', 415);
  if (Number(request.headers.get('content-length') ?? 0) > 16000)
    return error(
      'This example is too large. Keep the input under 4,000 characters.',
      413,
    );
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 16000) return error('This example is too large.', 413);
    raw = JSON.parse(body);
  } catch {
    return error('The request is not valid JSON.', 400);
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success)
    return error(
      'Choose a valid example and enter your TypeSafe API key.',
      400,
    );
  const { scenario, guarded, input, apiKey } = parsed.data;
  if (JSON.stringify(input).length > 4000)
    return error('Keep the example input under 4,000 characters.', 413);
  const started = Date.now();
  try {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildJevRequest(scenario, input, guarded)),
      signal: AbortSignal.timeout(25000),
    });
    if (response.status === 401 || response.status === 403)
      return error(
        'TypeSafe did not accept this key. Check your key and account access, then try again.',
        401,
      );
    if (response.status === 429)
      return error(
        'TypeSafe is rate-limiting requests. Wait a moment and try again.',
        429,
      );
    if (!response.ok)
      return error(
        `TypeSafe could not complete the request (status ${response.status}). Try again shortly.`,
        502,
      );
    const result = jevResponseSchema.safeParse(await response.json());
    if (!result.success)
      return error(
        'TypeSafe returned an unexpected response. No assessment was substituted. Please try again.',
        502,
      );
    return Response.json(
      {
        ...result.data,
        mode: 'live',
        elapsedMs: Date.now() - started,
        analyzedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch (cause) {
    if (
      cause instanceof Error &&
      (cause.name === 'TimeoutError' || cause.name === 'AbortError')
    )
      return error('Jev took too long to respond. Please try again.', 504);
    return error(
      'Could not reach TypeSafe. Check your connection and try again.',
      502,
    );
  }
}
