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

// ── Match scoring ──────────────────────────────────────────────────────
const enum MatchTier {
  NONE = 0,
  FUZZY = 1,
  PREFIX = 2,
  ALIAS = 3,
  EXACT = 4,
}

interface ScoredMatch {
  contact: Contact | null;
  tier: MatchTier;
}

function scoreContactMatch(name: string): ScoredMatch {
  const normalizedName = normalizeHebrew(name);

  // Alias
  const aliases = useDabriStore.getState().contactAliases;
  const aliasTarget = aliases[normalizedName];
  if (aliasTarget) {
    const found = cachedContacts.find(
      (c) => normalizeHebrew(c.displayName) === normalizeHebrew(aliasTarget),
    );
    if (found) {
      return { contact: found, tier: MatchTier.ALIAS };
    }
  }

  // Exact
  const exact = cachedContacts.find(
    (c) => normalizeHebrew(c.displayName) === normalizedName,
  );
  if (exact) {
    return { contact: exact, tier: MatchTier.EXACT };
  }

  // Prefix
  const prefix = cachedContacts.find((c) =>
    normalizeHebrew(c.displayName).startsWith(normalizedName),
  );
  if (prefix) {
    return { contact: prefix, tier: MatchTier.PREFIX };
  }

  // Fuzzy — threshold scales with name length to avoid false matches on short names
  const maxDistance = normalizedName.length <= 3 ? 1 : normalizedName.length <= 7 ? 2 : 3;
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
  if (bestDistance <= maxDistance && bestMatch) {
    return { contact: bestMatch, tier: MatchTier.FUZZY };
  }

  return { contact: null, tier: MatchTier.NONE };
}

export async function resolveContact(name: string): Promise<Contact | null> {
  if (!cacheLoaded) {
    await loadContacts();
  }
  return scoreContactMatch(name).contact;
}

// ── Contact-aware boundary alignment ──────────────────────────────────
// The regex parser uses non-greedy matching for the contact name, so it
// may capture only the first word of a multi-word name (e.g. "גיל" instead
// of "גיל צרפתי"). This function tries progressively longer names against
// the contact list to find the best match, then returns the corrected
// message with the ש conjunction stripped if needed.

/** Words that start with ש but are NOT the conjunction ש. */
const SHIN_NON_CONJUNCTION = /^ש[בלמנ]|^שב[תע]|^של[וו]ם|^שי/;

function stripLeadingShinConjunction(text: string): string {
  if (!text.startsWith('ש')) {
    return text;
  }
  // Keep words where ש is integral (שבת, שלום, שמח, שני, שבוע, שנה, etc.)
  if (SHIN_NON_CONJUNCTION.test(text)) {
    return text;
  }
  // Strip the ש conjunction (שאני → אני, שמחר → מחר, שהוא → הוא)
  return text.slice(1);
}

export async function resolveContactWithAlignment(
  rawContact: string,
  rawMessage: string,
): Promise<{ contact: Contact | null; correctedMessage: string }> {
  if (!cacheLoaded) {
    await loadContacts();
  }

  const messageWords = rawMessage.split(/\s+/).filter(Boolean);
  let best = scoreContactMatch(rawContact);
  let wordsConsumed = 0;

  // Try expanding contact name by adding words from the message (max 4)
  const maxExpansion = Math.min(4, messageWords.length);
  for (let i = 1; i <= maxExpansion; i++) {
    const candidate = rawContact + ' ' + messageWords.slice(0, i).join(' ');
    const scored = scoreContactMatch(candidate);

    if (scored.tier === MatchTier.NONE) {
      break; // No point extending further
    }
    if (scored.tier > best.tier || (scored.tier === best.tier && scored.tier >= MatchTier.FUZZY)) {
      best = scored;
      wordsConsumed = i;
    }
  }

  const remainingWords = messageWords.slice(wordsConsumed);
  const remaining = remainingWords.join(' ');
  const correctedMessage = stripLeadingShinConjunction(remaining);

  return { contact: best.contact, correctedMessage };
}

export function invalidateContactCache(): void {
  cachedContacts = [];
  cacheLoaded = false;
}
