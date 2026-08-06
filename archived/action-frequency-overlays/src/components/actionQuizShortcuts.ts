import type { RangeAction } from '../types/range'

export const ACTION_SHORTCUTS: Record<RangeAction, string> = {
  fold: 'F',
  call: 'C',
  raise: 'R',
  threeBet: '3',
  fourBet: '4',
  jam: 'J',
  mixed: 'M',
}

export const ACTION_BY_SHORTCUT = Object.fromEntries(
  Object.entries(ACTION_SHORTCUTS).map(([action, key]) => [key.toLowerCase(), action]),
) as Record<string, RangeAction>
