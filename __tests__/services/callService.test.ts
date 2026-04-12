import { NativeModules } from 'react-native';
import { registerCallHandlers } from '../../src/services/callService';
import { dispatchAction } from '../../src/services/actionDispatcher';
import { ParsedIntent } from '../../src/types';
import * as contactResolver from '../../src/services/contactResolver';

registerCallHandlers();

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intent: 'MAKE_CALL',
    contact: 'דני',
    message: null,
    appName: null,
    reminderText: null,
    reminderTime: null,
    count: null,
    source: 'regex',
    ...overrides,
  };
}

beforeEach(() => {
  NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('granted');
});

describe('MAKE_CALL', () => {
  it('calls successfully with single contact', async () => {
    jest.spyOn(contactResolver, 'resolveContactCandidates').mockResolvedValue([
      { recordID: '1', displayName: 'דני', phoneNumber: '0531234567' },
    ]);

    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(true);
    expect(result.message).toContain('דני');
    expect(NativeModules.PhoneModule.directCall).toHaveBeenCalledWith('0531234567');
  });

  it('returns disambiguation when multiple candidates', async () => {
    const candidates = [
      { recordID: '1', displayName: 'יוסי כהן', phoneNumber: '050' },
      { recordID: '2', displayName: 'יוסי לוי', phoneNumber: '052' },
    ];
    jest.spyOn(contactResolver, 'resolveContactCandidates').mockResolvedValue(candidates);

    const result = await dispatchAction(makeIntent({ contact: 'יוסי' }));
    expect(result.success).toBe(false);
    expect(result.disambiguation).toBeDefined();
    expect(result.disambiguation!.candidates).toHaveLength(2);
  });

  it('missing contact returns error', async () => {
    const result = await dispatchAction(makeIntent({ contact: null }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא צוין');
  });

  it('contact not found returns error', async () => {
    jest.spyOn(contactResolver, 'resolveContactCandidates').mockResolvedValue([]);

    const result = await dispatchAction(makeIntent({ contact: 'אין כזה' }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('לא מצאתי');
  });

  it('permission denied returns error', async () => {
    jest.spyOn(contactResolver, 'resolveContactCandidates').mockResolvedValue([
      { recordID: '1', displayName: 'דני', phoneNumber: '050' },
    ]);
    NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('denied');

    const result = await dispatchAction(makeIntent());
    expect(result.success).toBe(false);
    expect(result.message).toContain('הרשאה');
  });
});
