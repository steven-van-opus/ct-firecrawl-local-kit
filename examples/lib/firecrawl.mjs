// Original HTTP client. Firecrawl runs as a separate, external service.
export async function scrape(url, formats) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol)) throw Error('Use an HTTP or HTTPS page URL.');
  const base = new URL(process.env.FIRECRAWL_API_URL || 'http://127.0.0.1:3002');
  if (!['http:', 'https:'].includes(base.protocol) || base.pathname !== '/') {
    throw Error('FIRECRAWL_API_URL must be a base origin, without /v2 or a path.');
  }
  const timeout = Number(process.env.CT_REQUEST_TIMEOUT_MS || 60000);
  if (!Number.isFinite(timeout) || timeout <= 0) throw Error('Invalid request timeout.');
  const headers = {'Content-Type': 'application/json'};
  if (process.env.FIRECRAWL_API_KEY) headers.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
  const response = await fetch(new URL('/v2/scrape', base), {
    method: 'POST', headers, signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({url: target.href, formats, onlyMainContent: true})
  });
  if (!response.ok) throw Error(`Firecrawl HTTP ${response.status}; previous snapshots kept.`);
  const body = await response.json();
  if (body.success !== true || !body.data || body.data.blocked || body.data.metadata?.statusCode >= 400) {
    throw Error('Firecrawl returned a failed or blocked scrape; previous snapshots kept.');
  }
  return body.data;
}
