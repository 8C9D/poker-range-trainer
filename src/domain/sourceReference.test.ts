import { describe, expect, it } from 'vitest'
import { sourceReferenceUrl } from './sourceReference'

describe('sourceReferenceUrl', () => {
  it('accepts absolute HTTP and HTTPS references', () => {
    expect(sourceReferenceUrl('https://example.com/spot')).toBe('https://example.com/spot')
    expect(sourceReferenceUrl(' http://example.com/chart ')).toBe('http://example.com/chart')
  })

  it('keeps citations and unsafe schemes as plain text', () => {
    expect(sourceReferenceUrl('GTOWizard 6-max')).toBeNull()
    expect(sourceReferenceUrl('javascript:alert(1)')).toBeNull()
    expect(sourceReferenceUrl('https://')).toBeNull()
    expect(sourceReferenceUrl(undefined)).toBeNull()
  })
})
