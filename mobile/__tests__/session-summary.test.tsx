import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

  it('recaps the missed hands as the two lists to act on', async () => {
    const { getByTestId, getByText, queryByText, queryByTestId } = await render(
      <SessionSummary
        data={{
          totalQuestions: 10,
          correctAnswers: 7,
          accuracy: 70,
          deltaLine: null,
          streakLine: null,
          misses: { shouldPlay: ['KTs', 'A5s'], shouldFold: ['72o'], hiddenCount: 2 },
        }}
        hasNext={false}
        onNext={jest.fn()}
        onDone={jest.fn()}
      />,
    );

    expect(getByTestId('summary-misses')).toBeTruthy();
    expect(getByText(/Play these:\s*KTs, A5s/)).toBeTruthy();
    expect(getByText(/Fold these:\s*72o/)).toBeTruthy();
    expect(queryByText(/and 2 more/)).toBeTruthy();
    // No handler supplied, so the run cannot offer a re-drill.
    expect(queryByTestId('summary-drill-misses')).toBeNull();
  });

  it('offers a re-drill of the misses when the run can deal one', async () => {
    const onDrillMisses = jest.fn();
    const { getByTestId } = await render(
      <SessionSummary
        data={{
          totalQuestions: 10,
          correctAnswers: 7,
          accuracy: 70,
          deltaLine: null,
          streakLine: null,
          misses: { shouldPlay: ['KTs'], shouldFold: [], hiddenCount: 0 },
        }}
        hasNext={false}
        onNext={jest.fn()}
        onDone={jest.fn()}
        onDrillMisses={onDrillMisses}
      />,
    );

    await fireEvent.press(getByTestId('summary-drill-misses'));

    expect(onDrillMisses).toHaveBeenCalledTimes(1);
  });

  it('leaves the recap out entirely for a clean run', async () => {
    const { queryByTestId } = await render(
      <SessionSummary
        data={{
          totalQuestions: 10,
          correctAnswers: 10,
          accuracy: 100,
          deltaLine: null,
          streakLine: null,
          misses: null,
        }}
        hasNext={false}
        onNext={jest.fn()}
        onDone={jest.fn()}
      />,
    );

    expect(queryByTestId('summary-misses')).toBeNull();
  });
});
