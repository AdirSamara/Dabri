import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SmsViewerModal } from '../../src/components/SmsViewerModal';

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

interface SmsMessage {
  address: string;
  body: string;
  date: number;
}

const makeSmsMessages = (): SmsMessage[] => [
  { address: 'אמא', body: 'שלום, מה שלומך?', date: Date.now() - 60000 },
  { address: 'אבא', body: 'תתקשר אליי', date: Date.now() - 30000 },
  { address: 'דוד', body: 'נתראה מחר', date: Date.now() },
];

describe('SmsViewerModal', () => {
  const defaultProps = {
    visible: true,
    messages: [] as SmsMessage[],
    onClose: jest.fn(),
    onReadAloud: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty/null when messages array is empty', () => {
    const { toJSON } = render(
      <SmsViewerModal {...defaultProps} messages={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows all messages with sender addresses in list view', () => {
    const messages = makeSmsMessages();
    const { getByText } = render(
      <SmsViewerModal {...defaultProps} messages={messages} />,
    );
    expect(getByText(/אמא/)).toBeTruthy();
    expect(getByText(/אבא/)).toBeTruthy();
    expect(getByText(/דוד/)).toBeTruthy();
  });

  it('shows "הודעות" title in list view', () => {
    const messages = makeSmsMessages();
    const { getAllByText } = render(
      <SmsViewerModal {...defaultProps} messages={messages} />,
    );
    // Title and counter both contain "הודעות"
    expect(getAllByText(/הודעות/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows message count', () => {
    const messages = makeSmsMessages();
    const { getByText } = render(
      <SmsViewerModal {...defaultProps} messages={messages} />,
    );
    // Counter shows "3 הודעות"
    expect(getByText(/3 הודעות/)).toBeTruthy();
  });

  it('detail view: tapping a message shows full body', () => {
    const messages = makeSmsMessages();
    const { getByText } = render(
      <SmsViewerModal {...defaultProps} messages={messages} />,
    );
    // Tap the first message sender to open detail view
    fireEvent.press(getByText(/אמא/));
    // The full body text should now be visible
    expect(getByText(/שלום, מה שלומך/)).toBeTruthy();
  });

  it('read aloud button calls onReadAloud', () => {
    const onReadAloud = jest.fn();
    const messages = makeSmsMessages();
    const { getByText, getAllByText } = render(
      <SmsViewerModal {...defaultProps} messages={messages} onReadAloud={onReadAloud} />,
    );
    // Navigate to detail view first
    fireEvent.press(getByText(/אמא/));
    // Press read aloud button (Hebrew: הקראה / הקרא בקול / 🔊)
    const readAloudButton = getByText(/הקרא|השמע|🔊/);
    fireEvent.press(readAloudButton);
    expect(onReadAloud).toHaveBeenCalled();
  });

  it('close button calls onClose', () => {
    const onClose = jest.fn();
    const messages = makeSmsMessages();
    const { getByText } = render(
      <SmsViewerModal {...defaultProps} messages={messages} onClose={onClose} />,
    );
    // Press close button (Hebrew: סגור / ✕)
    const closeButton = getByText(/סגור|✕|×/);
    fireEvent.press(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
