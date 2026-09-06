import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { documentTitle, useDocumentTitle } from './document-title'

describe('document title', () => {
  afterEach(cleanup)

  it('names the page under the product, or the product alone', () => {
    expect(documentTitle()).toBe('Rangecraft — Poker Range Trainer')
    expect(documentTitle('Today')).toBe('Today — Rangecraft')
  })

  it('follows the open page', () => {
    const { rerender } = renderHook((page?: string) => useDocumentTitle(page), {
      initialProps: 'Range library',
    })
    expect(document.title).toBe('Range library — Rangecraft')
    rerender(undefined)
    expect(document.title).toBe('Rangecraft — Poker Range Trainer')
  })
})
