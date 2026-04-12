import { NativeModules } from 'react-native';
import { registerSmsHandlers } from '../../src/services/smsService';
import { dispatchAction } from '../../src/services/actionDispatcher';
import { ParsedIntent } from '../../src/types';
import * as contactResolver from '../../src/services/contactResolver';

// Register handlers once
registerSmsHandlers();

const SmsBridge = NativeModules.SmsModule;

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intent: 'READ_SMS',
    contact: null,
    message: null,
    appName: null,
    reminderText: null,
    reminderTime: null,
    count: 5,
    source: 'regex',
    ...overrides,
  };
}

beforeEach(() => {
  SmsBridge.readInbox.mockReset().mockResolvedValue([]);
  SmsBridge.sendSms.mockReset().mockResolvedValue(true);
  NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('granted');
});

describe('READ_SMS', () => {
  it('returns messages on success', async () => {
    SmsBridge.readInbox.mockResolvedValue([
      { address: '0501111111', body: 'שלום', date: Date.now() },
      { address: '0502222222', body: 'מה נשמע', date: Date.now() },
    ]);

    const result = await dispatchAction(makeIntent({ count: 5 }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('2 הודעות');
    expect(result.smsMessages).toHaveLength(2);
  });

  it('singular count=1 returns "ההודעה האחרונה"', async () => {
    SmsBridge.readInbox.mockResolvedValue([
      { address: '050', body: 'test message', date: Date.now() },
    ]);

    const result = await dispatchAction(makeIntent({ count: 1 }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('ההודעה האחרונה');
  });

  it('truncates message body to 80 chars for TTS', async () => {
    const longBody = 'א'.repeat(100);
    SmsBridge.readInbox.mockResolvedValue([
      { address: '050', body: longBody, date: Date.now() },
    ]);

    const result = await dispatchAction(makeIntent({ count: 1 }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('...');
  });

  it('empty inbox returns "אין הודעות חדשות"', async () => {
    SmsBridge.readInbox.mockResolvedValue([]);

    const result = await dispatchAction(makeIntent({ count: 5 }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('אין הודעות חדשות');
  });

  it('permission denied returns error', async () => {
    NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('denied');

    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(false);
    expect(result.message).toContain('הרשאה');
  });

  it('caps fetchCount at 5', async () => {
    SmsBridge.readInbox.mockResolvedValue([]);

    await dispatchAction(makeIntent({ count: 20 }));
    expect(SmsBridge.readInbox).toHaveBeenCalledWith(5);
  });
});

describe('SEND_SMS', () => {
  it('sends successfully with single contact match', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: { recordID: '1', displayName: 'אמא', phoneNumber: '0501234567' },
      correctedMessage: 'שלום',
      allCandidates: [{ recordID: '1', displayName: 'אמא', phoneNumber: '0501234567' }],
    });
    SmsBridge.sendSms.mockResolvedValue(true);

    const result = await dispatchAction(
      makeIntent({ intent: 'SEND_SMS', contact: 'אמא', message: 'שלום' }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('אמא');
    expect(SmsBridge.sendSms).toHaveBeenCalledWith('0501234567', 'שלום');
  });

  it('returns disambiguation when multiple candidates', async () => {
    const candidates = [
      { recordID: '1', displayName: 'יוסי כהן', phoneNumber: '050' },
      { recordID: '2', displayName: 'יוסי לוי', phoneNumber: '052' },
    ];
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: candidates[0],
      correctedMessage: 'שלום',
      allCandidates: candidates,
    });

    const result = await dispatchAction(
      makeIntent({ intent: 'SEND_SMS', contact: 'יוסי', message: 'שלום' }),
    );
    expect(result.success).toBe(false);
    expect(result.disambiguation).toBeDefined();
    expect(result.disambiguation!.candidates).toHaveLength(2);
  });

  it('missing contact returns error', async () => {
    const result = await dispatchAction(
      makeIntent({ intent: 'SEND_SMS', contact: null, message: 'שלום' }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא צוין איש קשר');
  });

  it('missing message returns error', async () => {
    const result = await dispatchAction(
      makeIntent({ intent: 'SEND_SMS', contact: 'דני', message: null }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא צוין תוכן');
  });

  it('contact not found returns error', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: null,
      correctedMessage: 'שלום',
      allCandidates: [],
    });

    const result = await dispatchAction(
      makeIntent({ intent: 'SEND_SMS', contact: 'לא קיים', message: 'שלום' }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא מצאתי');
  });

  it('send permission denied returns error', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: { recordID: '1', displayName: 'דני', phoneNumber: '050' },
      correctedMessage: 'שלום',
      allCandidates: [{ recordID: '1', displayName: 'דני', phoneNumber: '050' }],
    });
    NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('denied');

    const result = await dispatchAction(
      makeIntent({ intent: 'SEND_SMS', contact: 'דני', message: 'שלום' }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('הרשאה');
  });
});
