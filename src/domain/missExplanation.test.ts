import { describe, expect, it } from 'vitest'
import { explainHand, gridNeighbours, handNoteFor } from './missExplanation'

describe('gridNeighbours', () => {
  it('gives four neighbours for a hand in the middle of the grid', () => {
    // 99 sits on the diagonal with pairs above/below and suited/offsuit either side.
    expect(gridNeighbours('99').sort()).toEqual(['T9s', '98s', 'T9o', '98o'].sort())
  })

  it('clips at the corners of the grid', () => {
    expect(gridNeighbours('AA').sort()).toEqual(['AKo', 'AKs'].sort())
    expect(gridNeighbours('22').sort()).toEqual(['32o', '32s'].sort())
  })

  it('rejects a non-canonical hand', () => {
    expect(() => gridNeighbours('XX')).toThrow(/Invalid hand/)
  })
})

describe('explainHand', () => {
  it('reports class coverage and neighbours for a hand in the range', () => {
    // 98s sits between T8s / 88 / 99 / 97s on the grid; 97s and 88 are in.
    const explanation = explainHand('98s', ['98s', '87s', '97s', '88'])

    expect(explanation.inRange).toBe(true)
    expect(explanation.handClass).toBe('suitedConnector')
    expect(explanation.classInRange).toBe(2)
    expect(explanation.classTotal).toBe(8)
    expect(explanation.neighbours.sort()).toEqual(['T8s', '88', '99', '97s'].sort())
    expect(explanation.neighboursInRange).toBe(2)
    expect(explanation.line).toBe(
      '98s is in: this range plays 2 of 8 suited connectors, and 2 of its 4 neighbours are in. It sits right on the range edge.',
    )
  })

  it('explains a hand that is out of the range', () => {
    const explanation = explainHand('K8s', ['AA', 'KK'])

    expect(explanation.inRange).toBe(false)
    expect(explanation.classInRange).toBe(0)
    expect(explanation.line).toMatch(/^K8s is out: this range plays 0 of \d+ other suited hands/)
    expect(explanation.line).toContain('0 of its 4 neighbours are in')
  })

  it('flags a hand as borderline only when a neighbour is treated differently', () => {
    const island = explainHand('AA', ['AA'])
    expect(island.borderline).toBe(true)

    const solid = explainHand('AA', ['AA', 'AKs', 'AKo'])
    expect(solid.borderline).toBe(false)
    expect(solid.line).not.toContain('range edge')

    const outside = explainHand('22', [])
    expect(outside.borderline).toBe(false)
  })

  it('rejects a non-canonical hand', () => {
    expect(() => explainHand('XX', [])).toThrow(/Invalid hand/)
  })
})

describe('handNoteFor', () => {
  it('returns the note the user wrote about the hand', () => {
    expect(handNoteFor({ handNotes: { AJo: 'Only vs weak blinds.' } }, 'AJo')).toBe(
      'Only vs weak blinds.',
    )
  })

  it('returns null for a hand with no note, and for a chart with none at all', () => {
    expect(handNoteFor({ handNotes: { AJo: 'Only vs weak blinds.' } }, 'AA')).toBeNull()
    expect(handNoteFor({}, 'AA')).toBeNull()
  })

  it('treats a blank note as no note', () => {
    expect(handNoteFor({ handNotes: { AA: '   ' } }, 'AA')).toBeNull()
  })

  it('keeps a note that fits the limit exactly', () => {
    const note = 'x'.repeat(140)
    expect(handNoteFor({ handNotes: { AA: note } }, 'AA')).toBe(note)
  })

  it('cuts an over-long note back to the last whole word', () => {
    const note = `${'word '.repeat(40)}tail`
    const shown = handNoteFor({ handNotes: { AA: note } }, 'AA')

    expect(shown).toMatch(/word…$/)
    expect(shown!.length).toBeLessThanOrEqual(141)
  })

  it('cuts mid-word rather than to almost nothing when the note has no early space', () => {
    const note = `${'x'.repeat(130)} and then some more`
    expect(handNoteFor({ handNotes: { AA: note } }, 'AA')).toBe(`${'x'.repeat(130)} and then…`)
  })
})
