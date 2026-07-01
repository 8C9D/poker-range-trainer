import { resolveSwipeAnswer } from '../components/swipeAnswer';

describe('resolveSwipeAnswer', () => {
  it('maps a decisive right swipe to "in" and left swipe to "out"', () => {
    expect(resolveSwipeAnswer(100)).toBe('in');
    expect(resolveSwipeAnswer(-100)).toBe('out');
  });

  it('ignores swipes shorter than the threshold', () => {
    expect(resolveSwipeAnswer(10)).toBeNull();
    expect(resolveSwipeAnswer(-10)).toBeNull();
    expect(resolveSwipeAnswer(0)).toBeNull();
  });

  it('counts a swipe exactly at the threshold (inclusive boundary)', () => {
    expect(resolveSwipeAnswer(60)).toBe('in');
    expect(resolveSwipeAnswer(-60)).toBe('out');
    expect(resolveSwipeAnswer(59)).toBeNull();
    expect(resolveSwipeAnswer(-59)).toBeNull();
  });

  it('honors a custom threshold', () => {
    expect(resolveSwipeAnswer(40, 30)).toBe('in');
    expect(resolveSwipeAnswer(40, 50)).toBeNull();
  });
});
