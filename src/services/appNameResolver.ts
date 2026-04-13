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
  category: string | null;
}

// ── Installed apps cache ─────────────────────────────────────────────

interface InstalledApp {
  packageName: string;
  label: string;
  normalizedLabel: string;
  skeleton: string;
  /** Key segments from package name for matching (e.g., ["whatsapp"] from com.whatsapp) */
  packageSegments: string[];
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
      packageSegments: extractPackageSegments(a.packageName),
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

/**
 * Extract meaningful segments from a package name.
 * "com.whatsapp" → ["whatsapp"]
 * "com.facebook.katana" → ["facebook", "katana"]
 * "com.google.android.apps.maps" → ["google", "maps"]
 */
function extractPackageSegments(packageName: string): string[] {
  const skip = new Set(['com', 'org', 'net', 'android', 'apps', 'app', 'mobile', 'lite', 'main']);
  return packageName
    .split('.')
    .filter((seg) => seg.length > 2 && !skip.has(seg))
    .map((seg) => seg.toLowerCase());
}

// ── Self-launch detection ────────────────────────────────────────────
const SELF_NAMES = ['דברי', 'dabri', 'דאברי'];

// ── Category Map ─────────────────────────────────────────────────────

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

// ── Fallback Map (Hebrew TRANSLATIONS → English) ─────────────────────
// Only for words where Hebrew is a genuine translation, not a phonetic
// transliteration. Transliterations are handled by the phonetic engine.

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

const DIGRAPHS: [string, string][] = [
  ['ווא', 'wa'],  // Must come before וו
  ['וו', 'w'],
  ['יי', 'i'],
  ['או', 'o'],
  ['אי', 'i'],
  ["ג'", 'j'],
  ["צ'", 'ch'],
  ["ז'", 'zh'],
  ['טש', 'ch'],
];

/** Primary mapping: Hebrew character → most common Latin sound. */
const CHAR_MAP: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'o', 'ז': 'z', 'ח': 'h', 'ט': 't', 'י': 'i',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
  'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
};

/** Ambiguous characters that can map to multiple Latin sounds. */
const AMBIGUOUS: Record<string, string[]> = {
  'פ': ['p', 'f'],
  'ב': ['b', 'v'],
  'כ': ['k', 'ch'],
  'ך': ['k', 'ch'],
  'ו': ['o', 'v', 'u'],
  'ש': ['sh', 's'],
};

/**
 * Generate multiple Latin transliteration variants from Hebrew text.
 * Handles ambiguous characters (פ→p/f, ב→b/v, etc.) by branching.
 * Capped at maxVariants to keep it fast.
 */
function hebrewToLatinVariants(text: string, maxVariants = 8): string[] {
  let processed = text.toLowerCase().trim();
  // Normalize triple-vav
  processed = processed.replace(/ווו/g, 'וו');
  // Normalize geresh
  processed = processed.replace(/׳/g, "'");

  // Process digraphs first
  for (const [heb, lat] of DIGRAPHS) {
    processed = processed.split(heb).join(lat);
  }

  // Build variants by expanding ambiguous characters
  let variants: string[] = [''];

  for (const ch of processed) {
    const alts = AMBIGUOUS[ch];
    if (alts && variants.length < maxVariants) {
      const newVariants: string[] = [];
      for (const prefix of variants) {
        for (const alt of alts) {
          newVariants.push(prefix + alt);
          if (newVariants.length >= maxVariants) { break; }
        }
        if (newVariants.length >= maxVariants) { break; }
      }
      variants = newVariants;
    } else {
      const mapped = CHAR_MAP[ch] ?? ch;
      variants = variants.map((v) => v + mapped);
    }
  }

  return variants;
}

/**
 * Extract consonant skeleton: strip non-latin, strip vowels, collapse repeats.
 * The collapse step is critical — "whatsapp" → "whtsp" not "whtspp",
 * making it much closer to Hebrew transliteration skeletons.
 */
function consonantSkeleton(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/[aeiou]/g, '')
    .replace(/(.)\1+/g, '$1');  // collapse repeated consonants
}

/** Get multiple consonant skeletons from Hebrew text via variant transliterations. */
function hebrewSkeletons(hebrewText: string): string[] {
  return hebrewToLatinVariants(hebrewText)
    .map((v) => consonantSkeleton(v))
    .filter((v, i, arr) => v.length >= 2 && arr.indexOf(v) === i);
}

// ── Matching ─────────────────────────────────────────────────────────

function fuzzyThreshold(len: number): number {
  if (len <= 2) { return 0; }
  if (len <= 4) { return 1; }
  if (len <= 7) { return 2; }
  return 3;
}

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
 * Score an app using phonetic skeleton comparison with MULTIPLE query variants.
 * Uses Math.max of both lengths for threshold — critical for asymmetric lengths.
 */
function scorePhonetic(querySkeletons: string[], app: InstalledApp): AppMatchTier {
  const labelSkeleton = app.skeleton;
  if (!labelSkeleton) { return AppMatchTier.NONE; }

  for (const qs of querySkeletons) {
    if (!qs) { continue; }

    if (labelSkeleton === qs) { return AppMatchTier.EXACT; }

    if (labelSkeleton.includes(qs) && qs.length >= 3) { return AppMatchTier.PREFIX; }
    if (qs.includes(labelSkeleton) && labelSkeleton.length >= 3) { return AppMatchTier.PREFIX; }

    const maxLen = Math.max(qs.length, labelSkeleton.length);
    const threshold = fuzzyThreshold(maxLen);
    if (threshold > 0 && levenshteinDistance(qs, labelSkeleton) <= threshold) {
      return AppMatchTier.FUZZY;
    }

    // Per-word skeleton match
    const labelWords = app.normalizedLabel.split(/\s+/);
    for (const w of labelWords) {
      const wordSkeleton = consonantSkeleton(w);
      if (wordSkeleton === qs) { return AppMatchTier.EXACT; }
      const wMax = Math.max(qs.length, wordSkeleton.length);
      const wThreshold = fuzzyThreshold(wMax);
      if (wThreshold > 0 && levenshteinDistance(qs, wordSkeleton) <= wThreshold) {
        return AppMatchTier.FUZZY;
      }
    }
  }

  return AppMatchTier.NONE;
}

/**
 * Score an app by matching query skeletons against package name segments.
 * "com.whatsapp" → segment skeleton "whtsp" — matches Hebrew "ווטסאפ" → "wtsp".
 */
function scorePackageName(querySkeletons: string[], app: InstalledApp): AppMatchTier {
  for (const seg of app.packageSegments) {
    const segSkeleton = consonantSkeleton(seg);
    if (!segSkeleton || segSkeleton.length < 2) { continue; }

    for (const qs of querySkeletons) {
      if (segSkeleton === qs) { return AppMatchTier.EXACT; }

      const maxLen = Math.max(qs.length, segSkeleton.length);
      const threshold = fuzzyThreshold(maxLen);
      if (threshold > 0 && levenshteinDistance(qs, segSkeleton) <= threshold) {
        return AppMatchTier.FUZZY;
      }
    }
  }
  return AppMatchTier.NONE;
}

// ── Main Resolution ──────────────────────────────────────────────────

/**
 * Resolve a Hebrew app name to installed app(s) or a system category.
 *
 * Strategy:
 *  0. Self-launch (Dabri)
 *  1. Category map → system intent
 *  2. Direct label match
 *  3. Fallback map (Hebrew translations → English)
 *  4. Phonetic multi-variant skeleton match (against app labels)
 *  5. Package name segment skeleton match
 *  6. Retry 2-5 with leading ה restored
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
      matches: [{ packageName: 'com.dabri', label: 'דברי', tier: AppMatchTier.EXACT }],
      bestTier: AppMatchTier.EXACT,
      category: null,
    };
  }

  // ── Step 1: Category map ──
  const category = CATEGORY_MAP[normalized];
  if (category) {
    return { matches: [], bestTier: AppMatchTier.EXACT, category };
  }

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

    // ── Step 3: Fallback map ──
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

    // ── Step 4: Phonetic multi-variant match ──
    const skeletons = hebrewSkeletons(query);
    if (skeletons.length > 0) {
      const phoneticMatches = collectBestMatches(
        installedAppsCache,
        (app) => scorePhonetic(skeletons, app),
      );
      if (phoneticMatches.length > 0) {
        return { matches: phoneticMatches, bestTier: phoneticMatches[0].tier, category: null };
      }

      // ── Step 5: Package name segment match ──
      const packageMatches = collectBestMatches(
        installedAppsCache,
        (app) => scorePackageName(skeletons, app),
      );
      if (packageMatches.length > 0) {
        return { matches: packageMatches, bestTier: packageMatches[0].tier, category: null };
      }
    }
  }

  return empty;
}
