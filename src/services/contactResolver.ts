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
  WORD = 2,     // a word within displayName matches the search term
  PREFIX = 3,
  ALIAS = 4,
  EXACT = 5,
}

interface ScoredMatch {
  contact: Contact | null;
  tier: MatchTier;
}

function fuzzyThreshold(len: number): number {
  return len <= 3 ? 1 : len <= 7 ? 2 : 3;
}

/** Score a single contact against a search term. */
function scoreOneContact(normalizedName: string, c: Contact): MatchTier {
  const dn = normalizeHebrew(c.displayName);

  // Exact
  if (dn === normalizedName) { return MatchTier.EXACT; }

  // Prefix — displayName starts with search term
  if (dn.startsWith(normalizedName)) { return MatchTier.PREFIX; }

  // Word — any word in displayName matches the search term
  const words = dn.split(/\s+/);
  for (const w of words) {
    if (w === normalizedName) { return MatchTier.WORD; }
  }
  // Word prefix — any word starts with search term
  for (const w of words) {
    if (w.startsWith(normalizedName) && normalizedName.length >= 2) { return MatchTier.WORD; }
  }
  // Suffix — displayName ends with search term (multi-word last names like "אבו חסן")
  if (dn.endsWith(normalizedName) && normalizedName.length >= 2) { return MatchTier.WORD; }
  // Word fuzzy — any word fuzzy-matches the search term
  const wThreshold = fuzzyThreshold(normalizedName.length);
  for (const w of words) {
    if (levenshteinDistance(normalizedName, w) <= wThreshold) { return MatchTier.WORD; }
  }

  // Full-name fuzzy
  if (levenshteinDistance(normalizedName, dn) <= fuzzyThreshold(normalizedName.length)) {
    return MatchTier.FUZZY;
  }

  return MatchTier.NONE;
}

/** Score the best single match (used by alignment expansion). */
function scoreContactMatch(name: string): ScoredMatch {
  const normalizedName = normalizeHebrew(name);

  // Alias — check user-defined aliases first
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

  // Score all contacts based on tiers and return the best one
  let bestContact: Contact | null = null;
  let bestTier = MatchTier.NONE;

  for (const c of cachedContacts) {
    const tier = scoreOneContact(normalizedName, c);
    if (tier > bestTier) {
      bestTier = tier;
      bestContact = c;
    }
  }

  return { contact: bestContact, tier: bestTier };
}

/** Find ALL contacts matching at the best tier (for disambiguation). Max 3. */
function scoreAllContactMatches(name: string): { contacts: Contact[]; tier: MatchTier } {
  const normalizedName = normalizeHebrew(name);

  // Alias — always single result
  const aliases = useDabriStore.getState().contactAliases;
  const aliasTarget = aliases[normalizedName];
  if (aliasTarget) {
    const found = cachedContacts.find(
      (c) => normalizeHebrew(c.displayName) === normalizeHebrew(aliasTarget),
    );
    if (found) {
      return { contacts: [found], tier: MatchTier.ALIAS };
    }
  }

  // Score every contact, group by tier
  const byTier = new Map<MatchTier, Contact[]>();
  for (const c of cachedContacts) {
    const tier = scoreOneContact(normalizedName, c);
    if (tier > MatchTier.NONE) {
      if (!byTier.has(tier)) { byTier.set(tier, []); }
      byTier.get(tier)!.push(c);
    }
  }

  // Return matches at the highest tier, capped at 3
  for (const tier of [MatchTier.EXACT, MatchTier.PREFIX, MatchTier.WORD, MatchTier.FUZZY]) {
    const matches = byTier.get(tier);
    if (matches && matches.length > 0) {
      return { contacts: matches.slice(0, 3), tier };
    }
  }

  return { contacts: [], tier: MatchTier.NONE };
}

export async function resolveContact(name: string): Promise<Contact | null> {
  if (!cacheLoaded) {
    await loadContacts();
  }
  return scoreContactMatch(name).contact;
}

/** Resolve contact with disambiguation support (for calls — no message splitting). */
export async function resolveContactCandidates(name: string): Promise<Contact[]> {
  if (!cacheLoaded) {
    await loadContacts();
  }
  return scoreAllContactMatches(name).contacts;
}

// ── Contact-aware boundary alignment ──────────────────────────────────

/** Words that start with ש but are NOT the conjunction ש. */
const SHIN_NON_CONJUNCTION = /^ש[בלמנ]|^שב[תע]|^של[וו]ם|^שי/;

function stripLeadingShinConjunction(text: string): string {
  if (!text.startsWith('ש')) { return text; }
  if (SHIN_NON_CONJUNCTION.test(text)) { return text; }
  return text.slice(1);
}

export async function resolveContactWithAlignment(
  rawContact: string,
  rawMessage: string,
): Promise<{ contact: Contact | null; correctedMessage: string; allCandidates: Contact[] }> {
  if (!cacheLoaded) {
    await loadContacts();
  }

  const messageWords = rawMessage.split(/\s+/).filter(Boolean);
  let best = scoreContactMatch(rawContact);
  let bestAll = scoreAllContactMatches(rawContact);
  let wordsConsumed = 0;

  // Try expanding contact name by adding words from the message (max 4)
  const maxExpansion = Math.min(4, messageWords.length);
  for (let i = 1; i <= maxExpansion; i++) {
    const candidate = rawContact + ' ' + messageWords.slice(0, i).join(' ');
    const scored = scoreContactMatch(candidate);

    if (scored.tier === MatchTier.NONE) {
      break;
    }
    if (scored.tier > best.tier || (scored.tier === best.tier && scored.tier >= MatchTier.FUZZY)) {
      best = scored;
      bestAll = scoreAllContactMatches(candidate);
      wordsConsumed = i;
    }
  }

  const remainingWords = messageWords.slice(wordsConsumed);
  const remaining = remainingWords.join(' ');
  const correctedMessage = stripLeadingShinConjunction(remaining);

  return {
    contact: best.contact,
    correctedMessage,
    allCandidates: bestAll.contacts,
  };
}

export function invalidateContactCache(): void {
  cachedContacts = [];
  cacheLoaded = false;
}
