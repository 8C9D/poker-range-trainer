import { GOAL_OPTIONS } from '@poker-range-trainer/domain/domain/trainingGoal'

interface GoalSelectProps {
  /** The stored target in hands, or `null` when the daily goal is off. */
  target: number | null
  label: string
  className: string
  disabled: boolean
  onChange: (target: number | null) => void
}

/**
 * The daily-goal picker, shared by Today and Account so the two cannot drift.
 *
 * A target saved before these options existed (or restored from a legacy
 * backup) still has to be selectable, or opening the picker would silently
 * move the goal.
 */
export function GoalSelect({ target, label, className, disabled, onChange }: GoalSelectProps) {
  const options =
    target === null || (GOAL_OPTIONS as readonly number[]).includes(target)
      ? [...GOAL_OPTIONS]
      : [...GOAL_OPTIONS, target].sort((left, right) => left - right)

  return (
    <select
      className={className}
      aria-label={label}
      value={target === null ? '' : String(target)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
    >
      <option value="">Off</option>
      {options.map((option) => (
        <option key={option} value={String(option)}>
          {option} hands
        </option>
      ))}
    </select>
  )
}
