import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserTimeZone } from './time-zone'

describe('browserTimeZone', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the zone the browser resolved', () => {
    expect(browserTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('falls back to UTC when the environment cannot name its own zone', () => {
    const resolved = { locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn' }
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => resolved,
    } as unknown as Intl.DateTimeFormat)
    expect(browserTimeZone()).toBe('UTC')

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no ICU data')
    })
    expect(browserTimeZone()).toBe('UTC')
  })
})
