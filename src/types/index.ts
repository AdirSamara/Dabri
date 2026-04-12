export type Intent =
  | 'SEND_SMS'
  | 'READ_SMS'
  | 'MAKE_CALL'
  | 'SEND_WHATSAPP'
  | 'READ_WHATSAPP'
  | 'READ_NOTIFICATIONS'
  | 'SET_REMINDER'
  | 'OPEN_APP'
  | 'UNKNOWN';

export interface ParsedIntent {
  intent: Intent;
  contact: string | null;
  message: string | null;
  appName: string | null;
  reminderText: string | null;
  reminderTime: string | null;
  count: number | null;
  source: 'gemini' | 'regex';
}

export interface ConversationEntry {
  id: string;
  userText: string;
  parsedIntent: ParsedIntent | null;
  result: string;
  status: 'success' | 'error' | 'pending';
  timestamp: number;
  smsMessages?: SmsMessage[];
}

export interface NotificationItem {
  id: string;
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface Reminder {
  id: string;
  text: string;
  triggerTime: number;
  createdAt: number;
  notificationId: string;
  completed: boolean;
  snoozedUntil: number | null;
}

export interface Contact {
  recordID: string;
  displayName: string;
  phoneNumber: string;
}

export interface SmsMessage {
  address: string;
  body: string;
  date: number;
}

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export interface PendingDisambiguation {
  conversationId: string;
  intent: ParsedIntent;
  candidates: Contact[];
  correctedMessage: string;
}
