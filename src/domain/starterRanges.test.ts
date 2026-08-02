import { describe, expect, it } from 'vitest'
import {
  buildStarterRanges,
  starterRangeHands,
  starterRangesMissingFrom,
  STARTER_RANGE_TAG,
  STARTER_RANGE_TEMPLATES,
} from './starterRanges'
import { calculateRangePercentage } from './rangeMath'
import { isValidHand } from './pokerHands'
import { matchRangeToSpot, type Spot } from './spot'

function ids() {
  let next = 0
  return () => {
    next += 1
    return `starter-${next}`
  }
}

describe('STARTER_RANGE_TEMPLATES', () => {
  it('has a unique name for every chart', () => {
    const names = STARTER_RANGE_TEMPLATES.map((template) => template.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('expands every chart into valid, non-empty hands', () => {
    for (const template of STARTER_RANGE_TEMPLATES) {
      const hands = starterRangeHands(template)
      expect(hands.length, template.name).toBeGreaterThan(0)
      expect(hands.every(isValidHand), template.name).toBe(true)
      expect(new Set(hands).size, template.name).toBe(hands.length)
    }
  })

  it('records the seat, action, table size, and depth every spot match needs', () => {
    for (const template of STARTER_RANGE_TEMPLATES) {
      expect(template.metadata.position, template.name).toBeTruthy()
      expect(template.metadata.actionType, template.name).toBeTruthy()
      expect(template.metadata.tableSize, template.name).toBe('sixMax')
      expect(template.metadata.stackDepthBb, template.name).toBe(100)
    }
  })

  it('opens wider from every later seat', () => {
    const opens = STARTER_RANGE_TEMPLATES.filter(
      (template) => template.metadata.actionType === 'open',
    )
    expect(opens.map((template) => template.metadata.position)).toEqual([
      'utg',
      'hj',
      'co',
      'btn',
      'sb',
    ])
    // The button is the widest opening seat; the small blind opens tighter than
    // it because two players still act, so only compare through the button.
    const percentages = opens
      .slice(0, 4)
      .map((template) => calculateRangePercentage(starterRangeHands(template)))
    for (let i = 1; i < percentages.length; i += 1) {
      expect(percentages[i]).toBeGreaterThan(percentages[i - 1])
    }
  })

  it('keeps every 3-bet range tighter than the open it faces', () => {
    const byName = new Map(STARTER_RANGE_TEMPLATES.map((template) => [template.name, template]))
    const pairs = [
      ['BTN 3-bet vs CO open (6-max 100bb)', 'CO open (6-max 100bb)'],
      ['SB 3-bet vs BTN open (6-max 100bb)', 'BTN open (6-max 100bb)'],
    ] as const
    for (const [threeBet, open] of pairs) {
      const threeBetPct = calculateRangePercentage(starterRangeHands(byName.get(threeBet)!))
      const openPct = calculateRangePercentage(starterRangeHands(byName.get(open)!))
      expect(threeBetPct, threeBet).toBeLessThan(openPct)
    }
  })
})

describe('buildStarterRanges', () => {
  it('builds one saved range per template with unique ids and shared timestamps', () => {
    const ranges = buildStarterRanges('2026-01-01T00:00:00.000Z', ids())
    expect(ranges).toHaveLength(STARTER_RANGE_TEMPLATES.length)
    expect(new Set(ranges.map((range) => range.id)).size).toBe(ranges.length)
    for (const range of ranges) {
      expect(range.createdAt).toBe('2026-01-01T00:00:00.000Z')
      expect(range.updatedAt).toBe('2026-01-01T00:00:00.000Z')
    }
  })

  it('tags every range so the pack can be filtered or removed as a group', () => {
    for (const range of buildStarterRanges('2026-01-01T00:00:00.000Z', ids())) {
      expect(range.tags).toEqual([STARTER_RANGE_TAG])
    }
  })

  it('notes on every range that the chart is a baseline to edit', () => {
    for (const range of buildStarterRanges('2026-01-01T00:00:00.000Z', ids())) {
      expect(range.metadata?.notes).toMatch(/Starter chart/)
    }
  })

  it('covers the standard spots each chart was written for', () => {
    const ranges = buildStarterRanges('2026-01-01T00:00:00.000Z', ids())
    const spots: Spot[] = [
      { tableSize: 'sixMax', position: 'utg', situation: 'foldedToYou', stackDepthBb: 100 },
      { tableSize: 'sixMax', position: 'btn', situation: 'foldedToYou', stackDepthBb: 100 },
      {
        tableSize: 'sixMax',
        position: 'bb',
        situation: 'facingOpen',
        versusPosition: 'btn',
        stackDepthBb: 100,
      },
      {
        tableSize: 'sixMax',
        position: 'btn',
        situation: 'facingOpen',
        versusPosition: 'co',
        stackDepthBb: 100,
      },
    ]
    for (const spot of spots) {
      expect(matchRangeToSpot(ranges, spot), spot.position).not.toBeNull()
    }
  })

  it('never answers a spot with a chart written for a different seat', () => {
    const ranges = buildStarterRanges('2026-01-01T00:00:00.000Z', ids())
    const match = matchRangeToSpot(ranges, {
      tableSize: 'sixMax',
      position: 'co',
      situation: 'foldedToYou',
      stackDepthBb: 100,
    })
    expect(match?.range.metadata?.position).toBe('co')
  })
})

describe('starterRangesMissingFrom', () => {
  it('offers the whole pack to an empty library', () => {
    expect(starterRangesMissingFrom([])).toHaveLength(STARTER_RANGE_TEMPLATES.length)
  })

  it('skips a chart the library already holds, whatever its case or padding', () => {
    const saved = buildStarterRanges('2026-01-01T00:00:00.000Z', ids())
    const renamed = saved.map((range, index) =>
      index === 0 ? { ...range, name: `  ${range.name.toUpperCase()} ` } : range,
    )

    expect(starterRangesMissingFrom(renamed)).toHaveLength(0)
  })

  it('offers only what is missing after a partial add', () => {
    const partial = buildStarterRanges(
      '2026-01-01T00:00:00.000Z',
      ids(),
      STARTER_RANGE_TEMPLATES.slice(0, 3),
    )

    const missing = starterRangesMissingFrom(partial)

    expect(missing).toHaveLength(STARTER_RANGE_TEMPLATES.length - 3)
    expect(missing.map((template) => template.name)).not.toContain(
      STARTER_RANGE_TEMPLATES[0].name,
    )
  })

  it('ignores unrelated ranges', () => {
    const other = buildStarterRanges('2026-01-01T00:00:00.000Z', ids()).map((range) => ({
      ...range,
      name: `My ${range.name}`,
    }))

    expect(starterRangesMissingFrom(other)).toHaveLength(STARTER_RANGE_TEMPLATES.length)
  })
})

describe('buildStarterRanges with a subset', () => {
  it('builds only the templates it is given', () => {
    const built = buildStarterRanges(
      '2026-01-01T00:00:00.000Z',
      ids(),
      STARTER_RANGE_TEMPLATES.slice(0, 2),
    )

    expect(built.map((range) => range.name)).toEqual([
      STARTER_RANGE_TEMPLATES[0].name,
      STARTER_RANGE_TEMPLATES[1].name,
    ])
  })
})
