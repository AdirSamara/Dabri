import { registerHandler } from './actionDispatcher';
import type { ActionResult } from './actionDispatcher';
import type { ParsedIntent } from '../types';
import NavigationBridge from '../native/NavigationBridge';
import { useDabriStore } from '../store';

const HOME_KEYWORDS = ['הביתה', 'בית', 'לבית', 'הבית', 'הבית שלי'];
const WORK_KEYWORDS = ['לעבודה', 'עבודה', 'למשרד', 'משרד', 'העבודה', 'המשרד'];
const WAZE_PACKAGE = 'com.waze';
const GMAPS_PACKAGE = 'com.google.android.apps.maps';

async function handleNavigate(intent: ParsedIntent): Promise<ActionResult> {
  if (!NavigationBridge) {
    return { success: false, message: 'מודול ניווט אינו זמין' };
  }

  const destination = intent.destination;
  if (!destination) {
    return { success: false, message: 'לא הבנתי לאן לנווט' };
  }

  const store = useDabriStore.getState();
  let resolvedDest = destination;
  let isHome = false;
  let isWork = false;

  // Resolve home/work keywords — use Dabri's stored address if available,
  // otherwise let the nav app resolve from its own saved favorites
  if (HOME_KEYWORDS.some(kw => destination === kw || destination.includes(kw))) {
    isHome = true;
    if (store.homeAddress) {
      resolvedDest = store.homeAddress;
    }
  } else if (WORK_KEYWORDS.some(kw => destination === kw || destination.includes(kw))) {
    isWork = true;
    if (store.workAddress) {
      resolvedDest = store.workAddress;
    }
  }

  // Determine preferred nav app (explicit request overrides store setting)
  let preferredApp: 'waze' | 'google_maps' = store.preferredNavApp;
  if (intent.navApp) {
    preferredApp = intent.navApp;
  }

  // Build fallback chain: preferred → other → generic geo
  const fallback: ('waze' | 'google_maps' | 'geo')[] =
    preferredApp === 'waze'
      ? ['waze', 'google_maps', 'geo']
      : ['google_maps', 'waze', 'geo'];

  for (const app of fallback) {
    try {
      if (app === 'waze') {
        const installed = await NavigationBridge.isAppInstalled(WAZE_PACKAGE);
        if (!installed) continue;
        // Waze favorite= resolves any saved favorite by name (home, work,
        // custom ones like "מכון כושר"). For addresses that aren't favorites,
        // Waze opens and the user can search — Google Maps fallback also works.
        const wazeFav = isHome ? 'home'
                      : isWork ? 'work'
                      : resolvedDest;
        await NavigationBridge.navigateWithWazeFavorite(wazeFav);
        return { success: true, message: `מנווט ל${resolvedDest} דרך Waze` };
      }

      if (app === 'google_maps') {
        const installed = await NavigationBridge.isAppInstalled(GMAPS_PACKAGE);
        if (!installed) continue;
        // Google Maps resolves "home"/"work" from its own saved places
        const gmapsDest = (isHome && !store.homeAddress) ? 'home'
                        : (isWork && !store.workAddress) ? 'work'
                        : resolvedDest;
        await NavigationBridge.navigateWithGoogleMaps(gmapsDest);
        return { success: true, message: `מנווט ל${resolvedDest} דרך Google Maps` };
      }

      if (app === 'geo') {
        await NavigationBridge.navigateWithGeo(resolvedDest);
        return { success: true, message: `מנווט ל${resolvedDest}` };
      }
    } catch (error) {
      console.log(`[Navigation] ${app} failed:`, error);
      continue;
    }
  }

  return { success: false, message: 'לא נמצאה אפליקציית ניווט במכשיר' };
}

export function registerNavigationHandlers(): void {
  registerHandler('NAVIGATE', handleNavigate);
}
