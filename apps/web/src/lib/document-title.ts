import { useEffect } from 'react'

const SITE_TITLE = 'Rangecraft — Poker Range Trainer'

/** The tab title for a page: its name under the product name, or the product alone. */
export function documentTitle(page?: string): string {
  return page === undefined ? SITE_TITLE : `${page} — Rangecraft`
}

/** Keep `document.title` in step with the open page; a single-page app has no metadata export. */
export function useDocumentTitle(page?: string): void {
  useEffect(() => {
    document.title = documentTitle(page)
  }, [page])
}
