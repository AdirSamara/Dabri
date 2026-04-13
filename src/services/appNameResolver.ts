import { normalizeHebrew, levenshteinDistance } from '../utils/hebrewUtils';
import AppLauncherBridge from '../native/AppLauncherBridge';

// ── Types ────────────────────────────────────────────────────────────

export const enum AppMatchTier {
  NONE = 0,
  FUZZY = 1,
  PREFIX = 2,
  EXACT = 3,
}

export interface AppMatch {
  packageName: string;
  label: string;
  tier: AppMatchTier;
}

export interface AppResolveResult {
  matches: AppMatch[];
  bestTier: AppMatchTier;
  category: string | null; // non-null = launch via launchByCategory()
}

// ── Installed apps cache ─────────────────────────────────────────────

interface InstalledApp {
  packageName: string;
  label: string;
  normalizedLabel: string;
  /** Consonant skeleton of the English label for phonetic matching */
  skeleton: string;
}

let installedAppsCache: InstalledApp[] = [];
let cacheLoaded = false;

export async function loadInstalledApps(): Promise<void> {
  if (!AppLauncherBridge) {
    cacheLoaded = true;
    return;
  }
  try {
    const apps = await AppLauncherBridge.getInstalledApps();
    installedAppsCache = apps.map((a) => ({
      packageName: a.packageName,
      label: a.label,
      normalizedLabel: normalizeHebrew(a.label),
      skeleton: consonantSkeleton(a.label),
    }));
    cacheLoaded = true;
  } catch {
    cacheLoaded = true;
  }
}

export function invalidateAppCache(): void {
  installedAppsCache = [];
  cacheLoaded = false;
}

// ── Category Map (system intents, NOT specific apps) ─────────────────

// ── Self-launch detection ────────────────────────────────────────────
// The app excludes itself from getInstalledApps(), so "תפתח דברי"
// would fuzzy-match to the wrong app. Handle it explicitly.
const SELF_NAMES = ['דברי', 'dabri', 'דאברי'];

const CATEGORY_MAP: Record<string, string> = {
  'מצלמה':            'camera',
  'צילום':            'camera',
  'הגדרות':           'settings',
  'דפדפן':            'browser',
  'חנות':             'playstore',
  'חנות אפליקציות':    'playstore',
  'פליי סטור':        'playstore',
  'גוגל פליי':        'playstore',
  'play store':        'playstore',
  'מחשבון':           'calculator',
  'לוח שנה':          'calendar',
  'יומן':             'calendar',
};

// ── Fallback Map (Hebrew words → English search term) ────────────────
// Only for native Hebrew words where phonetic transliteration can't work
// because the English label is a completely different word.
// NOT package names — these are search terms matched against installed labels.

const FALLBACK_MAP: Record<string, string> = {
  'שעון':        'clock',
  'שעון מעורר':  'alarm',
  'טיימר':       'timer',
  'פנס':         'flashlight',
  'גלריה':       'gallery',
  'תמונות':      'photos',
  'פתקים':       'notes',
  'דואר':        'mail',
  'מייל':        'mail',
  'אימייל':      'email',
  'מפות':        'maps',
  'אינטרנט':     'internet',
  'אקס':         'x',
};

// ── Hebrew → Latin Phonetic Transliteration ──────────────────────────

/** Multi-character Hebrew patterns processed first (order matters). */
const DIGRAPHS: [string, string][] = [
  ['וו', 'w'],
  ['יי', 'i'],
  ['או', 'o'],
  ['אי', 'i'],
  ["ג'", 'j'],
  ["צ'", 'ch'],
  ["ז'", 'zh'],
];

/** Single Hebrew character → Latin sound. */
const CHAR_MAP: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'o', 'ז': 'z', 'ח': 'h', 'ט': 't', 'י': 'i',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
  'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
};

/**
 * Convert Hebrew text to approximate Latin phonetic representation.
 * Processes digraphs first, then single characters.
 * Non-Hebrew characters pass through unchanged (handles mixed text).
 */
function hebrewToLatin(text: string): string {
  let result = text.toLowerCase().trim();

  // Process digraphs first
  for (const [heb, lat] of DIGRAPHS) {
    result = result.split(heb).join(lat);
  }

  // Process remaining single characters
  let output = '';
  for (const ch of result) {
    output += CHAR_MAP[ch] ?? ch;
  }

  return output;
}

/**
 * Extract consonant skeleton from text (strip vowels + normalize).
 * Used to compare Hebrew transliterations against English labels.
 */
function consonantSkeleton(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, '')     // keep only Latin letters
    .replace(/[aeiou]/g, '');   // strip vowels
}

/** Consonant skeleton of a Hebrew word via transliteration. */
function hebrewSkeleton(hebrewText: string): string {
  return consonantSkeleton(hebrewToLatin(hebrewText));
}

// ── Matching ─────────────────────────────────────────────────────────

function fuzzyThreshold(len: number): number {
  if (len <= 2) { return 0; }
  if (len <= 4) { return 1; }
  if (len <= 7) { return 2; }
  return 3;
}

/** Score an app against a direct (non-transliterated) query. */
function scoreOneApp(query: string, app: InstalledApp): AppMatchTier {
  const label = app.normalizedLabel;

  if (label === query) { return AppMatchTier.EXACT; }

  const words = label.split(/\s+/);
  for (const w of words) {
    if (w === query) { return AppMatchTier.EXACT; }
  }

  if (label.startsWith(query)) { return AppMatchTier.PREFIX; }
  for (const w of words) {
    if (w.startsWith(query) && query.length >= 2) { return AppMatchTier.PREFIX; }
  }

  if (label.includes(query) && query.length >= 3) { return AppMatchTier.PREFIX; }

  const threshold = fuzzyThreshold(query.length);
  if (threshold > 0 && levenshteinDistance(query, label) <= threshold) {
    return AppMatchTier.FUZZY;
  }
  for (const w of words) {
    if (threshold > 0 && levenshteinDistance(query, w) <= threshold) {
      return AppMatchTier.FUZZY;
    }
  }

  return AppMatchTier.NONE;
}

/** Collect best-tier matches from a scoring pass. Returns up to 3. */
function collectBestMatches(
  apps: InstalledApp[],
  scorer: (app: InstalledApp) => AppMatchTier,
): AppMatch[] {
  const byTier = new Map<AppMatchTier, AppMatch[]>();

  for (const app of apps) {
    const tier = scorer(app);
    if (tier > AppMatchTier.NONE) {
      if (!byTier.has(tier)) { byTier.set(tier, []); }
      byTier.get(tier)!.push({
        packageName: app.packageName,
        label: app.label,
        tier,
      });
    }
  }

  for (const tier of [AppMatchTier.EXACT, AppMatchTier.PREFIX, AppMatchTier.FUZZY]) {
    const matches = byTier.get(tier);
    if (matches && matches.length > 0) {
      return matches.slice(0, 3);
    }
  }
  return [];
}

/**
 * Score an app using phonetic consonant skeleton comparison.
 * Compares the Hebrew query's skeleton against the app label's skeleton.
 */
function scorePhonetic(querySkeleton: string, app: InstalledApp): AppMatchTier {
  const labelSkeleton = app.skeleton;

  if (!querySkeleton || !labelSkeleton) { return AppMatchTier.NONE; }

  if (labelSkeleton === querySkeleton) { return AppMatchTier.EXACT; }

  // Check if one contains the other (for partial matches)
  if (labelSkeleton.includes(querySkeleton) && querySkeleton.length >= 3) {
    return AppMatchTier.PREFIX;
  }
  if (querySkeleton.includes(labelSkeleton) && labelSkeleton.length >= 3) {
    return AppMatchTier.PREFIX;
  }

  // Fuzzy on skeletons — use generous threshold since skeletons are short
  const threshold = fuzzyThreshold(querySkeleton.length);
  if (threshold > 0 && levenshteinDistance(querySkeleton, labelSkeleton) <= threshold) {
    return AppMatchTier.FUZZY;
  }

  // Also try skeleton-per-word (for multi-word labels like "Google Maps")
  const labelWords = app.normalizedLabel.split(/\s+/);
  for (const w of labelWords) {
    const wordSkeleton = consonantSkeleton(w);
    if (wordSkeleton === querySkeleton) { return AppMatchTier.EXACT; }
    if (threshold > 0 && levenshteinDistance(querySkeleton, wordSkeleton) <= threshold) {
      return AppMatchTier.FUZZY;
    }
  }

  return AppMatchTier.NONE;
}

// ── Main Resolution ──────────────────────────────────────────────────

/**
 * Resolve a Hebrew app name to installed app(s) or a system category.
 *
 * Strategy (in order):
 *  1. Category map → system intent (camera, settings, etc.)
 *  2. Direct label match (Hebrew or English query vs installed labels)
 *  3. Fallback map → translate Hebrew word to English → search labels
 *  4. Phonetic transliteration → consonant skeleton match
 *  5. Retry 2-4 with leading ה restored
 *  6. No match → empty
 */
export async function resolveAppName(rawName: string): Promise<AppResolveResult> {
  if (!cacheLoaded) {
    await loadInstalledApps();
  }

  const normalized = normalizeHebrew(rawName);
  const empty: AppResolveResult = { matches: [], bestTier: AppMatchTier.NONE, category: null };

  // ── Step 0: Self-launch (Dabri) ──
  if (SELF_NAMES.includes(normalized)) {
    return {
      matches: [{
        packageName: 'com.dabri',
        label: 'דברי',
        tier: AppMatchTier.EXACT,
      }],
      bestTier: AppMatchTier.EXACT,
      category: null,
    };
  }

  // ── Step 1: Category map (system intents) ──
  const category = CATEGORY_MAP[normalized];
  if (category) {
    return {
      matches: [],
      bestTier: AppMatchTier.EXACT,
      category,
    };
  }

  // Try resolving with the given name, then retry with ה restored
  const candidates = [normalized, 'ה' + normalized];

  for (const query of candidates) {
    // ── Step 2: Direct label match ──
    const directMatches = collectBestMatches(
      installedAppsCache,
      (app) => scoreOneApp(query, app),
    );
    if (directMatches.length > 0) {
      return { matches: directMatches, bestTier: directMatches[0].tier, category: null };
    }

    // ── Step 3: Fallback map (Hebrew words → English search term) ──
    const fallback = FALLBACK_MAP[query];
    if (fallback) {
      const fallbackMatches = collectBestMatches(
        installedAppsCache,
        (app) => scoreOneApp(fallback, app),
      );
      if (fallbackMatches.length > 0) {
        return { matches: fallbackMatches, bestTier: fallbackMatches[0].tier, category: null };
      }
    }

    // ── Step 4: Phonetic transliteration match ──
    const skeleton = hebrewSkeleton(query);
    if (skeleton.length >= 2) {
      const phoneticMatches = collectBestMatches(
        installedAppsCache,
        (app) => scorePhonetic(skeleton, app),
      );
      if (phoneticMatches.length > 0) {
        return { matches: phoneticMatches, bestTier: phoneticMatches[0].tier, category: null };
      }
    }
  }

  return empty;
}
