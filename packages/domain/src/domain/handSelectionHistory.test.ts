import { describe, expect, it } from 'vitest'
import {
  createHandSelectionHistory,
  recordHandSelection,
  redoHandSelection,
  undoHandSelection,
} from './handSelectionHistory'

describe('hand selection history', () => {
  it('records canonical snapshots and ignores equivalent selections', () => {
    const initial = createHandSelectionHistory(['AKs'])
    const recorded = recordHandSelection(initial, ['QQ', 'AKs'])

    expect(recorded).toEqual({
      past: [['AKs']],
      present: ['AKs', 'QQ'],
      future: [],
    })
    expect(recordHandSelection(recorded, ['AKs', 'QQ'])).toBe(recorded)
  })

  it('undoes and redoes selection changes', () => {
    const one = recordHandSelection(createHandSelectionHistory(), ['AA'])
    const two = recordHandSelection(one, ['AA', 'KK'])

    const undone = undoHandSelection(two)
    expect(undone.present).toEqual(['AA'])
    expect(undone.future).toEqual([['AA', 'KK']])

    const redone = redoHandSelection(undone)
    expect(redone.present).toEqual(['AA', 'KK'])
    expect(redone.future).toEqual([])
  })

  it('clears redo history when a new selection is recorded', () => {
    const one = recordHandSelection(createHandSelectionHistory(), ['AA'])
    const two = recordHandSelection(one, ['AA', 'KK'])
    const undone = undoHandSelection(two)
    const branched = recordHandSelection(undone, ['AA', 'QQ'])

    expect(branched.future).toEqual([])
    expect(redoHandSelection(branched)).toBe(branched)
  })

  it('keeps only the configured number of past snapshots', () => {
    const first = recordHandSelection(createHandSelectionHistory(), ['AA'], 2)
    const second = recordHandSelection(first, ['KK'], 2)
    const third = recordHandSelection(second, ['QQ'], 2)

    expect(third.past).toEqual([['AA'], ['KK']])
    expect(undoHandSelection(undoHandSelection(undoHandSelection(third))).present).toEqual([
      'AA',
    ])
  })

  it('leaves history unchanged when undo or redo is unavailable', () => {
    const history = createHandSelectionHistory(['AA'])

    expect(undoHandSelection(history)).toBe(history)
    expect(redoHandSelection(history)).toBe(history)
  })
})
