import Contacts from 'react-native-contacts';
import { PermissionsAndroid, Platform } from 'react-native';
import { Contact } from '../types';
import { normalizeHebrew, levenshteinDistance } from '../utils/hebrewUtils';
import { useDabriStore } from '../store';

let cachedContacts: Contact[] = [];
let cacheLoaded = false;

export async function requestContactsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      {
        title: 'גישה לאנשי קשר',
        message: 'דברי צריכה גישה לאנשי הקשר שלך כדי לשלוח הודעות ולבצע שיחות.',
        buttonPositive: 'אישור',
        buttonNegative: 'ביטול',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function loadContacts(): Promise<Contact[]> {
  // Always request permission before querying ContentResolver.
  // Without READ_CONTACTS in the manifest + granted, getAll() throws
  // SecurityException on the executor thread which crashes the process.
  const granted = await requestContactsPermission();
  if (!granted) {
    cachedContacts = [];
    cacheLoaded = true;
    return cachedContacts;
  }

  try {
    const rawContacts = await Contacts.getAll();

    cachedContacts = rawContacts
      .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
      .map((c) => ({
        recordID: c.recordID,
        displayName: `${c.givenName ?? ''} ${c.familyName ?? ''}`.trim(),
        phoneNumber: c.phoneNumbers[0].number,
      }));
  } catch {
    // Permission denied at the OS level or contacts not accessible
    cachedContacts = [];
  }

  cacheLoaded = true;
  return cachedContacts;
}

export async function resolveContact(name: string): Promise<Contact | null> {
  if (!cacheLoaded) {
    await loadContacts();
  }

  const normalizedName = normalizeHebrew(name);

  // Check store aliases first
  const aliases = useDabriStore.getState().contactAliases;
  const aliasMatch = aliases[normalizedName];
  if (aliasMatch) {
    const found = cachedContacts.find(
      (c) => normalizeHebrew(c.displayName) === normalizeHebrew(aliasMatch),
    );
    if (found) {
      return found;
    }
  }

  // Exact match
  const exact = cachedContacts.find(
    (c) => normalizeHebrew(c.displayName) === normalizedName,
  );
  if (exact) {
    return exact;
  }

  // Prefix match
  const prefix = cachedContacts.find((c) =>
    normalizeHebrew(c.displayName).startsWith(normalizedName),
  );
  if (prefix) {
    return prefix;
  }

  // Levenshtein fuzzy match (best distance ≤ 2)
  let bestMatch: Contact | null = null;
  let bestDistance = Infinity;

  for (const contact of cachedContacts) {
    const distance = levenshteinDistance(
      normalizedName,
      normalizeHebrew(contact.displayName),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = contact;
    }
  }

  if (bestDistance <= 2 && bestMatch) {
    return bestMatch;
  }

  return null;
}

export function invalidateContactCache(): void {
  cachedContacts = [];
  cacheLoaded = false;
}
