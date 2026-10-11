// OPTIONAL same-origin proxy for the Studionet JSON-RPC endpoint.
//
// Why it exists: reads from a browser hit https://studio.genlayer.com/api directly, and that
// endpoint can occasionally answer without CORS headers under load. Reading through this
// proxy makes every request same-origin, so CORS cannot fail.
//
// To use it, build with VITE_RPC_URL=/rpc. Leave it unset to talk to Studionet directly.
// Cloudflare Pages deploys files in /functions automatically.
//
// It is deliberately not an open proxy:
//   * only POST, only to one fixed upstream
//   * only standard method families (eth_, gen_, net_, web3_, zks_); the Studio-specific
//     sim_ methods, which can change simulator state, are never forwarded
//   * browsers from other origins are refused
//   * request size and batch size are capped

const UPSTREAM = 'https://studio.genlayer.com/api';
const ALLOWED_PREFIXES = ['eth_', 'gen_', 'net_', 'web3_', 'zks_'];
const MAX_BODY_CHARS = 256 * 1024;
const MAX_BATCH = 20;

function reply(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

function isAllowedCall(call: unknown): boolean {
  if (typeof call !== 'object' || call === null) return false;
  const method = (call as { method?: unknown }).method;
  return typeof method === 'string' && ALLOWED_PREFIXES.some((prefix) => method.startsWith(prefix));
}

export const onRequest = async (context: { request: Request }): Promise<Response> => {
  const { request } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' }, { allow: 'POST, OPTIONS' });

  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) return reply(403, { error: 'Cross-origin use is not allowed.' });

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return reply(413, { error: 'Request too large.' });

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return reply(400, { error: 'Body must be JSON.' });
  }

  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length === 0 || calls.length > MAX_BATCH || !calls.every(isAllowedCall)) {
    return reply(403, { error: 'This method is not available through the proxy.' });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: text,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return reply(502, { error: 'The Studionet RPC could not be reached.' });
  }
};
