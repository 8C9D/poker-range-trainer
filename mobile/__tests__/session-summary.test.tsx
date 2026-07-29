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
    jest.spyOn(Animated, 'spring').mockReturnValue({ start, stop, reset: jest.fn() });

    const { getByText, unmount } = await render(
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

    expect(getByText('80%')).toBeTruthy();
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    await unmount();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('shows the final score without starting an animation when reduced motion is enabled', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spring = jest.spyOn(Animated, 'spring');

    const { getByText } = await render(
      <SessionSummary
        data={{
          totalQuestions: 10,
          correctAnswers: 7,
          accuracy: 70,
          deltaLine: null,
          streakLine: null,
        }}
        hasNext={false}
        onNext={jest.fn()}
        onDone={jest.fn()}
      />,
    );

    expect(getByText('70%')).toBeTruthy();
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(spring).not.toHaveBeenCalled();
  });
});
