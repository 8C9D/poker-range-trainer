import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Speak each new drill question to VoiceOver.
 *
 * A drill answered from the keyboard or by swipe never moves focus, so the next
 * deal changes silently: the reader announces the feedback and then says nothing
 * more, leaving the drill unplayable without sight. The web app gets this from an
 * `aria-live` region; React Native's `accessibilityLiveRegion` is Android-only, so
 * on iOS the announcement has to be made explicitly.
 *
 * Pass the whole spoken line (scenario and hand); an empty string announces
 * nothing, for the frames between questions.
 */
export function useAnnouncedPrompt(line: string): void {
  useEffect(() => {
    if (!line) return;
    AccessibilityInfo.announceForAccessibility(line);
  }, [line]);
}
