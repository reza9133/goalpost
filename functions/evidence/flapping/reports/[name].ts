// ADVERSARIAL evidence endpoint. It serves a different Meridian demonstration report on every
// request, chosen at random, so independent validators fetching "the same" URL read different
// documents. It exists to produce live evidence that the contract refuses to record a verdict
// the validators do not share. It is never part of a normal flow.
//
// Only fictional demonstration pages are served, and only from this site's own /evidence tree.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export const VARIANTS = [
  '/evidence/meridian/reports/2026-faithful.html',
  '/evidence/meridian/reports/2026-silent.html',
  '/evidence/meridian/reports/2026-disclosed.html',
] as const;

export function pickVariant(random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32): string {
  const index = Math.min(VARIANTS.length - 1, Math.floor(random() * VARIANTS.length));
  return VARIANTS[index];
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const variant = pickVariant();
  const upstream = await env.ASSETS.fetch(new Request(new URL(variant, request.url).toString()));
  const headers = new Headers(upstream.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-robots-tag', 'noindex');
  return new Response(upstream.body, { status: upstream.status, headers });
};
