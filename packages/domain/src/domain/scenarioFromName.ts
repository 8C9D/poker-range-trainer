import {
  ACTION_TYPE_LABELS,
  POSITION_LABELS,
  TABLE_SIZE_LABELS,
  type ActionType,
  type Position,
  type RangeMetadata,
  type TableSize,
} from '../types/range'

/**
 * Reading a range's scenario back out of the name it was saved under.
 *
 * Half the app keys off scenario metadata rather than the name: the spot drill,
 * the coverage map, the weakest-spots list, and the seat/action leak reports all
 * ask a range which seat and action it answers, and a range that never filled the
 * dropdowns answers nothing. Meanwhile users name ranges exactly the way the app
 * does — "SB 3-bet vs BTN open (6-max 100bb)" — so the scenario is usually right
 * there in the name, just not anywhere the app can read it.
 *
 * This parses that name into metadata. It is only ever a SUGGESTION: names are
 * free text, so nothing here writes itself into a range. Pure.
 */

/** Seat words, longest spelling first so "BUTTON" never matches as "BU" + text. */
const SEAT_PATTERNS: readonly { pattern: RegExp; position: Position }[] = [
  { pattern: /\bUTG(?:\+?\d)?\b/, position: 'utg' },
  { pattern: /\b(?:HJ|HIJACK|MP|LJ|LOJACK)\b/, position: 'hj' },
  { pattern: /\b(?:CO|CUTOFF)\b/, position: 'co' },
  { pattern: /\b(?:BTN|BUTTON|BU)\b/, position: 'btn' },
  { pattern: /\b(?:SB|SMALL BLIND)\b/, position: 'sb' },
  { pattern: /\b(?:BB|BIG BLIND)\b/, position: 'bb' },
]

/**
 * Action words. Order matters: "call jam" is its own action rather than a call
 * and a jam, and the numbered raises have to be tried before a bare "bet".
 */
const ACTION_PATTERNS: readonly { pattern: RegExp; actionType: ActionType }[] = [
  { pattern: /\bCALL(?:ING)? (?:A |THE )?(?:JAM|SHOVE|ALL[- ]?IN)\b/, actionType: 'callJam' },
  { pattern: /\b(?:3|THREE)[- ]?(?:BET|B)\b/, actionType: 'threeBet' },
  { pattern: /\b(?:4|FOUR)[- ]?(?:BET|B)\b/, actionType: 'fourBet' },
  { pattern: /\b(?:OPEN|RFI|RAISE FIRST IN)\b/, actionType: 'open' },
  { pattern: /\bDEFEN(?:D(?:ING)?|[CS]E)\b/, actionType: 'defend' },
  { pattern: /\b(?:JAM|SHOVE|PUSH|ALL[- ]?IN)\b/, actionType: 'jam' },
  { pattern: /\bCALL\b/, actionType: 'call' },
]

const TABLE_SIZE_PATTERNS: readonly { pattern: RegExp; tableSize: TableSize }[] = [
  { pattern: /\b(?:HEADS?[- ]?UP|HU)\b/, tableSize: 'headsUp' },
  { pattern: /\b6[- ]?MAX\b/, tableSize: 'sixMax' },
  { pattern: /\b(?:9[- ]?MAX|FULL[- ]?RING)\b/, tableSize: 'nineMax' },
]

/** "vs", "v" and "against" all split hero's side of the name from the opponent's. */
const VERSUS = /\b(?:VS|V|AGAINST)\b/

/** A stack depth written the way players write it: 100bb, 40 bb, 12.5bb. */
const STACK_DEPTH = /\b(\d+(?:\.\d+)?)\s*BB\b/

/**
 * Uppercase and flatten punctuation the vocabularies do not use, so a name reads
 * as words no matter how it was typed. Hyphens survive: they are part of "3-bet"
 * and "6-max", and the patterns that want them spell them optional anyway.
 */
function normalize(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9+.\-\s]+/g, ' ')
}

/** The first match of `pattern` in `text`, or null. */
function findAt(text: string, pattern: RegExp): { index: number; length: number } | null {
  const match = pattern.exec(text)
  return match ? { index: match.index, length: match[0].length } : null
}

/**
 * The scenario a range's name describes: hero's seat and action, the opponent it
 * is against, the table size, and the stack depth — whichever of those the name
 * actually spells out. An unreadable name yields an empty object.
 *
 * Hero vs opponent is decided by the "vs": the seat AFTER it is the opponent, and
 * hero is the first seat before it. Likewise the action: "BB defend vs BTN open"
 * names two actions, and the one on hero's side of the "vs" is hero's.
 */
export function inferScenarioFromName(name: string): RangeMetadata {
  // The depth goes first so its "bb" can never be read as the big blind.
  const withDepth = normalize(name)
  const depthMatch = STACK_DEPTH.exec(withDepth)
  const text = depthMatch
    ? withDepth.slice(0, depthMatch.index) + ' '.repeat(depthMatch[0].length) +
      withDepth.slice(depthMatch.index + depthMatch[0].length)
    : withDepth

  const scenario: RangeMetadata = {}

  if (depthMatch) {
    const depth = Number(depthMatch[1])
    if (Number.isFinite(depth) && depth > 0) scenario.stackDepthBb = depth
  }

  for (const { pattern, tableSize } of TABLE_SIZE_PATTERNS) {
    if (pattern.test(text)) {
      scenario.tableSize = tableSize
      break
    }
  }

  const versus = findAt(text, VERSUS)
  const splitAt = versus ? versus.index : text.length
  const heroSide = text.slice(0, splitAt)
  const versusSide = versus ? text.slice(versus.index + versus.length) : ''

  const seats = SEAT_PATTERNS.map(({ pattern, position }) => ({
    position,
    hero: findAt(heroSide, pattern),
    opponent: findAt(versusSide, pattern),
  }))

  const hero = seats
    .filter((seat) => seat.hero !== null)
    .sort((a, b) => a.hero!.index - b.hero!.index)[0]
  if (hero) scenario.position = hero.position

  const opponent = seats
    .filter((seat) => seat.opponent !== null)
    .sort((a, b) => a.opponent!.index - b.opponent!.index)[0]
  // A "vs" with no seat after it says nothing, and an opponent equal to hero is a
  // misread rather than a spot — no one 3-bets themselves.
  if (opponent && opponent.position !== scenario.position) {
    scenario.versusPosition = opponent.position
  }

  // Hero's action is the one on hero's side; a name that only names the villain's
  // action ("vs a BTN open") leaves it unset rather than claiming hero opened.
  const actions = ACTION_PATTERNS.map(({ pattern, actionType }) => ({
    actionType,
    at: findAt(heroSide, pattern),
  })).filter((action) => action.at !== null)
  if (actions.length > 0) {
    // Earliest wins, and the pattern order breaks a tie between overlapping
    // spellings ("call jam" starts where "call" does, and is the more specific).
    const first = actions.reduce((best, action) =>
      action.at!.index < best.at!.index ? action : best,
    )
    scenario.actionType = first.actionType
  }

  return scenario
}

/**
 * What {@link inferScenarioFromName} could ADD to `current` — the fields the name
 * describes and the range has not already recorded — or null when the name adds
 * nothing. Never contradicts a value the user set: a field already filled in is
 * left alone, whatever the name says.
 */
export function scenarioSuggestionFor(
  name: string,
  current: RangeMetadata | undefined,
): RangeMetadata | null {
  const inferred = inferScenarioFromName(name)
  const suggestion: RangeMetadata = {}
  if (inferred.position && !current?.position) suggestion.position = inferred.position
  if (inferred.actionType && !current?.actionType) suggestion.actionType = inferred.actionType
  if (inferred.versusPosition && !current?.versusPosition) {
    suggestion.versusPosition = inferred.versusPosition
  }
  if (inferred.tableSize && !current?.tableSize) suggestion.tableSize = inferred.tableSize
  if (inferred.stackDepthBb && current?.stackDepthBb === undefined) {
    suggestion.stackDepthBb = inferred.stackDepthBb
  }
  return Object.keys(suggestion).length > 0 ? suggestion : null
}

/** The suggestion in plain words, e.g. `SB · 3-bet · vs BTN · 6-max · 100bb`. */
export function describeScenario(scenario: RangeMetadata): string {
  const parts: string[] = []
  if (scenario.position) parts.push(POSITION_LABELS[scenario.position])
  if (scenario.actionType) parts.push(ACTION_TYPE_LABELS[scenario.actionType])
  if (scenario.versusPosition) parts.push(`vs ${POSITION_LABELS[scenario.versusPosition]}`)
  if (scenario.tableSize) parts.push(TABLE_SIZE_LABELS[scenario.tableSize])
  if (scenario.stackDepthBb !== undefined) parts.push(`${scenario.stackDepthBb}bb`)
  return parts.join(' · ')
}
