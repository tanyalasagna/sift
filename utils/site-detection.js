// Curated list of supported clothing retailer domains.
// Add new entries here — detection is intentionally modular.
export const SUPPORTED_DOMAINS = new Set([
  'zara.com',
  'hm.com',
  'asos.com',
  'nordstrom.com',
  'uniqlo.com',
  'nike.com',
  'adidas.com',
  'shein.com',
  'shein.us',
  'mango.com',
  'gap.com',
  'lululemon.com',
  'urbanoutfitters.com',
  'forever21.com',
  'net-a-porter.com',
  'everlane.com',
  'abercrombie.com',
  'revolve.com',
  'pacsun.com',
  'freepeople.com',
]);

/**
 * Returns true if the given hostname is a supported clothing retailer.
 * Strips subdomains (e.g. "www.zara.com" → "zara.com") before matching.
 *
 * @param {string} hostname - e.g. location.hostname
 * @returns {boolean}
 */
export function isSupportedSite(hostname) {
  // Normalize: strip leading "www." or other common subdomains
  const normalized = hostname.replace(/^(?:www\.|m\.|shop\.|us\.|uk\.)/i, '');
  return SUPPORTED_DOMAINS.has(normalized);
}
