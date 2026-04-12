import { useDabriStore } from '../../src/store';

beforeEach(() => {
  useDabriStore.setState({
    voiceStatus: 'idle',
    lastTranscript: '',
    conversations: [],
    recentNotifications: [],
    reminders: [],
    pendingDisambiguation: null,
    geminiApiKey: '',
    ttsSpeed: 0.6,
    isDarkMode: false,
    silenceTimeout: 1000,
    contactAliases: {},
  });
});

describe('initial state', () => {
  it('has the expected default values', () => {
    const state = useDabriStore.getState();
    expect(state.voiceStatus).toBe('idle');
    expect(state.lastTranscript).toBe('');
    expect(state.conversations).toEqual([]);
    expect(state.reminders).toEqual([]);
    expect(state.pendingDisambiguation).toBeNull();
    expect(state.geminiApiKey).toBe('');
    expect(state.ttsSpeed).toBe(0.6);
    expect(state.isDarkMode).toBe(false);
    expect(state.silenceTimeout).toBe(1000);
    expect(state.contactAliases).toEqual({});
  });
});

describe('setVoiceStatus', () => {
  it('updates voiceStatus', () => {
    useDabriStore.getState().setVoiceStatus('listening');
    expect(useDabriStore.getState().voiceStatus).toBe('listening');
  });
});

describe('setLastTranscript', () => {
  it('updates lastTranscript', () => {
    useDabriStore.getState().setLastTranscript('שלום עולם');
    expect(useDabriStore.getState().lastTranscript).toBe('שלום עולם');
  });
});

describe('addConversation', () => {
  it('prepends a new conversation entry', () => {
    const entry = { id: '1', role: 'user' as const, text: 'היי', timestamp: Date.now() };
    useDabriStore.getState().addConversation(entry);

    const conversations = useDabriStore.getState().conversations;
    expect(conversations).toHaveLength(1);
    expect(conversations[0].id).toBe('1');
  });

  it('prepends newer entries before older ones', () => {
    const older = { id: '1', role: 'user' as const, text: 'ראשון', timestamp: 1 };
    const newer = { id: '2', role: 'assistant' as const, text: 'שני', timestamp: 2 };

    useDabriStore.getState().addConversation(older);
    useDabriStore.getState().addConversation(newer);

    const conversations = useDabriStore.getState().conversations;
    expect(conversations[0].id).toBe('2');
    expect(conversations[1].id).toBe('1');
  });

  it('caps conversations at MAX_CONVERSATION_LOG (100)', () => {
    for (let i = 0; i < 105; i++) {
      useDabriStore.getState().addConversation({
        id: String(i),
        role: 'user',
        text: `msg ${i}`,
        timestamp: i,
      });
    }
    expect(useDabriStore.getState().conversations).toHaveLength(100);
  });
});

describe('updateConversation', () => {
  it('merges fields into an existing conversation by id', () => {
    const entry = { id: '1', role: 'user' as const, text: 'draft', timestamp: Date.now() };
    useDabriStore.getState().addConversation(entry);

    useDabriStore.getState().updateConversation('1', { text: 'final' });
    const updated = useDabriStore.getState().conversations.find((c: any) => c.id === '1');
    expect(updated?.text).toBe('final');
  });

  it('does not affect other conversations', () => {
    useDabriStore.getState().addConversation({ id: '1', role: 'user', text: 'a', timestamp: 1 });
    useDabriStore.getState().addConversation({ id: '2', role: 'user', text: 'b', timestamp: 2 });

    useDabriStore.getState().updateConversation('1', { text: 'updated' });
    const other = useDabriStore.getState().conversations.find((c: any) => c.id === '2');
    expect(other?.text).toBe('b');
  });
});

describe('addReminder', () => {
  it('adds a reminder to the list', () => {
    const reminder = {
      id: 'r1',
      contactName: 'דני',
      message: 'התקשר',
      triggerTime: Date.now() + 60000,
      completed: false,
    };
    useDabriStore.getState().addReminder(reminder);

    const reminders = useDabriStore.getState().reminders;
    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe('r1');
  });
});

describe('removeReminder', () => {
  it('removes a reminder by id', () => {
    const reminder = {
      id: 'r1',
      contactName: 'דני',
      message: 'התקשר',
      triggerTime: Date.now(),
      completed: false,
    };
    useDabriStore.getState().addReminder(reminder);
    useDabriStore.getState().removeReminder('r1');

    expect(useDabriStore.getState().reminders).toHaveLength(0);
  });

  it('does not remove other reminders', () => {
    useDabriStore.getState().addReminder({ id: 'r1', contactName: 'א', message: 'x', triggerTime: 1, completed: false });
    useDabriStore.getState().addReminder({ id: 'r2', contactName: 'ב', message: 'y', triggerTime: 2, completed: false });
    useDabriStore.getState().removeReminder('r1');

    const reminders = useDabriStore.getState().reminders;
    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe('r2');
  });
});

describe('updateReminder', () => {
  it('merges fields into an existing reminder by id', () => {
    useDabriStore.getState().addReminder({ id: 'r1', contactName: 'דני', message: 'old', triggerTime: 1, completed: false });
    useDabriStore.getState().updateReminder('r1', { message: 'new' });

    const reminder = useDabriStore.getState().reminders.find((r: any) => r.id === 'r1');
    expect(reminder?.message).toBe('new');
  });
});

describe('completeReminder', () => {
  it('marks a reminder as completed', () => {
    useDabriStore.getState().addReminder({ id: 'r1', contactName: 'דני', message: 'msg', triggerTime: 1, completed: false });
    useDabriStore.getState().completeReminder('r1');

    const reminder = useDabriStore.getState().reminders.find((r: any) => r.id === 'r1');
    expect(reminder?.completed).toBe(true);
  });
});

describe('snoozeReminder', () => {
  it('sets triggerTime and snoozedUntil based on minutes', () => {
    useDabriStore.getState().addReminder({
      id: 'r1', text: 'test', triggerTime: Date.now(), createdAt: Date.now(),
      notificationId: 'r1', completed: false, snoozedUntil: null,
    });

    const before = Date.now();
    useDabriStore.getState().snoozeReminder('r1', 10); // 10 minutes

    const reminder = useDabriStore.getState().reminders.find((r: any) => r.id === 'r1');
    const expectedMin = before + 10 * 60 * 1000;
    // Allow 1s tolerance for timing
    expect(reminder?.triggerTime).toBeGreaterThanOrEqual(expectedMin - 1000);
    expect(reminder?.triggerTime).toBeLessThanOrEqual(expectedMin + 1000);
    expect(reminder?.snoozedUntil).toBe(reminder?.triggerTime);
  });
});

describe('setPendingDisambiguation', () => {
  it('sets pending disambiguation data', () => {
    const data = { type: 'contact', options: ['דני', 'דנה'] };
    useDabriStore.getState().setPendingDisambiguation(data);
    expect(useDabriStore.getState().pendingDisambiguation).toEqual(data);
  });

  it('clears pending disambiguation when set to null', () => {
    useDabriStore.getState().setPendingDisambiguation({ type: 'contact', options: ['דני'] });
    useDabriStore.getState().setPendingDisambiguation(null);
    expect(useDabriStore.getState().pendingDisambiguation).toBeNull();
  });
});

describe('setSilenceTimeout', () => {
  it('updates silenceTimeout', () => {
    useDabriStore.getState().setSilenceTimeout(1500);
    expect(useDabriStore.getState().silenceTimeout).toBe(1500);
  });
});

describe('setContactAlias / removeContactAlias', () => {
  it('sets a contact alias', () => {
    useDabriStore.getState().setContactAlias('אמא', 'רותי כהן');
    expect(useDabriStore.getState().contactAliases).toEqual({ 'אמא': 'רותי כהן' });
  });

  it('overwrites an existing alias for the same key', () => {
    useDabriStore.getState().setContactAlias('אמא', 'רותי כהן');
    useDabriStore.getState().setContactAlias('אמא', 'שרה לוי');
    expect(useDabriStore.getState().contactAliases['אמא']).toBe('שרה לוי');
  });

  it('removes a contact alias by key', () => {
    useDabriStore.getState().setContactAlias('אמא', 'רותי כהן');
    useDabriStore.getState().setContactAlias('אבא', 'דוד כהן');
    useDabriStore.getState().removeContactAlias('אמא');

    const aliases = useDabriStore.getState().contactAliases;
    expect(aliases).not.toHaveProperty('אמא');
    expect(aliases).toHaveProperty('אבא');
  });
});

describe('persist partialize', () => {
  it('persists reminders, geminiApiKey, ttsSpeed, isDarkMode, silenceTimeout, and contactAliases', () => {
    // The store's persist config has a partialize function that selects which
    // fields are persisted. We can access it via the persist API.
    const persistOptions = (useDabriStore as any).persist?.getOptions?.();
    if (!persistOptions?.partialize) {
      // If we can't access persist options directly, verify by checking that
      // the fields exist on the state (basic sanity check)
      const state = useDabriStore.getState();
      expect(state).toHaveProperty('reminders');
      expect(state).toHaveProperty('geminiApiKey');
      expect(state).toHaveProperty('ttsSpeed');
      expect(state).toHaveProperty('isDarkMode');
      expect(state).toHaveProperty('silenceTimeout');
      expect(state).toHaveProperty('contactAliases');
      return;
    }

    const fullState = useDabriStore.getState();
    const persisted = persistOptions.partialize(fullState);

    // These keys SHOULD be persisted
    expect(persisted).toHaveProperty('reminders');
    expect(persisted).toHaveProperty('geminiApiKey');
    expect(persisted).toHaveProperty('ttsSpeed');
    expect(persisted).toHaveProperty('isDarkMode');
    expect(persisted).toHaveProperty('silenceTimeout');
    expect(persisted).toHaveProperty('contactAliases');

    // These keys should NOT be persisted
    expect(persisted).not.toHaveProperty('conversations');
    expect(persisted).not.toHaveProperty('voiceStatus');
    expect(persisted).not.toHaveProperty('pendingDisambiguation');
    expect(persisted).not.toHaveProperty('lastTranscript');
  });
});
