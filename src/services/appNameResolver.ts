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
}

// ── Installed apps cache ─────────────────────────────────────────────

interface InstalledApp {
  packageName: string;
  label: string;
  normalizedLabel: string;
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

// ── Hebrew App Aliases ───────────────────────────────────────────────
// Maps normalized Hebrew name -> Android package name.
// Entries starting with __CATEGORY_ are generic-category sentinels
// handled by launchByCategory() in the native module.

const HEBREW_APP_ALIASES: Record<string, string> = {
  // ── Social ──
  'וואטסאפ':        'com.whatsapp',
  'ווצאפ':          'com.whatsapp',
  'ווטסאפ':         'com.whatsapp',
  'וואצאפ':         'com.whatsapp',
  'whatsapp':        'com.whatsapp',

  'פייסבוק':        'com.facebook.katana',
  'פיסבוק':         'com.facebook.katana',
  'facebook':        'com.facebook.katana',

  'אינסטגרם':       'com.instagram.android',
  'אינסטה':         'com.instagram.android',
  'instagram':       'com.instagram.android',

  'טיקטוק':         'com.zhiliaoapp.musically',
  'טיק טוק':        'com.zhiliaoapp.musically',
  'tiktok':          'com.zhiliaoapp.musically',

  'טלגרם':          'org.telegram.messenger',
  'טלגראם':         'org.telegram.messenger',
  'telegram':        'org.telegram.messenger',

  'סנאפצט':         'com.snapchat.android',
  'snapchat':        'com.snapchat.android',

  'לינקדאין':       'com.linkedin.android',
  'לינקד אין':      'com.linkedin.android',
  'linkedin':        'com.linkedin.android',

  'רדיט':           'com.reddit.frontpage',
  'reddit':          'com.reddit.frontpage',

  'טוויטר':         'com.twitter.android',
  'אקס':            'com.twitter.android',
  'twitter':         'com.twitter.android',

  'פינטרסט':        'com.pinterest',
  'pinterest':       'com.pinterest',

  // ── Navigation ──
  'וויז':           'com.waze',
  'ווייז':          'com.waze',
  'waze':            'com.waze',

  'גוגל מפות':      'com.google.android.apps.maps',
  'מפות':           'com.google.android.apps.maps',
  'מפות גוגל':      'com.google.android.apps.maps',
  'google maps':     'com.google.android.apps.maps',

  'מוז':            'com.moovit.app',
  'מובית':          'com.moovit.app',
  'moovit':          'com.moovit.app',

  // ── Communication ──
  "ג'ימייל":        'com.google.android.gm',
  "ג'מייל":         'com.google.android.gm',
  'gmail':           'com.google.android.gm',
  'מייל':           'com.google.android.gm',
  'אימייל':         'com.google.android.gm',
  'דואר':           'com.google.android.gm',

  'אאוטלוק':        'com.microsoft.office.outlook',
  'outlook':         'com.microsoft.office.outlook',

  'זום':            'us.zoom.videomeetings',
  'zoom':            'us.zoom.videomeetings',

  'טימס':           'com.microsoft.teams',
  'teams':           'com.microsoft.teams',

  'גוגל מיט':       'com.google.android.apps.tachyon',
  'מיט':            'com.google.android.apps.tachyon',
  'google meet':     'com.google.android.apps.tachyon',

  // ── Streaming / Media ──
  'נטפליקס':        'com.netflix.mediaclient',
  'netflix':         'com.netflix.mediaclient',

  'יוטיוב':         'com.google.android.youtube',
  'youtube':         'com.google.android.youtube',

  'ספוטיפיי':       'com.spotify.music',
  'ספוטיפי':        'com.spotify.music',
  'spotify':         'com.spotify.music',

  'אפל מיוזיק':     'com.apple.android.music',
  'apple music':     'com.apple.android.music',

  'דיזני פלוס':     'com.disney.disneyplus',
  'דיזני+':         'com.disney.disneyplus',
  'disney+':         'com.disney.disneyplus',

  // ── Shopping ──
  'עלי אקספרס':     'com.alibaba.aliexpresshd',
  'עלי':            'com.alibaba.aliexpresshd',
  'aliexpress':      'com.alibaba.aliexpresshd',

  'אמזון':          'com.amazon.mShop.android.shopping',
  'amazon':          'com.amazon.mShop.android.shopping',

  'שיין':           'com.zzkko',
  'shein':           'com.zzkko',

  // ── Israeli Banking & Finance ──
  'ביט':            'il.co.isracard.bit',
  'bit':             'il.co.isracard.bit',

  'פייבוקס':        'com.payboxapp',
  'paybox':          'com.payboxapp',

  'כאל':            'com.cal.calapp',
  'cal':             'com.cal.calapp',

  'מקס':            'com.ideomobile.leumicard',
  'max':             'com.ideomobile.leumicard',

  'לאומי':          'com.leumi.leumiwallet',
  'בנק לאומי':      'com.leumi.leumiwallet',

  'פועלים':         'com.ideomobile.hapoalim',
  'בנק הפועלים':    'com.ideomobile.hapoalim',
  'הפועלים':        'com.ideomobile.hapoalim',

  'דיסקונט':        'com.ideomobile.discount',
  'בנק דיסקונט':    'com.ideomobile.discount',

  'פפר':            'com.pepper.app',
  'pepper':          'com.pepper.app',

  // ── Israeli Grocery / Retail / Ride ──
  'סופר פארם':      'com.super_pharm.customers',
  'סופר-פארם':      'com.super_pharm.customers',

  'שופרסל':         'com.shufersal.android',
  'רמי לוי':        'com.ramilevi.app',

  'גט':             'com.gettaxi.android',
  'גט טקסי':        'com.gettaxi.android',
  'gett':            'com.gettaxi.android',

  // ── System / Generic Categories ──
  'מצלמה':          '__CATEGORY_CAMERA__',
  'צילום':          '__CATEGORY_CAMERA__',

  'הגדרות':         '__CATEGORY_SETTINGS__',

  'דפדפן':          '__CATEGORY_BROWSER__',
  'אינטרנט':        '__CATEGORY_BROWSER__',

  'חנות':           '__CATEGORY_PLAY_STORE__',
  'חנות אפליקציות':  '__CATEGORY_PLAY_STORE__',
  'פליי סטור':      '__CATEGORY_PLAY_STORE__',
  'גוגל פליי':      '__CATEGORY_PLAY_STORE__',
  'play store':      '__CATEGORY_PLAY_STORE__',

  'גלריה':          '__CATEGORY_GALLERY__',
  'תמונות':         '__CATEGORY_GALLERY__',

  'מחשבון':         '__CATEGORY_CALCULATOR__',

  'שעון':           '__CATEGORY_CLOCK__',
  'שעון מעורר':     '__CATEGORY_CLOCK__',
  'טיימר':          '__CATEGORY_CLOCK__',

  'לוח שנה':        '__CATEGORY_CALENDAR__',
  'יומן':           '__CATEGORY_CALENDAR__',

  // ── Samsung apps ──
  'אינטרנט סמסונג':  'com.sec.android.app.sbrowser',
  'סמסונג אינטרנט':  'com.sec.android.app.sbrowser',
  'פתקים':          'com.samsung.android.app.notes',
  'סמסונג פתקים':   'com.samsung.android.app.notes',
};

// Maps __CATEGORY_*__ sentinels to native launchByCategory() keys
const CATEGORY_TO_NATIVE: Record<string, string> = {
  '__CATEGORY_CAMERA__':      'camera',
  '__CATEGORY_SETTINGS__':    'settings',
  '__CATEGORY_BROWSER__':     'browser',
  '__CATEGORY_PLAY_STORE__':  'playstore',
  '__CATEGORY_GALLERY__':     'camera', // fallback — gallery varies by OEM
  '__CATEGORY_CALCULATOR__':  'calculator',
  '__CATEGORY_CLOCK__':       'calculator', // fallback — use same approach
  '__CATEGORY_CALENDAR__':    'calendar',
};

// ── Matching ─────────────────────────────────────────────────────────

function fuzzyThreshold(len: number): number {
  if (len <= 2) { return 0; }
  if (len <= 4) { return 1; }
  if (len <= 7) { return 2; }
  return 3;
}

function scoreOneApp(query: string, app: InstalledApp): AppMatchTier {
  const label = app.normalizedLabel;

  // Exact
  if (label === query) { return AppMatchTier.EXACT; }

  // Word exact — any word in label matches query
  const words = label.split(/\s+/);
  for (const w of words) {
    if (w === query) { return AppMatchTier.EXACT; }
  }

  // Prefix — label starts with query
  if (label.startsWith(query)) { return AppMatchTier.PREFIX; }
  // Word prefix
  for (const w of words) {
    if (w.startsWith(query) && query.length >= 2) { return AppMatchTier.PREFIX; }
  }

  // Contains — query is a substring of label
  if (label.includes(query) && query.length >= 3) { return AppMatchTier.PREFIX; }

  // Fuzzy
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

/**
 * Resolve a Hebrew app name to one or more candidate packages.
 *
 * Strategy:
 *  1. Exact alias match (HEBREW_APP_ALIASES)
 *  2. Retry with leading ה restored (in case cleanAppName stripped it)
 *  3. Score against installed app labels (EXACT > PREFIX > FUZZY)
 *  4. Return up to 3 matches at the best tier.
 */
export async function resolveAppName(rawName: string): Promise<AppResolveResult> {
  if (!cacheLoaded) {
    await loadInstalledApps();
  }

  const normalized = normalizeHebrew(rawName);

  // ── Step 1: Check hardcoded aliases ──
  const aliasPackage = HEBREW_APP_ALIASES[normalized];
  if (aliasPackage) {
    return {
      matches: [{ packageName: aliasPackage, label: rawName, tier: AppMatchTier.EXACT }],
      bestTier: AppMatchTier.EXACT,
    };
  }

  // ── Step 1b: Retry with leading ה restored ──
  const withHe = 'ה' + normalized;
  const aliasWithHe = HEBREW_APP_ALIASES[withHe];
  if (aliasWithHe) {
    return {
      matches: [{ packageName: aliasWithHe, label: rawName, tier: AppMatchTier.EXACT }],
      bestTier: AppMatchTier.EXACT,
    };
  }

  // ── Step 2: Score against installed app labels ──
  const byTier = new Map<AppMatchTier, AppMatch[]>();

  for (const app of installedAppsCache) {
    const tier = scoreOneApp(normalized, app);
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
      return { matches: matches.slice(0, 3), bestTier: tier };
    }
  }

  // ── Step 3: Retry with ה against installed apps ──
  for (const app of installedAppsCache) {
    const tier = scoreOneApp(withHe, app);
    if (tier >= AppMatchTier.PREFIX) {
      return {
        matches: [{ packageName: app.packageName, label: app.label, tier }],
        bestTier: tier,
      };
    }
  }

  return { matches: [], bestTier: AppMatchTier.NONE };
}

/**
 * Check if a resolved package name is a generic category sentinel.
 * Returns the native category key (e.g. "camera") or null.
 */
export function getCategoryKey(packageName: string): string | null {
  return CATEGORY_TO_NATIVE[packageName] ?? null;
}
