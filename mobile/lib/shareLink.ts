/**
 * Build the deep link that opens a published shared range in the app. The web app builds a
 * `${origin}#/r/:id` URL from `window.location`; native has no origin, so we mint a scheme URL
 * (`pokerrangetrainer://r/:id`) via expo-linking's `createURL`, which the app's `r/[id]` route
 * already handles. A private share carries its secret as the `token` query param the route reads.
 *
 * `createURL` is passed in so the pure link-shaping logic is testable without the native module.
 */
export type CreateURL = (
  path: string,
  options?: { queryParams?: Record<string, string> },
) => string;

export function buildRangeShareLink(
  createURL: CreateURL,
  shareId: string,
  token: string | null,
): string {
  return createURL(`/r/${shareId}`, token ? { queryParams: { token } } : undefined);
}
