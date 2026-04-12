import { registerHandler, dispatchAction } from '../../src/services/actionDispatcher';
import { ParsedIntent, Intent } from '../../src/types';

function makeParsedIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intent: 'SEND_SMS',
    contact: null,
    message: null,
    appName: null,
    reminderText: null,
    reminderTime: null,
    count: null,
    source: 'regex',
    ...overrides,
  };
}

describe('actionDispatcher', () => {
  it('calls registered handler with correct intent and returns its result', async () => {
    const handler = jest.fn().mockResolvedValue({ success: true, message: 'sent' });
    registerHandler('SEND_SMS', handler);

    const intent = makeParsedIntent({ intent: 'SEND_SMS', contact: 'דני', message: 'שלום' });
    const result = await dispatchAction(intent);

    expect(handler).toHaveBeenCalledWith(intent);
    expect(result).toEqual({ success: true, message: 'sent' });
  });

  it('returns failure for an unregistered intent', async () => {
    const intent = makeParsedIntent({ intent: 'UNKNOWN' });
    const result = await dispatchAction(intent);

    expect(result).toEqual({
      success: false,
      message: 'לא הבנתי את הבקשה',
    });
  });

  it('catches Error thrown by handler and returns failure with error message', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('network timeout'));
    registerHandler('MAKE_CALL', handler);

    const intent = makeParsedIntent({ intent: 'MAKE_CALL' });
    const result = await dispatchAction(intent);

    expect(result).toEqual({
      success: false,
      message: 'שגיאה: network timeout',
    });
  });

  it('catches non-Error thrown by handler and returns generic failure message', async () => {
    const handler = jest.fn().mockRejectedValue('something weird');
    registerHandler('OPEN_APP', handler);

    const intent = makeParsedIntent({ intent: 'OPEN_APP' });
    const result = await dispatchAction(intent);

    expect(result).toEqual({
      success: false,
      message: 'שגיאה: אירעה שגיאה בלתי צפויה',
    });
  });
});
