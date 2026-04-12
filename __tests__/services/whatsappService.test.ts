import { Linking } from 'react-native';
import { registerWhatsAppHandlers } from '../../src/services/whatsappService';
import { dispatchAction } from '../../src/services/actionDispatcher';
import { ParsedIntent } from '../../src/types';
import * as contactResolver from '../../src/services/contactResolver';

registerWhatsAppHandlers();

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intent: 'SEND_WHATSAPP',
    contact: 'אבא',
    message: 'שלום',
    appName: null,
    reminderText: null,
    reminderTime: null,
    count: null,
    source: 'regex',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (Linking.openURL as jest.Mock) = jest.fn().mockResolvedValue(undefined);
});

describe('SEND_WHATSAPP', () => {
  it('opens WhatsApp with formatted phone number', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: { recordID: '1', displayName: 'אבא', phoneNumber: '0541234567' },
      correctedMessage: 'שלום',
      allCandidates: [{ recordID: '1', displayName: 'אבא', phoneNumber: '0541234567' }],
    });

    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('whatsapp://send?phone=972541234567'),
    );
  });

  it('formats Israeli phone: 050→972', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: { recordID: '1', displayName: 'דני', phoneNumber: '050-123-4567' },
      correctedMessage: 'hi',
      allCandidates: [{ recordID: '1', displayName: 'דני', phoneNumber: '050-123-4567' }],
    });

    await dispatchAction(makeIntent({ contact: 'דני', message: 'hi' }));
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('phone=972501234567'),
    );
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

    const result = await dispatchAction(makeIntent({ contact: 'יוסי', message: 'שלום' }));
    expect(result.success).toBe(false);
    expect(result.disambiguation).toBeDefined();
  });

  it('WhatsApp not installed returns error', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: { recordID: '1', displayName: 'דני', phoneNumber: '050' },
      correctedMessage: 'שלום',
      allCandidates: [{ recordID: '1', displayName: 'דני', phoneNumber: '050' }],
    });
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('No Activity found'));

    const result = await dispatchAction(makeIntent({ contact: 'דני', message: 'שלום' }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('וואטסאפ אינו מותקן');
  });

  it('missing contact returns error', async () => {
    const result = await dispatchAction(makeIntent({ contact: null }));
    expect(result.success).toBe(false);
  });

  it('missing message returns error', async () => {
    const result = await dispatchAction(makeIntent({ message: null }));
    expect(result.success).toBe(false);
  });

  it('contact not found returns error', async () => {
    jest.spyOn(contactResolver, 'resolveContactWithAlignment').mockResolvedValue({
      contact: null,
      correctedMessage: 'שלום',
      allCandidates: [],
    });

    const result = await dispatchAction(makeIntent({ contact: 'לא קיים', message: 'שלום' }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא מצאתי');
  });
});

describe('READ_WHATSAPP', () => {
  it('returns "not available" stub', async () => {
    const result = await dispatchAction({
      intent: 'READ_WHATSAPP',
      contact: null,
      message: null,
      appName: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא זמינה');
  });
});
