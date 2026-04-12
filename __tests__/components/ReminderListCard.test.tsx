import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReminderListCard } from '../../src/components/ReminderListCard';

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

describe('ReminderListCard', () => {
  const defaultProps = {
    reminders: [] as Reminder[],
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    formatTime: jest.fn((t: number) => new Date(t).toLocaleTimeString()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "אין תזכורות פעילות" when no active reminders', () => {
    const { getByText } = render(<ReminderListCard {...defaultProps} />);
    expect(getByText(/אין תזכורות פעילות/)).toBeTruthy();
  });

  it('shows "תזכורת אחת פעילה:" for a single reminder', () => {
    const reminders = [makeReminder()];
    const { getByText } = render(
      <ReminderListCard {...defaultProps} reminders={reminders} />,
    );
    expect(getByText(/תזכורת אחת פעילה/)).toBeTruthy();
  });

  it('shows "X תזכורות פעילות:" for multiple reminders', () => {
    const reminders = [
      makeReminder({ id: '1', text: 'לקנות חלב' }),
      makeReminder({ id: '2', text: 'להתקשר לרופא' }),
      makeReminder({ id: '3', text: 'לשלם חשבון' }),
    ];
    const { getByText } = render(
      <ReminderListCard {...defaultProps} reminders={reminders} />,
    );
    expect(getByText(/3 תזכורות פעילות/)).toBeTruthy();
  });

  it('shows up to 5 reminders sorted by triggerTime', () => {
    const now = Date.now();
    const reminders = [
      makeReminder({ id: '1', text: 'חמישי', triggerTime: now + 5000 }),
      makeReminder({ id: '2', text: 'ראשון', triggerTime: now + 1000 }),
      makeReminder({ id: '3', text: 'שלישי', triggerTime: now + 3000 }),
      makeReminder({ id: '4', text: 'שני', triggerTime: now + 2000 }),
      makeReminder({ id: '5', text: 'רביעי', triggerTime: now + 4000 }),
      makeReminder({ id: '6', text: 'שישי', triggerTime: now + 6000 }),
    ];

    const { getByText, queryByText } = render(
      <ReminderListCard {...defaultProps} reminders={reminders} />,
    );

    // First 5 by triggerTime should be shown
    expect(getByText(/ראשון/)).toBeTruthy();
    expect(getByText(/שני/)).toBeTruthy();
    expect(getByText(/שלישי/)).toBeTruthy();
    expect(getByText(/רביעי/)).toBeTruthy();
    expect(getByText(/חמישי/)).toBeTruthy();
    // Sixth should not appear
    expect(queryByText(/שישי/)).toBeNull();
  });

  it('edit button calls onEdit with the reminder', () => {
    const onEdit = jest.fn();
    const reminder = makeReminder({ id: 'edit-1', text: 'לקנות חלב' });
    const { getByText } = render(
      <ReminderListCard {...defaultProps} reminders={[reminder]} onEdit={onEdit} />,
    );

    // The reminder text should be visible; press the edit action for this reminder
    expect(getByText(/לקנות חלב/)).toBeTruthy();

    // Find and press the edit button — typically "עריכה" or a pencil icon near the reminder
    const editButton = getByText(/עריכה|✏️|ערוך/);
    fireEvent.press(editButton);
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'edit-1', text: 'לקנות חלב' }),
    );
  });
});
