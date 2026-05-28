/**
 * The shared accuracy convention used across the practice-scoring helpers.
 *
 * Returns `correct / total * 100` as a 0–100 percentage, guarding the zero-total
 * case so it yields 0 rather than `NaN`. Pure: no React, no storage. Callers
 * extract their own `correct`/`total` fields and pass raw numbers, so this stays
 * decoupled from any particular stats shape.
 */
export function accuracyPercentage(correct: number, total: number): number {
  return total === 0 ? 0 : (correct / total) * 100
}
