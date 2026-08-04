import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountScreen } from './AccountScreen'
import { LibraryScreen } from './LibraryScreen'
import { ProgressScreen } from './ProgressScreen'
import { RangeScreen } from './RangeScreen'
import { TodayScreen } from './TodayScreen'
import { ModePicker, type PracticeMode } from '../practice/ModePicker'
import { PracticeHost } from '../practice/PracticeHost'
import { SessionSummary } from '../practice/SessionSummary'
import { RANGE_TABS } from '../app/routes'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import { saveSavedRange } from '../storage/rangeStorage'
import type { SavedRange } from '../types/range'

/**
 * An `aria-label` on a plain `<div>` or `<span>` is not a small mistake — it is
 * dropped entirely. Those elements map to the `generic` role, which cannot carry
 * an accessible name, so the label reads as care taken while the control stays
 * anonymous. Three had accumulated that way (the combo grids, the per-action
 * summary, the mode picker), each looking labelled in the source.
 *
 * Elements with an implicit role of their own (`ul`, `nav`, `section`, `table`,
 * form controls…) take a name fine, so this only flags the nameless ones.
 */

const NAMELESS = new Set(['DIV', 'SPAN', 'P', 'B', 'I', 'EM', 'STRONG', 'SMALL', 'CODE', 'PRE'])

beforeEach(() => {
  localStorage.clear()
})

const NOW = new Date().toISOString()

function seed(id: string, name: string): SavedRange {
  const range: SavedRange = {
    id,
    name,
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { position: 'btn', actionType: 'open', tableSize: 'sixMax', stackDepthBb: 100 },
  }
  saveSavedRange(range)
  return range
}

/** Every labelled element the browser would refuse to name. */
function droppedLabels(): string[] {
  return Array.from(document.querySelectorAll('[aria-label]'))
    .filter((el) => NAMELESS.has(el.tagName) && !el.getAttribute('role'))
    .map((el) => `${el.tagName}.${el.className}: "${el.getAttribute('aria-label')}"`)
}

describe('accessible names', () => {
  it('has something to check', () => {
    // Guards the guard: a screen that rendered nothing would pass every case.
    seed('a', 'BTN open')
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    expect(document.querySelectorAll('[aria-label]').length).toBeGreaterThan(3)
  })

  it('never labels an element that cannot carry a name on Today', () => {
    seed('a', 'BTN open')
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)
    expect(droppedLabels()).toEqual([])
  })

  it('never labels an element that cannot carry a name on Library', () => {
    seed('a', 'BTN open')
    render(<LibraryScreen onPlaySpots={vi.fn()} onPracticeSelected={vi.fn()} />)
    expect(droppedLabels()).toEqual([])
  })

  it('never labels an element that cannot carry a name on Progress', () => {
    seed('a', 'BTN open')
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 6 }, NOW)
    recordHandAccuracy('a', [
      { hand: 'AA', attempts: 3, correct: 1, falsePositives: 0, falseNegatives: 2 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)
    expect(droppedLabels()).toEqual([])
  })

  it('never labels an element that cannot carry a name on Account', () => {
    seed('a', 'BTN open')
    render(<AccountScreen />)
    expect(droppedLabels()).toEqual([])
  })

  it.each(RANGE_TABS)('never labels an element that cannot carry a name on the %s tab', (tab) => {
    seed('a', 'BTN open')
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 6 }, NOW)
    recordHandAccuracy('a', [
      { hand: 'AA', attempts: 3, correct: 1, falsePositives: 0, falseNegatives: 2 },
    ])
    render(<RangeScreen id="a" tab={tab} onPractice={vi.fn()} />)
    expect(droppedLabels()).toEqual([])
  })

  it('never labels an element that cannot carry a name in the mode picker', () => {
    const range = seed('a', 'BTN open')
    render(<ModePicker range={range} onPick={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Choose practice mode' })).toBeInTheDocument()
    expect(droppedLabels()).toEqual([])
  })
})

/**
 * The drills are where the app spends most of its time and where most of these
 * had collected — the quiz stats, both answer palettes, the dealt combo, the
 * flop, the build score and the session summary were all labelled and all mute.
 * Driving the real host rather than each component keeps this honest about what
 * a practising user actually reaches.
 */
describe('accessible names in practice', () => {
  const DRILLED: PracticeMode[] = [
    'recognize',
    'timed',
    'weakness',
    'edges',
    'build',
    'action',
    'mixed',
    'combo',
    'board',
  ]

  function drillable(): SavedRange {
    const range: SavedRange = {
      id: 'a',
      name: 'BTN open',
      // Enough hands that the edge drill has a boundary to work with.
      hands: ['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AKo'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      // The action and frequency quizzes only appear for a range that has them.
      handActions: { AA: 'raise', KK: 'raise', AKs: 'call' },
      mixedStrategies: {
        AA: [
          { action: 'raise', frequency: 75 },
          { action: 'call', frequency: 25 },
        ],
      },
    }
    saveSavedRange(range)
    return range
  }

  it.each(DRILLED)('never labels an element that cannot carry a name in the %s drill', (mode) => {
    const range = drillable()
    render(<PracticeHost request={{ ranges: [range], mode }} onClose={vi.fn()} />)
    expect(droppedLabels()).toEqual([])
  })

  it('never labels an element that cannot carry a name on the summary', () => {
    render(
      <SessionSummary
        data={{
          totalQuestions: 10,
          correctAnswers: 8,
          accuracy: 80,
          deltaLine: 'Up 5 points from your last session.',
          goalLine: '8 of 20 hands today.',
          streakLine: '3 day streak.',
        }}
        hasNext
        onNext={vi.fn()}
        onDone={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: 'Session summary' })).toBeInTheDocument()
    expect(droppedLabels()).toEqual([])
  })
})
