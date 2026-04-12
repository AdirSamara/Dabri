import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReminderEditModal } from '../../src/components/ReminderEditModal';

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

interface Reminder {
  id: string;
  text: string;
  triggerTime: number;
  createdAt: number;
  notificationId: string;
  completed: boolean;
  snoozedUntil: number | null;
}

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: '1',
  text: 'לקנות חלב',
  triggerTime: Date.now() + 3600000,
  createdAt: Date.now(),
  notificationId: 'notif-1',
  completed: false,
  snoozedUntil: null,
  ...overrides,
});

describe('ReminderEditModal', () => {
  const defaultProps = {
    visible: true,
    reminder: null as Reminder | null,
    formatTime: jest.fn((t: number) => new Date(t).toLocaleTimeString()),
    onSave: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty/null when reminder is null', () => {
    const { toJSON } = render(
      <ReminderEditModal {...defaultProps} reminder={null} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows reminder text in TextInput', () => {
    const reminder = makeReminder({ text: 'לקנות חלב' });
    const { getByDisplayValue } = render(
      <ReminderEditModal {...defaultProps} reminder={reminder} />,
    );
    expect(getByDisplayValue('לקנות חלב')).toBeTruthy();
  });

  it('shows "עריכת תזכורת" title', () => {
    const reminder = makeReminder();
    const { getByText } = render(
      <ReminderEditModal {...defaultProps} reminder={reminder} />,
    );
    expect(getByText(/עריכת תזכורת/)).toBeTruthy();
  });

  it('save button is disabled when no changes have been made', () => {
    const reminder = makeReminder();
    const { getByText } = render(
      <ReminderEditModal {...defaultProps} reminder={reminder} />,
    );
    const saveButton = getByText(/שמור|שמירה/);
    // The button should be disabled — its parent Pressable/TouchableOpacity
    // will have opacity or disabled prop. We verify onSave is not called.
    fireEvent.press(saveButton);
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('delete button calls onDelete', () => {
    const onDelete = jest.fn();
    const reminder = makeReminder();
    const { getByText } = render(
      <ReminderEditModal {...defaultProps} reminder={reminder} onDelete={onDelete} />,
    );
    const deleteButton = getByText(/מחק|מחיקה/);
    fireEvent.press(deleteButton);
    expect(onDelete).toHaveBeenCalled();
  });

  it('close/cancel button calls onClose', () => {
    const onClose = jest.fn();
    const reminder = makeReminder();
    const { getByText } = render(
      <ReminderEditModal {...defaultProps} reminder={reminder} onClose={onClose} />,
    );
    const closeButton = getByText(/ביטול|סגור|✕|×/);
    fireEvent.press(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
