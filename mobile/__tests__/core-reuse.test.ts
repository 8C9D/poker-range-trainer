import { ALL_HANDS, generateHandMatrix } from '@core/domain/pokerHands';

// Proves the shared TypeScript core in ../src is reachable from the mobile Jest
// via the @core/* alias and runs unchanged (reuse, not copy).
describe('@core reuse', () => {
  it('exposes all 169 starting hands', () => {
    expect(ALL_HANDS).toHaveLength(169);
  });

  it('builds a 13x13 hand matrix', () => {
    const matrix = generateHandMatrix();
    expect(matrix).toHaveLength(13);
    expect(matrix.every((row) => row.length === 13)).toBe(true);
  });
});
