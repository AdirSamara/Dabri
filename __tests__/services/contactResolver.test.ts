import Contacts from 'react-native-contacts';
import { NativeModules } from 'react-native';

import {
  invalidateContactCache,
  resolveContact,
  resolveContactCandidates,
  resolveContactWithAlignment,
  loadContacts,
} from '../../src/services/contactResolver';
import { useDabriStore } from '../../src/store';

const MOCK_CONTACTS = [
  { recordID: '1', givenName: 'יוסי', familyName: 'כהן', phoneNumbers: [{ label: 'mobile', number: '0501234567' }] },
  { recordID: '2', givenName: 'יוסי', familyName: 'לוי', phoneNumbers: [{ label: 'mobile', number: '0521234567' }] },
  { recordID: '3', givenName: 'דני', familyName: '', phoneNumbers: [{ label: 'mobile', number: '0531234567' }] },
  { recordID: '4', givenName: 'אבא', familyName: '', phoneNumbers: [{ label: 'mobile', number: '0541234567' }] },
  { recordID: '5', givenName: 'דניאל', familyName: 'שמיר', phoneNumbers: [{ label: 'mobile', number: '0551234567' }] },
];

beforeEach(() => {
  invalidateContactCache();
  (Contacts.getAll as jest.Mock).mockResolvedValue(MOCK_CONTACTS);
  NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('granted');
  useDabriStore.setState({ contactAliases: {} });
});

describe('contactResolver', () => {
  describe('resolveContact', () => {
    it('returns exact match for "דני"', async () => {
      const result = await resolveContact('דני');
      expect(result).not.toBeNull();
      expect(result!.displayName).toBe('דני');
      expect(result!.phoneNumber).toBe('0531234567');
    });

    it('returns a prefix match for "יוסי"', async () => {
      const result = await resolveContact('יוסי');
      expect(result).not.toBeNull();
      const displayName = result!.displayName;
      expect(
        displayName === 'יוסי כהן' || displayName === 'יוסי לוי',
      ).toBe(true);
    });

    it('returns null when permission is denied', async () => {
      invalidateContactCache(); // Force re-load
      NativeModules.PermissionsAndroid.requestPermission.mockResolvedValue('denied');
      const result = await resolveContact('דני');
      expect(result).toBeNull();
    });

    it('returns null when contacts list is empty', async () => {
      (Contacts.getAll as jest.Mock).mockResolvedValue([]);
      const result = await resolveContact('דני');
      expect(result).toBeNull();
    });
  });

  describe('resolveContactCandidates', () => {
    it('returns 2 candidates for "יוסי"', async () => {
      const candidates = await resolveContactCandidates('יוסי');
      expect(candidates).toHaveLength(2);
      const names = candidates.map((c: any) => c.displayName).sort();
      expect(names).toEqual(['יוסי כהן', 'יוסי לוי']);
    });
  });

  describe('resolveContactWithAlignment', () => {
    it('expands rawContact by consuming message words', async () => {
      const result = await resolveContactWithAlignment('יוסי', 'כהן שלום');
      expect(result.contact).not.toBeNull();
      expect(result.contact!.displayName).toBe('יוסי כהן');
      expect(result.correctedMessage).toBe('שלום');
    });

    it('strips leading ש from corrected message', async () => {
      const result = await resolveContactWithAlignment('יוסי', 'כהן ששלום');
      expect(result.contact).not.toBeNull();
      expect(result.correctedMessage).toBe('שלום');
    });
  });

  describe('alias resolution', () => {
    it('resolves an alias to the matching contact', async () => {
      useDabriStore.setState({
        contactAliases: { 'אבוש': 'אבא' },
      });
      const result = await resolveContact('אבוש');
      expect(result).not.toBeNull();
      expect(result!.displayName).toBe('אבא');
      expect(result!.phoneNumber).toBe('0541234567');
    });
  });
});
