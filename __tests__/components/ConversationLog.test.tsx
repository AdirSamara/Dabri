import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConversationLog } from '../../src/components/ConversationLog';

jest.mock('../../src/utils/theme', () => ({
  useTheme: () => ({
    background: '#fff', surface: '#f5f5f5', surfaceVariant: '#eee',
    border: '#ddd', text: '#000', textSecondary: '#666', textTertiary: '#999',
    primary: '#2196F3', success: '#4CAF50', error: '#F44336', warning: '#FF9800',
    headerBackground: '#fff', headerText: '#000', chipBackground: '#eee',
    overlayCard: '#fff', transcriptBackground: '#f5f5f5',
    geminiBadgeBackground: '#E8F5E9', geminiBadgeText: '#2E7D32',
  }),
}));

interface ParsedIntent {
  intent: string;
  contact: string | null;
  message: string | null;
  appName: string | null;
  reminderText: string | null;
  reminderTime: string | null;
  count: number | null;
  source: 'regex' | 'gemini';
}

interface ConversationEntry {
  id: string;
  userText: string;
  result: string;
  status: 'success' | 'error' | 'pending';
  timestamp: number;
  parsedIntent?: ParsedIntent;
  smsMessages?: Array<{ address: string; body: string; date: number }>;
}

interface PendingDisambiguation {
  conversationId: string;
  intent: ParsedIntent;
  candidates: Array<{ recordID: string; displayName: string; phoneNumber: string }>;
  correctedMessage: string;
}

const makeEntry = (overrides: Partial<ConversationEntry> = {}): ConversationEntry => ({
  id: '1',
  userText: 'תתקשר לאבא',
  result: 'מתקשר לאבא',
  status: 'success',
  timestamp: Date.now(),
  parsedIntent: {
    intent: 'MAKE_CALL',
    contact: 'אבא',
    message: null,
    appName: null,
    reminderText: null,
    reminderTime: null,
    count: null,
    source: 'regex',
  },
  ...overrides,
});

describe('ConversationLog', () => {
  const defaultProps = {
    conversations: [] as ConversationEntry[],
    onEntryPress: jest.fn(),
    reminders: [],
    onDeleteReminder: jest.fn(),
    onEditReminder: jest.fn(),
    formatReminderTime: jest.fn((t: number) => new Date(t).toLocaleTimeString()),
    pendingDisambiguation: null as PendingDisambiguation | null,
    onDisambiguate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state text "אמור משהו כמו" when no conversations', () => {
    const { getByText } = render(<ConversationLog {...defaultProps} />);
    expect(getByText(/אמור משהו כמו/)).toBeTruthy();
  });

  it('renders conversation entries with userText', () => {
    const entry = makeEntry();
    const { getByText } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );
    expect(getByText('תתקשר לאבא')).toBeTruthy();
  });

  it('shows intent label for known intents', () => {
    const entry = makeEntry();
    const { toJSON } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );
    const tree = JSON.stringify(toJSON());
    // MAKE_CALL intent should render a label like "שיחה" or similar Hebrew call label
    expect(tree).toMatch(/שיחה|התקשר|טלפון|MAKE_CALL/);
  });

  it('shows Gemini badge "✨ AI" when source is gemini', () => {
    const entry = makeEntry({
      parsedIntent: {
        intent: 'MAKE_CALL',
        contact: 'אבא',
        message: null,
        appName: null,
        reminderText: null,
        reminderTime: null,
        count: null,
        source: 'gemini',
      },
    });
    const { getByText } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );
    expect(getByText(/✨ AI/)).toBeTruthy();
  });

  it('shows green status dot color for success', () => {
    const entry = makeEntry({ status: 'success' });
    const { toJSON } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#4CAF50');
  });

  it('shows red status dot color for error', () => {
    const entry = makeEntry({ id: '2', status: 'error', result: 'שגיאה' });
    const { toJSON } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#F44336');
  });

  it('shows orange status dot color for pending', () => {
    const entry = makeEntry({ id: '3', status: 'pending', result: 'מעבד...' });
    const { toJSON } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#FF9800');
  });

  it('shows disambiguation buttons when pendingDisambiguation matches entry', () => {
    const entry = makeEntry({ id: 'disambig-1' });
    const intent = entry.parsedIntent!;
    const disambiguation: PendingDisambiguation = {
      conversationId: 'disambig-1',
      intent,
      candidates: [
        { recordID: 'c1', displayName: 'אבא בית', phoneNumber: '0501111111' },
        { recordID: 'c2', displayName: 'אבא עבודה', phoneNumber: '0502222222' },
      ],
      correctedMessage: '',
    };

    const { getByText } = render(
      <ConversationLog
        {...defaultProps}
        conversations={[entry]}
        pendingDisambiguation={disambiguation}
      />,
    );

    expect(getByText(/אבא בית/)).toBeTruthy();
    expect(getByText(/אבא עבודה/)).toBeTruthy();
  });

  it('calls onDisambiguate with correct contact when disambiguation button pressed', () => {
    const onDisambiguate = jest.fn();
    const entry = makeEntry({ id: 'disambig-2' });
    const intent = entry.parsedIntent!;
    const disambiguation: PendingDisambiguation = {
      conversationId: 'disambig-2',
      intent,
      candidates: [
        { recordID: 'c1', displayName: 'אבא בית', phoneNumber: '0501111111' },
        { recordID: 'c2', displayName: 'אבא עבודה', phoneNumber: '0502222222' },
      ],
      correctedMessage: '',
    };

    const { getByText } = render(
      <ConversationLog
        {...defaultProps}
        conversations={[entry]}
        pendingDisambiguation={disambiguation}
        onDisambiguate={onDisambiguate}
      />,
    );

    fireEvent.press(getByText(/אבא בית/));
    expect(onDisambiguate).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'אבא בית', phoneNumber: '0501111111' }),
    );
  });

  it('shows "לחץ לצפייה מלאה" hint for SMS entries', () => {
    const entry = makeEntry({
      id: 'sms-1',
      userText: 'תקריא הודעות',
      result: 'נמצאו 2 הודעות',
      parsedIntent: {
        intent: 'READ_SMS',
        contact: 'אמא',
        message: null,
        appName: null,
        reminderText: null,
        reminderTime: null,
        count: null,
        source: 'regex',
      },
      smsMessages: [
        { address: 'אמא', body: 'שלום', date: Date.now() },
        { address: 'אמא', body: 'מה נשמע?', date: Date.now() - 10000 },
      ],
    });

    const { getByText } = render(
      <ConversationLog {...defaultProps} conversations={[entry]} />,
    );

    expect(getByText(/לחץ לצפייה מלאה/)).toBeTruthy();
  });
});
