import { render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { SessionSummary } from '../components/practice/SessionSummary';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SessionSummary', () => {
  it('stops its entrance animation when it unmounts', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const stop = jest.fn();
    const start = jest.fn();
    jest.spyOn(Animated, 'parallel').mockReturnValue({ start, stop, reset: jest.fn() });

    const { unmount } = await render(
      <SessionSummary
        data={{
          totalQuestions: 10,
          correctAnswers: 8,
          accuracy: 80,
          deltaLine: null,
          streakLine: null,
        }}
        hasNext={false}
        onNext={jest.fn()}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    await unmount();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
