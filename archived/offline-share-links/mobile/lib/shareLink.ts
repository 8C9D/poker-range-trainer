/**
 * Build the deep link that opens a published share in the app. The web app builds a
 * `${origin}#/r/:id` (or `#/p/:id`) URL from `window.location`; native has no origin, so we mint a
 * scheme URL (`pokerrangetrainer://r/:id`) via expo-linking's `createURL`, which the app's `r/[id]`
 * / `p/[id]` routes already handle. A private share carries its secret as the `token` query param
 * the route reads.
 *
 * `createURL` is passed in so the pure link-shaping logic is testable without the native module.
 */
export type CreateURL = (
  path: string,
  options?: { queryParams?: Record<string, string> },
) => string;

function buildShareLink(createURL: CreateURL, path: string, token: string | null): string {
  return createURL(path, token ? { queryParams: { token } } : undefined);
}

/** Link to a single published range (`r/:id`). */
export function buildRangeShareLink(
  createURL: CreateURL,
  shareId: string,
  token: string | null,
): string {
  return buildShareLink(createURL, `/r/${shareId}`, token);
}

/**
 * Link that carries a whole range inside the URL (`import?range=<hash>`), the native
 * parallel of the web app's `#range=` link. Needs no account and no cloud: the payload
 * IS the range, so it works offline and for signed-out users.
 */
export function buildOfflineRangeLink(createURL: CreateURL, hash: string): string {
  return createURL('/import', { queryParams: { range: hash } });
}

/**
 * Pull the encoded-range payload out of whatever the user pasted: a web share link
 * (`…#range=<hash>`), a native one (`pokerrangetrainer://import?range=<hash>`), or the
 * bare hash. Returns null when no payload is present, so the caller can say so instead
 * of handing garbage to the decoder.
 */
export function extractSharedRangeHash(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /[#?&]range=([^&#\s]+)/.exec(trimmed);
  if (match) return decodeURIComponent(match[1]);
  // A bare payload: base64url only, so anything with URL punctuation is a link we
  // failed to recognize rather than a hash.
  return /^[A-Za-z0-9\-_]+$/.test(trimmed) ? trimmed : null;
}

/** Link to a published library pack (`p/:id`). */
export function buildPackShareLink(
  createURL: CreateURL,
  shareId: string,
  token: string | null,
): string {
  return buildShareLink(createURL, `/p/${shareId}`, token);
}
