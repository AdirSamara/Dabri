import { NativeModules } from 'react-native';
import { registerReminderHandlers, cancelReminderById } from '../../src/services/reminderService';
import { dispatchAction } from '../../src/services/actionDispatcher';
import { ParsedIntent, Reminder } from '../../src/types';
import { useDabriStore } from '../../src/store';

registerReminderHandlers();

const ReminderBridge = NativeModules.ReminderModule;

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intent: 'SET_REMINDER',
    contact: null,
    message: null,
    appName: null,
    reminderText: 'לקנות חלב',
    reminderTime: 'בעוד 5 דקות',
    count: null,
    source: 'regex',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useDabriStore.setState({
    reminders: [],
    pendingDisambiguation: null,
  });
  ReminderBridge.checkPermissions.mockResolvedValue({
    canScheduleExact: true,
    canPostNotifications: true,
  });
});

describe('SET_REMINDER', () => {
  it('creates reminder successfully', async () => {
    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(true);
    expect(result.message).toContain('אזכיר לך');
    expect(result.message).toContain('לקנות חלב');
    expect(ReminderBridge.scheduleReminder).toHaveBeenCalled();

    // Verify stored in Zustand
    const { reminders } = useDabriStore.getState();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].text).toBe('לקנות חלב');
  });

  it('missing reminderText returns error', async () => {
    const result = await dispatchAction(makeIntent({ reminderText: null }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא הבנתי מה להזכיר');
  });

  it('missing reminderTime returns error', async () => {
    const result = await dispatchAction(makeIntent({ reminderTime: null }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא הבנתי מתי');
  });

  it('invalid time expression returns error', async () => {
    const result = await dispatchAction(makeIntent({ reminderTime: 'שלום עולם' }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא הצלחתי להבין');
  });

  it('notification permission denied returns error', async () => {
    ReminderBridge.checkPermissions
      .mockResolvedValueOnce({ canScheduleExact: true, canPostNotifications: false })
      .mockResolvedValueOnce({ canScheduleExact: true, canPostNotifications: false });

    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(false);
    expect(result.message).toContain('הרשאה');
  });

  it('native schedule error is caught', async () => {
    ReminderBridge.scheduleReminder.mockRejectedValue(new Error('native crash'));

    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(false);
    expect(result.message).toContain('שגיאה בתזמון');
  });
});

describe('LIST_REMINDERS', () => {
  it('no active reminders returns empty message', async () => {
    const result = await dispatchAction(makeIntent({ reminderText: '__LIST__', reminderTime: null }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('אין לך תזכורות');
  });

  it('lists active reminders', async () => {
    const future = Date.now() + 3_600_000;
    useDabriStore.setState({
      reminders: [
        { id: '1', text: 'לקנות חלב', triggerTime: future, createdAt: Date.now(), notificationId: '1', completed: false, snoozedUntil: null },
        { id: '2', text: 'להתקשר', triggerTime: future + 1000, createdAt: Date.now(), notificationId: '2', completed: false, snoozedUntil: null },
      ],
    });

    const result = await dispatchAction(makeIntent({ reminderText: '__LIST__', reminderTime: null }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('2 תזכורות');
    expect(result.message).toContain('לקנות חלב');
    expect(result.message).toContain('להתקשר');
  });

  it('skips completed reminders', async () => {
    const future = Date.now() + 3_600_000;
    useDabriStore.setState({
      reminders: [
        { id: '1', text: 'active', triggerTime: future, createdAt: Date.now(), notificationId: '1', completed: false, snoozedUntil: null },
        { id: '2', text: 'done', triggerTime: future, createdAt: Date.now(), notificationId: '2', completed: true, snoozedUntil: null },
      ],
    });

    const result = await dispatchAction(makeIntent({ reminderText: '__LIST__', reminderTime: null }));
    expect(result.message).toContain('תזכורת אחת');
    expect(result.message).toContain('active');
    expect(result.message).not.toContain('done');
  });

  it('singular phrasing for 1 reminder', async () => {
    const future = Date.now() + 3_600_000;
    useDabriStore.setState({
      reminders: [
        { id: '1', text: 'test', triggerTime: future, createdAt: Date.now(), notificationId: '1', completed: false, snoozedUntil: null },
      ],
    });

    const result = await dispatchAction(makeIntent({ reminderText: '__LIST__', reminderTime: null }));
    expect(result.message).toContain('תזכורת אחת');
  });
});

describe('cancelReminderById', () => {
  it('removes from store and cancels native alarm', async () => {
    useDabriStore.setState({
      reminders: [
        { id: 'r1', text: 'test', triggerTime: Date.now(), createdAt: Date.now(), notificationId: 'r1', completed: false, snoozedUntil: null },
      ],
    });

    await cancelReminderById('r1');
    expect(ReminderBridge.cancelReminder).toHaveBeenCalledWith('r1');
    expect(useDabriStore.getState().reminders).toHaveLength(0);
  });
});
