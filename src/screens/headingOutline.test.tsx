import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountScreen } from './AccountScreen'
import { LibraryScreen } from './LibraryScreen'
import { ProgressScreen } from './ProgressScreen'
import { RangeScreen } from './RangeScreen'
import { TodayScreen } from './TodayScreen'
import { RANGE_TABS } from '../app/routes'
import { recordHandAccuracy } from '../storage/handAccuracyStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { saveSavedRange } from '../storage/rangeStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import type { SavedRange } from '../types/range'

/**
 * A screen reader navigates by heading level, so the levels are the page's table
 * of contents. Jumping h1 → h3 (as the Library, Progress and Account cards did)
 * reads as a missing section: the listener cannot tell whether they are inside
 * something or have skipped past it.
 *
 * Each screen is rendered with enough data that its optional cards appear, since
 * an empty screen has too few headings to catch anything.
 */

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

/** Every heading's level, in document order. */
function outline(): number[] {
  return screen
    .getAllByRole('heading')
    .map((heading) => Number(heading.tagName.slice(1)))
}

function firstSkip(levels: number[]): string | null {
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) return `h${levels[i - 1]} → h${levels[i]}`
  }
  return null
}

describe('heading outline', () => {
  it('never skips a level on Today', () => {
    seed('a', 'BTN open')
    render(<TodayScreen onStartReview={vi.fn()} onPlaySpots={vi.fn()} onStartWorkout={vi.fn()} />)

    const levels = outline()
    expect(levels[0]).toBe(1)
    expect(firstSkip(levels)).toBeNull()
  })

  it('never skips a level on Library', () => {
    seed('a', 'BTN open')
    render(<LibraryScreen onPlaySpots={vi.fn()} />)

    const levels = outline()
    expect(levels[0]).toBe(1)
    expect(firstSkip(levels)).toBeNull()
  })

  it('never skips a level on Progress', () => {
    seed('a', 'BTN open')
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 6 }, NOW)
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 6 }, NOW)
    recordHandAccuracy('a', [
      { hand: 'AA', attempts: 3, correct: 1, falsePositives: 0, falseNegatives: 2 },
    ])
    render(<ProgressScreen onDrillWeakHands={vi.fn()} onDrillSpot={vi.fn()} />)

    const levels = outline()
    // The seeded misses bring out "Where you leak" and its two ranked columns,
    // which is where the deepest nesting lives.
    expect(levels).toContain(3)
    expect(firstSkip(levels)).toBeNull()
  })

  it('never skips a level on Account', () => {
    seed('a', 'BTN open')
    render(<AccountScreen />)

    const levels = outline()
    expect(levels[0]).toBe(1)
    expect(firstSkip(levels)).toBeNull()
  })

  it.each(RANGE_TABS)('never skips a level on the range %s tab', (tab) => {
    seed('a', 'BTN open')
    recordPracticeSessionHistory('a', { totalQuestions: 10, correctAnswers: 6 }, NOW)
    recordHandAccuracy('a', [
      { hand: 'AA', attempts: 3, correct: 1, falsePositives: 0, falseNegatives: 2 },
    ])
    render(<RangeScreen id="a" tab={tab} onPractice={vi.fn()} />)

    const levels = outline()
    expect(levels[0]).toBe(1)
    expect(firstSkip(levels)).toBeNull()
  })
})
