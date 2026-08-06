import * as webFormat from '@core/app/format';
import * as webRecording from '@core/app/sessionRecording';
import * as webPacing from '@core/practice/drillPacing';
import * as webScenario from '@core/practice/scenario';
import { loadHandAccuracy } from '@core/storage/handAccuracyStorage';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import type { PracticeAttempt } from '@core/types/practice';
import { ACTION_TYPES, type SavedRange } from '@core/types/range';

import * as mobileFormat from '../lib/format';
import * as mobilePacing from '../lib/drillPacing';
import * as mobileRecording from '../lib/sessionRecording';
import * as mobileScenario from '../lib/scenario';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');

/**
 * Four mobile modules are hand-written mirrors of web originals rather than
 * shared through @core: drill pacing and scenario copy are UI concerns, session
 * recording only differs by import path, and `format` is deliberately
 * reimplemented without `Intl` so it does not depend on Hermes' ICU build.
 *
 * Everything else the two platforms share propagates automatically, so a web fix
 * lands on both; these four can silently drift, and nothing but a comment says
 * they must agree. This is that comment made executable — it imports BOTH copies
 * and asserts they answer identically. It is a drift guard, not a behaviour test:
 * what each module should do is covered by its own platform's suite.
 */

const RANGES: SavedRange[] = [
  {
    id: 'plain',
    name: 'No metadata',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'open',
    name: 'UTG open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { position: 'utg', actionType: 'open', stackDepthBb: 100 },
  },
  {
    id: 'defend',
    name: 'BB defend vs BTN',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      position: 'bb',
      actionType: 'defend',
      versusPosition: 'btn',
      tableSize: 'sixMax',
      stackDepthBb: 40,
    },
  },
  {
    id: 'depthOnly',
    name: 'Depth only',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { stackDepthBb: 200 },
  },
  // Every action type, so a new verb added to the vocabulary has to be worded
  // the same way on both platforms rather than only on the one it was added for.
  ...ACTION_TYPES.map(
    (actionType): SavedRange => ({
      id: actionType,
      name: `BTN ${actionType}`,
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType, versusPosition: 'co', stackDepthBb: 100 },
    }),
  ),
];

describe('drillPacing mirrors the web module', () => {
  it('paces every drill identically', () => {
    expect(mobilePacing.DRILL_QUESTION_COUNT).toBe(webPacing.DRILL_QUESTION_COUNT);
    expect(mobilePacing.HIT_DWELL_MS).toBe(webPacing.HIT_DWELL_MS);
    expect(mobilePacing.TIMED_HIT_DWELL_MS).toBe(webPacing.TIMED_HIT_DWELL_MS);
    expect(mobilePacing.TIMED_MISS_DWELL_MS).toBe(webPacing.TIMED_MISS_DWELL_MS);
  });

  it('holds for acknowledgement on the same answers', () => {
    for (const timed of [true, false]) {
      for (const correct of [true, false]) {
        expect(mobilePacing.holdsForAcknowledgement(timed, correct)).toBe(
          webPacing.holdsForAcknowledgement(timed, correct),
        );
      }
    }
  });
});

describe('scenario copy mirrors the web module', () => {
  it('labels the answer buttons the same way', () => {
    for (const range of RANGES) {
      expect(mobileScenario.answerVerbs(range)).toEqual(webScenario.answerVerbs(range));
    }
  });

  it('writes the same scenario line for every shape of metadata', () => {
    for (const range of RANGES) {
      expect(mobileScenario.scenarioLine(range)).toBe(webScenario.scenarioLine(range));
    }
  });

  it('explains a scored answer the same way', () => {
    for (const range of RANGES) {
      const verbs = webScenario.answerVerbs(range);
      for (const expectedInRange of [true, false]) {
        for (const correct of [true, false]) {
          expect(mobileScenario.feedbackLine('AQs', expectedInRange, correct, verbs)).toBe(
            webScenario.feedbackLine('AQs', expectedInRange, correct, verbs),
          );
        }
      }
    }
  });
});

describe('format mirrors the web module without Intl', () => {
  // Local-time constructors keep these stable in any time zone, as in both
  // platforms' own format tests.
  const localIso = (year: number, month: number, day: number, hour: number) =>
    new Date(year, month, day, hour).toISOString();
  const now = localIso(2026, 6, 11, 12);

  it('describes the same day distances', () => {
    const cases = [
      '',
      'not-a-date',
      localIso(2026, 6, 11, 9),
      localIso(2026, 6, 12, 9),
      localIso(2026, 6, 10, 23),
      localIso(2026, 6, 5, 9),
      localIso(2025, 11, 31, 9),
    ];
    for (const iso of cases) {
      expect(mobileFormat.formatDayDistance(iso, now)).toBe(webFormat.formatDayDistance(iso, now));
    }
  });

  it('greets at the same hours', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const date = new Date(2026, 6, 11, hour);
      expect(mobileFormat.greetingFor(date)).toBe(webFormat.greetingFor(date));
    }
  });

  it('builds the same date line the web app gets from Intl', () => {
    // The whole reason for the name tables: they must produce exactly what
    // `toLocaleDateString` does, or the two Today screens read differently.
    for (const [month, day] of [
      [0, 1],
      [6, 11],
      [7, 4],
      [11, 25],
    ]) {
      const date = new Date(2026, month, day);
      expect(mobileFormat.formatDateLine(date)).toBe(webFormat.formatDateLine(date));
    }
  });

});

describe('sessionRecording mirrors the web module', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  const attempts: PracticeAttempt[] = [
    {
      hand: 'AA',
      expectedInRange: true,
      userAnsweredInRange: true,
      correct: true,
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    {
      hand: 'KK',
      expectedInRange: true,
      userAnsweredInRange: false,
      correct: false,
      timestamp: '2026-01-01T00:00:01.000Z',
    },
    {
      hand: '72o',
      expectedInRange: false,
      userAnsweredInRange: true,
      correct: false,
      timestamp: '2026-01-01T00:00:02.000Z',
    },
  ];

  /**
   * Everything a finished session writes. Both recorders stamp their own
   * `new Date()`, so the wall-clock fields are dropped rather than compared —
   * two runs a millisecond apart are the same recording.
   */
  function recordedState() {
    const stats = Object.fromEntries(
      Object.entries(loadPracticeStats()).map(([id, stat]) => [
        id,
        { rangeId: stat.rangeId, totalAttempts: stat.totalAttempts, correctAttempts: stat.correctAttempts },
      ]),
    );
    const history = Object.fromEntries(
      Object.entries(loadSessionHistory()).map(([id, sessions]) => [
        id,
        sessions.map((session) => ({
          rangeId: session.rangeId,
          totalQuestions: session.totalQuestions,
          correctAnswers: session.correctAnswers,
        })),
      ]),
    );
    const reviewStates = Object.fromEntries(
      Object.entries(loadReviewStates()).map(([id, state]) => [
        id,
        { rangeId: state.rangeId, ease: state.ease, intervalDays: state.intervalDays },
      ]),
    );
    return { stats, handAccuracy: loadHandAccuracy(), history, reviewStates };
  }

  it('writes the same stores for the same session', () => {
    webRecording.recordFinishedPracticeSession('r1', attempts);
    const web = recordedState();

    localStorageShim.clear();
    mobileRecording.recordFinishedPracticeSession('r1', attempts);

    expect(recordedState()).toEqual(web);
  });

  it('reports a failed write the same way, and a clean one as null', () => {
    const boom = () => {
      throw new Error('Storage is full.');
    };
    expect(mobileRecording.captureRecordingFailure(boom)).toBe(
      webRecording.captureRecordingFailure(boom),
    );
    expect(mobileRecording.captureRecordingFailure(() => {})).toBe(
      webRecording.captureRecordingFailure(() => {}),
    );
  });
});
