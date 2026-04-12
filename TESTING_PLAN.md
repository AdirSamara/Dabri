# Dabri Testing Strategy & Skill Creation Plan

## Context

Dabri is a Hebrew voice assistant React Native app (RN 0.85.0, TypeScript) that captures voice input, parses Hebrew commands into intents via regex + Gemini LLM fallback, dispatches actions (SMS, calls, WhatsApp, notifications, reminders, app launching), and responds via TTS. It has Kotlin native modules for SMS/phone/assistant/reminders.

**Key features since initial plan (32 commits)**:
- **Reminders system**: Full reminder CRUD with native Kotlin module, Hebrew time parsing ("בעוד 5 דקות", "מחר בשעה 8"), edit modal with date/time picker, reminders management screen
- **Contact disambiguation**: Multi-candidate contact resolution with word-level alignment, disambiguation UI with buttons + voice selection ("אפשרות 1"), auto-listen after TTS prompt
- **SMS viewer**: Two-screen modal (list + detail), navigation, read-aloud via TTS, RTL layout
- **Enhanced voice recognition**: Dual-timeout (15s hard cap + configurable silence 1-2s), error handling with zero-width space flags, auto-stop on silence
- **UI overhaul**: Contextual mic button (mic/stop icon), reminder cards in conversation log, disambiguation buttons, Google Assistant launch integration
- **Settings**: Silence timeout screen (1s/1.5s/2s), reminders management screen
- **Intent parser changes**: SET_REMINDER checked first (5 regex patterns), improved contact name boundary detection, תקריא/הקריא SMS verbs

**Current test state**: 1 basic render test (`__tests__/App.test.tsx`). No E2E framework. No test datasets. No mocks for native modules.

**Goal**: Comprehensive test coverage for the full voice-to-action pipeline, runnable on multiple Android emulators across modern API levels (30–36) and diverse device form factors, plus a Claude Code Skill to orchestrate testing.

---

## Phase 1: Test Infrastructure Setup

### 1.1 Install dependencies
```bash
npm install --save-dev @testing-library/react-native @testing-library/jest-native
```

### 1.2 Enhance `jest.config.js`
- Add `setupFilesAfterSetup: ['./jest.setup.js']`
- Add `moduleNameMapper` for all native modules (react-native-tts, react-native-contacts, @react-native-voice/voice, @react-native-async-storage/async-storage)
- Add `transformIgnorePatterns` for RN ecosystem packages
- Add `collectCoverageFrom` targeting `src/**/*.{ts,tsx}`

### 1.3 Create `jest.setup.js` (new file)
Global mocks for all NativeModules: SmsModule, PhoneModule, AssistantModule, NotificationBridge, ReminderBridge, Voice, TextToSpeech

### 1.4 Create `__mocks__/` directory
- `__mocks__/react-native-tts.js`
- `__mocks__/react-native-contacts.js`
- `__mocks__/@react-native-voice/voice.js`
- `__mocks__/@react-native-async-storage/async-storage.js`

### 1.5 Verify existing test passes with new config

---

## Phase 2: Unit Tests (Highest Priority)

### 2.1 Hebrew Intent Test Dataset — `__tests__/fixtures/hebrewIntentDataset.ts`
Typed fixture with 120+ labeled test cases mapping Hebrew utterances to expected intents/params. Covers:
- All intent types with multiple phrasings each
- Feminine/masculine verb forms
- WhatsApp alternate spellings (וואטסאפ, ווצאפ, ווטסאפ)
- Leading "ש" conjunction stripping, trailing platform keyword stripping
- **SET_REMINDER cases**: All 5 patterns (A-E) including "תזכיר לי", "רשום לי תזכורת", "אל תתן לי לשכוח", "תתריע לי" — with various Hebrew time expressions ("בעוד 5 דקות", "מחר בשעה 8", "בשישי בערב")
- **Disambiguation input**: "אפשרות 1", "אפשרות שתיים", partial name matches
- **SMS read verbs**: תקריא, הקריא alongside existing patterns
- Edge cases: empty strings, punctuation, single-letter contacts, multi-word contact names

### 2.2 `__tests__/services/intentParser.test.ts` (~110 test cases)
**Most critical file.** Tests `parseIntentWithRegex` via the public `parseIntent(text, '')` (empty API key forces regex-only path).

Key areas:
- **LIST_REMINDERS** (3+ cases): Checked first — "הראה תזכורות", "מה התזכורות שלי", "תזכורות"
- **SET_REMINDER** (20+ cases): **Checked second (before messaging/call intents) to prevent hijacking.** 5 regex patterns:
  - Pattern A: "תזכיר לי [time] ל/ש[text]"
  - Pattern B: "תזכיר לי [text] [time]"
  - Pattern C: "רשום לי תזכורת [time] ל/ש[text]"
  - Pattern D: "אל תתן לי לשכוח [text] [time]"
  - Pattern E: "תתריע לי [time] ש/ל/על[text]"
  - Test cases must verify SET_REMINDER wins over SEND_SMS/SEND_WHATSAPP when text contains "הודעה" or contact-like strings
  - Test "בעוד דקה" shorthand and compound time expressions
- **SEND_WHATSAPP** (25+ cases): 3 regex patterns — Pattern A (verb + optional noun/platform + contact + message), Pattern B (infinitive), Pattern C (implicit messaging verbs like תרשום/תגיד)
- **SEND_SMS** (5+ cases): explicit "שלח הודעה ל..." + new verbs תקריא/הקריא
- **MAKE_CALL** (14 cases): all verb forms (תתקשר/תחייג/חייג/להתקשר...) + אל vs ל prepositions + punctuation stripping
- **READ_SMS** (8+ cases): including `smsCount()` helper — singular "הודעה האחרונה" returns count=1, plural returns count=5, new verbs תקריא/הקריא trigger TTS read-aloud
- **READ_WHATSAPP, READ_NOTIFICATIONS, OPEN_APP**: 3-4 cases each
- **UNKNOWN**: unrecognized input, empty strings
- **Intent priority tests**: Verify LIST_REMINDERS → SET_REMINDER → SEND_WHATSAPP → SEND_SMS → ... order
- **Gemini mock tests**: mock `GoogleGenerativeAI` — valid JSON, invalid JSON, unknown intent, network error. Verify response includes `source: 'gemini'`
- **Orchestrator tests**: regex success skips Gemini (source='regex'); regex UNKNOWN + API key calls Gemini (source='gemini'); no API key returns UNKNOWN

**Notable finding**: WhatsApp Pattern A intercepts "שלח הודעה ל..." before SMS, meaning ALL "שלח הודעה ל..." commands route to SEND_WHATSAPP. This appears intentional per the code comment. Tests should document this behavior explicitly.

### 2.2b `__tests__/services/hebrewTimeParser.test.ts` (~30 test cases) — **NEW**
Tests `parseHebrewTime()` — critical for SET_REMINDER accuracy.

Key areas:
- **Relative times**: "בעוד 5 דקות", "בעוד שעה", "בעוד שעתיים", "בעוד חצי שעה"
- **Hebrew number words**: "בעוד עשרים וחמש דקות" → 25 min, "בעוד שלוש שעות" → 3h
- **Absolute times**: "מחר בשעה 8", "היום בצהריים", "בערב", "בלילה"
- **Day names**: "בשישי בערב", "ביום ראשון"
- **Smart AM/PM**: Bare numbers 1-6 assumed PM unless morning context ("בבוקר")
- **Special phrases**: "בקרוב", "עוד קצת", "שעתיים", "בעוד דקה"
- **Edge cases**: Past times roll to next day, invalid input returns null
- **Compound expressions**: "מחר בשעה 14:30"

### 2.3 `__tests__/utils/hebrewUtils.test.ts` (~23 test cases)
- `stripNiqqud`: niqqud marks, cantillation marks, sin/shin dots, empty string
- `normalizeHebrew`: whitespace collapsing, case folding, niqqud + spaces combo
- `levenshteinDistance`: identical strings (0), one insertion (1), empty vs non-empty, Hebrew names with typos
- `generateId`: returns string, uniqueness across calls

### 2.4 `__tests__/services/contactResolver.test.ts` (~28 test cases)
Mock `react-native-contacts`, `PermissionsAndroid`, and `useDabriStore.getState()`. Call `invalidateContactCache()` in beforeEach.

**5-tier scoring system tests (score descending):**
- **EXACT** (score=5, highest): Full displayName match, exact match with niqqud normalization
- **ALIAS** (score=4): User-defined alias from `contactAliases` store
- **PREFIX** (score=3): "יוסי" matches "יוסי כהן"
- **WORD** (score=2): Any word in name matches (fuzzy word-level matching)
- **FUZZY** (score=1, lowest): Full-name Levenshtein distance <=2, miss (distance >2)

**Contact alignment tests — `resolveContactWithAlignment()`** (~8 cases):
- Expands contact names by consuming words from message text (up to 4 words)
- Returns `correctedMessage` with consumed words stripped
- Strips leading ש-conjunction from corrected message via `stripLeadingShinConjunction()`
- Multi-word name: "יוסי כהן" consumed from "שלח ליוסי כהן שלום" → correctedMessage="שלום"

**Disambiguation tests — `resolveContactCandidates()`** (~6 cases):
- Returns up to 3 matches at the best tier
- Single match returns 1 candidate (no disambiguation needed)
- Multiple matches at same tier returns all (up to 3) for user selection
- No match returns empty array

**Edge cases:**
- Permission denied → null
- Empty contacts → null

### 2.5 `__tests__/services/actionDispatcher.test.ts` (~6 test cases)
- Registered handler called with correct intent
- Unregistered intent returns Hebrew error
- Handler error caught and wrapped
- Handler throws non-Error -> generic error message

### 2.6 Service tests
- `__tests__/services/smsService.test.ts` (~20 cases): read/send flows, SmsBridge null, permission denied, empty inbox, message truncation (80 char TTS limit), **disambiguation flow** (returns `allCandidates` when multiple contacts match), `resolveContactWithAlignment()` integration for name expansion during send, TTS read-aloud of message bodies
- `__tests__/services/callService.test.ts` (~8 cases): missing contact, not found, permission denied, PhoneModule null, success, **disambiguation flow** (multiple candidates returned)
- `__tests__/services/whatsappService.test.ts` (~10 cases): phone formatting (050→972), WhatsApp not installed, READ_WHATSAPP stub, `resolveContactWithAlignment()` integration, multi-word contact name boundary detection
- `__tests__/services/reminderService.test.ts` (~15 cases) — **NEW**: reminder creation with parsed time, permissions (notification + exact alarm), native ReminderBridge scheduling, listing active/completed reminders, `formatHebrewTimeDescription()` (relative for <24h, full date for longer), deletion, edit/reschedule flow

### 2.7 `__tests__/store/index.test.ts` (~14 test cases)
Zustand store: initial state, setters, addConversation prepend + max cap, updateConversation merge, partialize persistence fields.
**New state tests:**
- `pendingDisambiguation`: set/clear, session-only (not persisted)
- `silenceTimeout`: get/set, persisted, default 1000ms
- `contactAliases`: get/set/update, persisted
- `reminders`: add/update/remove, persisted

---

## Phase 3: Component Tests

Using `@testing-library/react-native`:

- `__tests__/components/MicButton.test.tsx` (~6 cases): renders per VoiceStatus, correct colors (red=listening, green=speaking), onPress fires, **stop icon replaces mic icon in speaking mode**, pulse animation active during listening/speaking, scales correctly (1.2x listening, 1.15x speaking)
- `__tests__/components/StatusIndicator.test.tsx` (~4 cases): Hebrew status text per status, transcript display
- `__tests__/components/ConversationLog.test.tsx` (~14 cases): empty state text, intent labels, **Gemini badge when `source === 'gemini'`**, status dot colors (green/red/orange for success/error/pending), relative time helper, **disambiguation buttons render with candidate contacts**, **`onDisambiguate` callback fires with selected contact**, **ReminderListCard embedded for reminder-listing entries**, **SMS viewer hint "לחץ לצפייה מלאה"**, inverted list (newest first)
- `__tests__/components/VoiceOverlay.test.tsx` (~6 cases): modal visibility, status text, transcript, close callback
- `__tests__/components/ReminderEditModal.test.tsx` (~8 cases) — **NEW**: renders with reminder data, text editing, date/time picker triggers, change detection (Save disabled when unchanged), Save callback with updated data, Delete callback, close/dismiss
- `__tests__/components/ReminderListCard.test.tsx` (~6 cases) — **NEW**: renders up to 5 active reminders sorted by trigger time, Hebrew pluralization ("תזכורת אחת פעילה" vs "X תזכורות פעילות"), edit/delete button callbacks, empty state
- `__tests__/components/SmsViewerModal.test.tsx` (~10 cases) — **NEW**: list view with sender avatars and previews, detail view with full message, navigation arrows (RTL-correct direction), read-aloud button, pagination between messages, modal open/close, timestamp formatting

### Screen Tests — **NEW**

- `__tests__/screens/RemindersScreen.test.tsx` (~8 cases): renders all reminders sorted (active first by time, then completed), status badges (Active/Completed), edit opens ReminderEditModal, delete removes reminder, "Clear completed" button, native alarm rescheduling on edit
- `__tests__/screens/SilenceTimeoutSettingsScreen.test.tsx` (~5 cases): renders 3 options (1s/1.5s/2s), shows checkmark on current selection, sublabels displayed, selection persists to store
- `__tests__/screens/HomeScreen.test.tsx` (~12 cases): **disambiguation flow** — `matchDisambiguationChoice()` parses number words + name matching, disambiguation buttons render and trigger correctly, auto-listen after disambiguation TTS prompt; **SMS viewer** opens on SMS entry click; **reminder edit modal** opens from conversation; **Google Assistant launch** detection via `AssistantBridge.wasLaunchedFromAssist()`; **error handling** — zero-width space prefix in voice results skips intent parsing

### Hook Tests — **NEW**

- `__tests__/hooks/useVoiceRecognition.test.ts` (~10 cases): starts/stops voice recognition, **15s hard cap timeout**, **configurable silence timeout** (resets on partial result), error handling (language not installed vs module unavailable), **zero-width space prefix on errors**, cleanup on unmount

---

## Phase 4: E2E Tests with Maestro

### Why Maestro over Detox
- Dabri is Android-focused; Detox's cross-platform advantage irrelevant
- YAML-based flows — no compilation step, faster iteration
- Maestro Cloud provides multi-device/multi-API testing out of the box
- Simpler STT bypass via `inputText` + `runScript`
- Less Gradle config overhead than Detox

### STT Bypass Strategy
Add a `__DEV__`-only `TextInput` with `testID="debug-voice-input"` in HomeScreen that calls `handleVoiceResult` directly. This lets Maestro inject text into the full parser->dispatcher->service pipeline without needing real audio.

### Maestro Structure
```
e2e/maestro/
  flows/
    01-app-launch.yaml              # Verify app starts, title "דברי", greeting "שלום!"
    02-voice-overlay.yaml           # Open/close overlay, status transitions
    03-sms-send-flow.yaml           # Inject "שלח הודעה ל..." via debug input
    04-sms-read-flow.yaml           # Inject "תקריא הודעות" — verify SMS viewer opens
    05-sms-viewer-navigation.yaml   # SMS list → detail view, navigation arrows, read aloud
    06-call-flow.yaml               # Inject "תתקשר ל..."
    07-reminder-create-flow.yaml    # Inject "תזכיר לי בעוד 5 דקות לצלצל" — verify reminder card
    08-reminder-edit-flow.yaml      # Open reminder edit modal, change text/time, save
    09-reminder-management.yaml     # Navigate to RemindersScreen, verify list, delete, clear completed
    10-disambiguation-flow.yaml     # Inject ambiguous contact name, verify buttons appear, tap selection
    11-settings-navigation.yaml     # Navigate all settings screens including silence timeout + reminders
    12-api-key-settings.yaml        # Enter/save Gemini API key
    13-dark-mode-toggle.yaml        # Toggle dark mode, verify theme change
    14-silence-timeout-setting.yaml # Navigate to silence timeout, select 2s, verify checkmark
    15-permission-handling.yaml     # Permission dialogs
    16-error-states.yaml            # Unknown intent, missing contact, zero-width space error
    17-mic-button-states.yaml       # Verify mic icon → stop icon transition during speaking
  config.yaml
```

### TestIDs to Add
- `HomeScreen.tsx`: `mic-button`, `settings-button`, `debug-voice-input` (dev only)
- `VoiceOverlay.tsx`: `voice-overlay`, `overlay-close`, `overlay-mic`
- `SettingsScreen.tsx`: testIDs on each row (including silence timeout, reminders management)
- `SmsViewerModal.tsx`: `sms-list`, `sms-detail`, `sms-nav-prev`, `sms-nav-next`, `sms-read-aloud`
- `ReminderEditModal.tsx`: `reminder-edit-text`, `reminder-edit-date`, `reminder-edit-time`, `reminder-save`, `reminder-delete`
- `ReminderListCard.tsx`: `reminder-card`, `reminder-edit-btn`, `reminder-delete-btn`
- `ConversationLog.tsx`: `disambiguation-btn-{index}`, `sms-entry`
- `RemindersScreen.tsx`: `reminder-item-{id}`, `clear-completed-btn`

---

## Phase 5: Multi-Emulator / Multi-Version / Multi-Device

### Target Android Versions (focused on modern APIs)

Note: minSdk=24 (Android 7), targetSdk=36 (Android 16). We test from API 30+ to cover modern permission/storage changes.

| API | Android | Device         | Screen     | Why                                                                    |
|-----|---------|----------------|------------|------------------------------------------------------------------------|
| 30  | 11      | Pixel 4 (5.7") | 1080×2280  | Baseline — scoped storage, package visibility                          |
| 33  | 13      | Pixel 6 (6.4") | 1080×2400  | Notification permission (`POST_NOTIFICATIONS`), exact alarm changes    |
| 34  | 14      | Pixel 7 (6.3") | 1080×2400  | Foreground service type enforcement                                    |
| 35  | 15      | Pixel 8 (6.2") | 1080×2400  | 16KB page support, new permission model changes                        |
| 36  | 16      | Pixel 9 (6.3") | 1080×2424  | **targetSdk** — must verify full compliance, new privacy sandbox, live updates API |

### Device Form Factor & OEM Coverage

**Why mostly Pixels in emulators?** Android emulators (AVD) only ship official Google system images — Samsung, Xiaomi, etc. don't provide emulator images. For non-Pixel OEMs you need **real devices** or cloud device farms (Firebase Test Lab, BrowserStack, AWS Device Farm).

**Emulator testing (Pixel AVDs — what we can automate for free):**

| Device     | Screen Size          | Density | Why                                                           |
|------------|----------------------|---------|---------------------------------------------------------------|
| Pixel 4    | 5.7" (1080×2280)     | 440dpi  | Smaller screen — verify RTL layout, SMS viewer fits           |
| Pixel 6    | 6.4" (1080×2400)     | 411dpi  | Standard modern size                                          |
| Pixel 7 Pro| 6.7" (1440×3120)     | 512dpi  | Large/high-density — reminder cards, disambiguation buttons   |
| Pixel Fold | 7.6" unfolded        | ~380dpi | Foldable/tablet layout — modals and overlays adapt            |

**Real device / cloud farm testing (Samsung + others — for release validation):**

| Device              | OEM     | Android | Why                                                            |
|---------------------|---------|---------|----------------------------------------------------------------|
| Galaxy S24          | Samsung | 14+     | Samsung One UI — custom notification handling, edge panels      |
| Galaxy A14          | Samsung | 13      | Budget device — lower RAM/CPU, important for real-world perf    |
| Xiaomi Redmi Note 13| Xiaomi  | 14      | MIUI — aggressive battery optimization can kill background alarms/reminders |
| OnePlus 12          | OnePlus | 14      | OxygenOS — different permissions UI, may affect user flow       |

**How to test on real devices for free:**
- **Firebase Test Lab**: 5 physical devices/day + 10 virtual devices/day on free Spark plan. Supports Maestro via `gcloud firebase test android run`
- **Manual**: Personal devices + team devices — good for Samsung One UI validation
- **BrowserStack/Sauce Labs**: Free tier for open-source projects

**OEM-specific things to watch:**
- Samsung One UI: Custom notification channels, split-screen mode, edge panels may interfere with overlays
- Xiaomi MIUI: Aggressive battery optimization kills background reminder alarms — user must whitelist app
- Huawei EMUI: No Google Play Services — Gemini SDK won't work (consider graceful fallback)
- OnePlus OxygenOS: Permission dialogs look different — E2E flows may need OEM-specific selectors

### The UI-vs-Native Verification Gap

**Problem**: Maestro tests verify what the UI shows, not what the OS actually did. Example:

```
User says: "תזכיר לי בעוד 5 דקות לצלצל"
UI shows:  "בסדר, אזכיר לך לצלצל בעוד 5 דקות" ← Maestro sees this ✅
Native:    AlarmManager.setExactAndAllowWhileIdle() ← silently blocked on new API ❌
Result:    Test passes, reminder never fires. Bug shipped.
```

This affects all native side effects: alarms, SMS sending, call initiation, notifications.

**Solution: 3 verification strategies applied to EVERY native feature**

### Strategy A: ADB State Verification (fast, runs on every PR)

After each Maestro flow, run ADB shell commands to verify the OS actually did the thing.

#### Reminders — Alarm Scheduling

```yaml
# checks/verify-alarm-scheduled.yaml
# Call after: 07-reminder-create-flow.yaml
- evalScript: |
    const output = maestro.shell("adb shell dumpsys alarm | grep com.dabri")
    if (!output.includes("ReminderAlarmReceiver")) {
      throw new Error("No alarm registered for Dabri after reminder creation")
    }
```

```yaml
# checks/verify-alarm-cancelled.yaml
# Call after: reminder delete action
- evalScript: |
    const before = maestro.shell("adb shell dumpsys alarm | grep -c ReminderAlarmReceiver")
    // after cancel, count should decrease by 1
```

```yaml
# checks/verify-notification-channel.yaml
# Call after: app launch
- evalScript: |
    const output = maestro.shell("adb shell dumpsys notification | grep dabri_reminders")
    if (!output.includes("importance=4")) {  // 4 = IMPORTANCE_HIGH
      throw new Error("Reminder notification channel missing or wrong importance")
    }
```

#### SMS — Message Actually Sent

```yaml
# checks/verify-sms-sent.yaml
# Call after: 03-sms-send-flow.yaml
- evalScript: |
    const output = maestro.shell(
      "adb shell content query --uri content://sms/sent --projection body,address --sort 'date DESC LIMIT 1'"
    )
    if (!output.includes("test_message_text")) {
      throw new Error("SMS not found in device sent box after send action")
    }
```

```yaml
# checks/verify-sms-read.yaml
# Call after: 04-sms-read-flow.yaml
# Verify inbox was actually queried (check logcat for SmsBridge calls)
- evalScript: |
    const output = maestro.shell("adb logcat -d -s ReactNativeJS | grep 'readInbox'")
    // Presence of log line confirms native bridge was called
```

#### Phone Call — Call Actually Initiated

```yaml
# checks/verify-call-initiated.yaml
# Call after: 06-call-flow.yaml
- evalScript: |
    // Check the call log for a recent outgoing call
    const output = maestro.shell(
      "adb shell content query --uri content://call_log/calls --projection number,type,date --where \"type=2\" --sort 'date DESC LIMIT 1'"
    )
    // type=2 is OUTGOING. Verify number matches expected contact
    if (!output.includes("number=")) {
      throw new Error("No outgoing call found in call log after MAKE_CALL action")
    }
```

Note: On emulators, `ACTION_CALL` opens the dialer but doesn't connect to a real network. The call log entry still gets created, which is what we verify.

#### WhatsApp — Intent Actually Fired

```yaml
# checks/verify-whatsapp-intent.yaml
# Call after: WhatsApp send flow
- evalScript: |
    // WhatsApp uses Linking.openURL('whatsapp://send?phone=...&text=...')
    // If WhatsApp is not installed, the intent fails.
    // On emulator: verify the intent was fired via logcat
    const output = maestro.shell(
      "adb logcat -d -s ActivityManager | grep 'whatsapp://send'"
    )
    // If WhatsApp IS installed on emulator, verify WhatsApp opened:
    const foreground = maestro.shell("adb shell dumpsys activity activities | grep mResumedActivity")
    // Should contain 'com.whatsapp' if it opened, or error handled gracefully if not installed
```

#### Permissions — Actually Granted by OS

```yaml
# checks/verify-permissions.yaml
# Run on API 33+ after permission grant flows
- evalScript: |
    const perms = maestro.shell("adb shell dumpsys package com.dabri | grep -A 20 'granted permissions'")
    
    const checks = {
      "READ_CONTACTS": perms.includes("android.permission.READ_CONTACTS"),
      "SEND_SMS": perms.includes("android.permission.SEND_SMS"),
      "READ_SMS": perms.includes("android.permission.READ_SMS"),
      "CALL_PHONE": perms.includes("android.permission.CALL_PHONE"),
      "POST_NOTIFICATIONS": perms.includes("android.permission.POST_NOTIFICATIONS"),
    }
    
    const missing = Object.entries(checks).filter(([k,v]) => !v).map(([k]) => k)
    if (missing.length > 0) {
      throw new Error("Permissions NOT granted by OS: " + missing.join(", "))
    }
```

```yaml
# checks/verify-exact-alarm-permission.yaml
# Run on API 31+ after alarm permission flow
- evalScript: |
    const output = maestro.shell("adb shell appops get com.dabri SCHEDULE_EXACT_ALARM")
    if (output.includes("deny") || output.includes("default")) {
      throw new Error("SCHEDULE_EXACT_ALARM not granted — reminders will use inexact alarms")
    }
```

#### Reminder SharedPreferences — Boot Recovery Data

```yaml
# checks/verify-reminder-persisted.yaml
# Call after: reminder creation — verifies boot recovery will work
- evalScript: |
    const output = maestro.shell(
      "adb shell run-as com.dabri cat /data/data/com.dabri/shared_prefs/dabri_reminders.xml"
    )
    if (!output.includes("reminder_")) {
      throw new Error("Reminder not persisted to SharedPreferences — will be lost on reboot")
    }
```

**Full ADB verification command reference:**

| Feature | ADB Command | What to Assert |
|---------|-------------|----------------|
| Alarm exists | `dumpsys alarm \| grep com.dabri` | `ReminderAlarmReceiver` PendingIntent present |
| Alarm cancelled | `dumpsys alarm \| grep -c ReminderAlarmReceiver` | Count decreased after cancel |
| Notification channel | `dumpsys notification \| grep dabri_reminders` | `importance=4` (HIGH) |
| SMS sent | `content query --uri content://sms/sent --sort 'date DESC LIMIT 1'` | Message body + number match |
| SMS inbox read | `logcat -d -s ReactNativeJS \| grep readInbox` | Bridge method was called |
| Call initiated | `content query --uri content://call_log/calls --where "type=2" --sort 'date DESC LIMIT 1'` | Outgoing call entry with correct number |
| WhatsApp intent | `logcat -d -s ActivityManager \| grep whatsapp://send` | Intent fired |
| Permissions granted | `dumpsys package com.dabri \| grep 'granted permissions'` | All required permissions listed |
| Exact alarm perm | `appops get com.dabri SCHEDULE_EXACT_ALARM` | `allow` |
| Reminder persisted | `run-as com.dabri cat shared_prefs/dabri_reminders.xml` | `reminder_` entries exist |
| Contact access | `logcat -d -s ReactNativeJS \| grep 'Contacts.getAll'` | Bridge called after permission grant |

---

### Strategy B: Dev-Mode Health Endpoint (detailed debugging)

Add `__DEV__`-only `getDebugState()` to each native module. Maestro queries this via a hidden debug panel to verify internal state without ADB.

```kotlin
// ReminderModule.kt
@ReactMethod
fun getDebugState(promise: Promise) {
    if (!BuildConfig.DEBUG) { promise.resolve(null); return }
    val map = Arguments.createMap()
    val alarms = ReminderScheduler.getAllReminders(reactContext)
    map.putInt("scheduledAlarmCount", alarms.size)
    val alarmMgr = reactContext.getSystemService(AlarmManager::class.java)
    map.putBoolean("canScheduleExact",
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) alarmMgr?.canScheduleExactAlarms() ?: false else true)
    val nm = reactContext.getSystemService(NotificationManager::class.java)
    map.putBoolean("channelExists", nm?.getNotificationChannel("dabri_reminders") != null)
    promise.resolve(map)
}
```

```kotlin
// SmsModule.kt
@ReactMethod
fun getDebugState(promise: Promise) {
    if (!BuildConfig.DEBUG) { promise.resolve(null); return }
    val map = Arguments.createMap()
    val cursor = reactContext.contentResolver.query(
        android.provider.Telephony.Sms.Sent.CONTENT_URI,
        arrayOf("_id"), null, null, "date DESC LIMIT 1")
    map.putBoolean("hasSentSms", cursor != null && cursor.count > 0)
    cursor?.close()
    map.putBoolean("hasSmsPermission",
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.SEND_SMS)
            == PackageManager.PERMISSION_GRANTED)
    promise.resolve(map)
}
```

```kotlin
// PhoneModule.kt
@ReactMethod
fun getDebugState(promise: Promise) {
    if (!BuildConfig.DEBUG) { promise.resolve(null); return }
    val map = Arguments.createMap()
    map.putBoolean("hasCallPermission",
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CALL_PHONE)
            == PackageManager.PERMISSION_GRANTED)
    // Check last outgoing call from call log
    val cursor = reactContext.contentResolver.query(
        android.provider.CallLog.Calls.CONTENT_URI,
        arrayOf("number", "date"), "type=2", null, "date DESC LIMIT 1")
    map.putBoolean("hasRecentOutgoingCall", cursor != null && cursor.count > 0)
    cursor?.close()
    promise.resolve(map)
}
```

**Debug panel in HomeScreen** (`__DEV__` only):
Add a hidden `<Text testID="debug-state">` that displays JSON from all `getDebugState()` calls. Maestro reads it with `copyTextFrom` and parses it.

```yaml
# checks/verify-debug-state.yaml (reusable)
- copyTextFrom:
    id: "debug-state"
    variable: "state"
- evalScript: |
    const state = JSON.parse(state)
    // Now assert on any native state field:
    if (state.reminder.scheduledAlarmCount === 0) throw new Error("No alarms")
    if (!state.sms.hasSmsPermission) throw new Error("SMS permission lost")
    if (!state.reminder.channelExists) throw new Error("Notification channel gone")
```

---

### Strategy C: End-to-End Smoke Tests (prove it actually works)

These are slow (~20-30s each) but prove the full native pipeline fires. Run in CI Job 3 (full matrix) only.

#### Reminder: Set → Wait → Notification Appears

```yaml
# checks/smoke-reminder-fires.yaml
- inputText:
    id: "debug-voice-input"
    text: "תזכיר לי בעוד 15 שניות בדיקת מערכת"
- assertVisible: "אזכיר לך"
- wait: 20000
# Open notification shade and verify
- evalScript: |
    maestro.shell("adb shell cmd notification list | grep 'בדיקת מערכת'")
- evalScript: |
    const output = maestro.shell("adb shell dumpsys notification --noredact | grep 'בדיקת מערכת'")
    if (!output.includes("בדיקת מערכת")) {
      throw new Error("Reminder notification never appeared after 20s — alarm did not fire")
    }
```

#### Reminder: Snooze → Wait → Re-fires

```yaml
# checks/smoke-reminder-snooze.yaml
# After the notification from above appears:
- evalScript: |
    // Tap the snooze action on the notification
    maestro.shell("adb shell cmd notification snooze --duration 15000 'dabri_reminders'")
- wait: 20000
- evalScript: |
    const output = maestro.shell("adb shell dumpsys notification --noredact | grep 'בדיקת מערכת'")
    if (!output.includes("בדיקת מערכת")) {
      throw new Error("Snoozed reminder never re-appeared")
    }
```

#### SMS: Send → Verify in Sent Box

```yaml
# checks/smoke-sms-sent.yaml
# Use a test phone number that won't actually connect
- inputText:
    id: "debug-voice-input"
    text: "שלח הודעה ל05000000000 בדיקת שליחה"
- assertVisible: "ההודעה נשלחה"    # UI says success
- wait: 3000                        # Give SMS subsystem time
- evalScript: |
    const output = maestro.shell(
      "adb shell content query --uri content://sms/sent --projection body --sort 'date DESC LIMIT 1'"
    )
    if (!output.includes("בדיקת שליחה")) {
      throw new Error("SMS not found in OS sent box — sendSms() may have silently failed")
    }
```

#### Call: Dial → Verify Call Log Entry

```yaml
# checks/smoke-call-initiated.yaml
- inputText:
    id: "debug-voice-input"
    text: "תתקשר ל05000000000"
- wait: 3000
# On emulator the dialer opens but no real call happens — verify call log
- evalScript: |
    const output = maestro.shell(
      "adb shell content query --uri content://call_log/calls --projection number,type --where \"type=2\" --sort 'date DESC LIMIT 1'"
    )
    if (!output.includes("05000000000")) {
      throw new Error("No outgoing call log entry — directCall() may have been blocked")
    }
# Return to app
- evalScript: |
    maestro.shell("adb shell am start -n com.dabri/.MainActivity")
```

#### Boot Recovery: Reboot → Alarms Re-scheduled

```yaml
# checks/smoke-boot-recovery.yaml (local only — can't reboot in CI easily)
# 1. Create a reminder
- inputText:
    id: "debug-voice-input"
    text: "תזכיר לי בעוד שעה בדיקת ריבוט"
- assertVisible: "אזכיר לך"
# 2. Verify alarm exists
- evalScript: |
    const before = maestro.shell("adb shell dumpsys alarm | grep -c ReminderAlarmReceiver")
    if (parseInt(before.trim()) === 0) throw new Error("Alarm not set before reboot")
# 3. Simulate boot broadcast (without actual reboot)
- evalScript: |
    maestro.shell("adb shell am broadcast -a android.intent.action.BOOT_COMPLETED -n com.dabri/.reminder.ReminderBootReceiver")
# 4. Verify alarm re-registered
- evalScript: |
    const after = maestro.shell("adb shell dumpsys alarm | grep -c ReminderAlarmReceiver")
    if (parseInt(after.trim()) === 0) throw new Error("Alarm not re-scheduled after boot broadcast")
```

---

### Summary: What Each Strategy Catches

```
┌─────────────────────────┬───────────┬─────────────┬──────────────┐
│ Failure scenario        │ ADB check │ Health endpt │ Smoke test   │
├─────────────────────────┼───────────┼─────────────┼──────────────┤
│ Alarm silently blocked  │ ✅ fast    │ ✅ detailed  │ ✅ proof      │
│ SMS silently fails      │ ✅ sent box│ ✅ perm flag │ ✅ in sent box│
│ Call intent blocked     │ ✅ call log│ ✅ perm flag │ ✅ log entry  │
│ Permission revoked      │ ✅ dumpsys │ ✅ per-perm  │ ✅ flow fails │
│ Notif channel deleted   │ ✅ dumpsys │ ✅ flag      │ ✅ no notif   │
│ SharedPrefs corrupted   │ ✅ cat xml │ ✅ count     │ ✅ boot fails │
│ WhatsApp not installed  │ ✅ logcat  │ —           │ ✅ no open    │
│ Boot recovery broken    │ ✅ broadcast│ —           │ ✅ alarms gone│
├─────────────────────────┼───────────┼─────────────┼──────────────┤
│ Speed                   │ ~1s each  │ ~2s each    │ ~20-30s each │
│ When to run             │ Every PR  │ On failure  │ Main merge   │
└─────────────────────────┴───────────┴─────────────┴──────────────┘
```

**Recommended approach: Use all three.**
- Strategy A (ADB) for fast CI checks on every PR — catches 90% of issues
- Strategy B (health endpoint) for detailed debugging when a CI check fails
- Strategy C (smoke tests) on the full matrix run (Job 3, main merge) — the ultimate proof

---

### How Each Test Layer Covers Emulators

```
┌─────────────────────────────────────────────────────────────────────┐
│                    What runs WHERE                                   │
├──────────────────┬──────────────────────────────────────────────────┤
│ Unit Tests       │ Node.js on your machine (NO emulator)            │
│ (Jest)           │ Tests pure logic: regex, time parsing, scoring   │
│                  │ Same result on any machine. ~300 tests, ~2 min.  │
├──────────────────┼──────────────────────────────────────────────────┤
│ Core E2E Flows   │ Runs on EVERY emulator in the matrix             │
│ (Maestro 01-17)  │ Same flows, but behavior differs per API:        │
│                  │  - Permission dialogs appear/don't appear         │
│                  │  - Native bridges succeed/fail differently        │
│                  │  - UI layout may shift (edge-to-edge on 35+)     │
│                  │ A flow PASSING on API 34 but FAILING on API 36   │
│                  │ catches real version-specific bugs.               │
├──────────────────┼──────────────────────────────────────────────────┤
│ API-Specific     │ Conditional flows that ONLY run on target API     │
│ Flows            │ Test behaviors unique to that Android version     │
│ (Maestro api-*)  │ See structure below.                             │
├──────────────────┼──────────────────────────────────────────────────┤
│ Real Device /    │ Firebase Test Lab or manual                       │
│ OEM Tests        │ Samsung One UI, Xiaomi MIUI, etc.                │
│                  │ Catches OEM-specific issues emulators can't.      │
└──────────────────┴──────────────────────────────────────────────────┘
```

### API-Specific Maestro Flows

These flows test behaviors that **only exist on certain API levels**. They use Maestro's `runFlow` with conditions or are organized in per-API subdirectories:

```
e2e/maestro/
  flows/              # Core flows (01-17) — run on ALL emulators
  flows-api33/        # Only run on API 33+
    notification-permission.yaml   # Verify POST_NOTIFICATIONS dialog appears
    exact-alarm-permission.yaml    # Verify SCHEDULE_EXACT_ALARM prompt
  flows-api34/        # Only run on API 34+
    foreground-service.yaml        # Verify voice recognition doesn't crash
                                   # (foreground service type must be declared)
  flows-api35/        # Only run on API 35+
    edge-to-edge-layout.yaml       # Verify UI not clipped by system bars
  flows-api36/        # Only run on API 36 (targetSdk)
    predictive-back.yaml           # Verify back gesture doesn't break modals
    full-compliance-smoke.yaml     # All features end-to-end on target API
```

**How the multi-emulator script selects flows:**
```bash
# In scripts/test-multi-emulator.sh:
for EMU in "${EMULATORS[@]}"; do
  API_LEVEL=$(echo "$EMU" | grep -oP 'API_\K[0-9]+')
  
  # Core flows always run
  maestro test e2e/maestro/flows/
  
  # API-specific flows run conditionally
  [ "$API_LEVEL" -ge 33 ] && maestro test e2e/maestro/flows-api33/
  [ "$API_LEVEL" -ge 34 ] && maestro test e2e/maestro/flows-api34/
  [ "$API_LEVEL" -ge 35 ] && maestro test e2e/maestro/flows-api35/
  [ "$API_LEVEL" -ge 36 ] && maestro test e2e/maestro/flows-api36/
done
```

### Version-Specific Test Focus

| API | What changes on this version                  | How we verify it                                                  |
|-----|-----------------------------------------------|-------------------------------------------------------------------|
| 30  | Scoped storage, package visibility            | Core flows 03-06 — SMS/call/WhatsApp must still access contacts   |
| 33  | `POST_NOTIFICATIONS` runtime permission       | `flows-api33/notification-permission.yaml` — reminder creation triggers permission dialog, reminder still fires after grant |
| 33  | `SCHEDULE_EXACT_ALARM` restriction            | `flows-api33/exact-alarm-permission.yaml` — reminder scheduling requests exact alarm permission |
| 34  | Foreground service type enforcement           | `flows-api34/foreground-service.yaml` — voice recognition starts without crash |
| 35  | Edge-to-edge enforced                         | `flows-api35/edge-to-edge-layout.yaml` — UI elements not hidden behind system bars |
| 36  | Predictive back gesture                       | `flows-api36/predictive-back.yaml` — back gesture on modals (SMS viewer, reminder edit) dismisses correctly without app exit |
| 36  | Full targetSdk compliance                     | `flows-api36/full-compliance-smoke.yaml` — end-to-end smoke test of all major features |

### Local: Gradle Managed Devices
Add to `android/app/build.gradle` inside `android {}`:
- Define devices: Pixel 4/API 30, Pixel 6/API 33, Pixel 7/API 34, Pixel 8/API 35, Pixel 9/API 36
- Add large device: Pixel 7 Pro/API 34 for high-density testing
- Group them in `modernApiLevels`
- Run: `./gradlew modernApiLevelsGroupDebugAndroidTest`

### Local: Quick Multi-Emulator Script
Create `scripts/test-multi-emulator.sh`:
```bash
#!/bin/bash
# Launch multiple emulators and run Maestro flows on each
EMULATORS=("Pixel_4_API_30" "Pixel_6_API_33" "Pixel_7_API_34" "Pixel_8_API_35" "Pixel_9_API_36")

for EMU in "${EMULATORS[@]}"; do
  echo "=== Testing on $EMU ==="
  emulator -avd "$EMU" -no-window -no-audio &
  adb wait-for-device
  maestro test --device "$EMU" e2e/maestro/flows/
  adb emu kill
done
```

### CI: Maestro Cloud
```bash
maestro cloud \
  --app-file app-debug.apk \
  --device-locale he_IL \
  --flows e2e/maestro/flows/ \
  --android-api-level 30,33,34,35,36
```

### GitHub Actions CI Pipeline (`.github/workflows/test.yml`)

**Free tier: 2,000 min/month** (private repo) or **unlimited** (public repo), Linux runners only (1x rate).

#### Pipeline Architecture

```
Every PR:
┌──────────────────────┐   ┌──────────────────────────────────┐
│ Job 1: Unit Tests    │   │ Job 2: Gradle Build              │
│ npm test --coverage  │   │ Build debug APK + cache          │
│ ~3 min               │   │ ~10 min (cached ~6 min)          │
└──────────────────────┘   └───────────────┬──────────────────┘
                                           │ APK artifact
                           ┌───────────────▼──────────────────┐
                           │ Job 3: E2E (single emulator)     │
                           │ API 34 + 17 Maestro flows        │
                           │ + ADB native checks              │
                           │ ~12 min                          │
                           └──────────────────────────────────┘
Total per PR: ~25 min billed (~15 min wall-clock, Jobs 1+2 parallel)

Merge to main only:
┌──────────────────────────────────────────────────────────────┐
│ Job 4: Full Matrix (5 emulators in parallel)                 │
│ API 30, 33, 34, 35, 36 × (core + API-specific + smoke)      │
│ ~25 min per emulator, but parallel = ~25 min wall-clock      │
│ ~125 min billed                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Cost Estimate Per Month

| Scenario | PRs/month | Main merges | Minutes used | Of 2000 free | Status |
|----------|-----------|-------------|-------------|--------------|--------|
| Solo dev, steady pace | 12 | 4 | 12×25 + 4×125 = **800** | 40% | Comfortable |
| Active dev | 25 | 8 | 25×25 + 8×125 = **1625** | 81% | Fine |
| Heavy dev | 40 | 12 | 40×25 + 12×125 = **2500** | 125% | Over — see optimizations below |
| Public repo | Any | Any | **Unlimited** | N/A | Free always |

#### Optimizations to Stay Free

1. **Cache everything** — saves ~4 min per E2E job:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: |
         ~/.gradle/caches
         ~/.gradle/wrapper
         ~/.android/avd     # Emulator snapshot
       key: gradle-${{ hashFiles('**/*.gradle*') }}
   ```

2. **Skip E2E on docs/config-only changes** — don't burn 12 min when only README changed:
   ```yaml
   jobs:
     e2e:
       if: |
         !contains(github.event.head_commit.message, '[skip-e2e]') &&
         needs.changes.outputs.src == 'true'
   ```

3. **Move smoke tests (Strategy C) to main-merge only** — saves ~3 min per PR. ADB checks (Strategy A) are fast enough for every PR.

4. **If hitting the limit**: Drop Job 3 to 3 emulators (API 33, 34, 36) instead of 5. Saves 50 min per main merge. API 30 and 35 are less critical — 30 is old, 35 behavior is subset of 36.

#### Time Expectations

| What you're waiting for | Wall-clock time | How it feels |
|------------------------|-----------------|-------------|
| Push a PR, wait for green checkmark | **~15 min** | Grab coffee, come back, it's done |
| Merge to main, full matrix | **~25 min** | Fine — you only merge a few times a week |
| Unit tests only (quick feedback) | **~3 min** | Fast enough to wait |

**Is ~15 min good?** For a project with emulator E2E + native verification — yes. For comparison:
- React Native apps with Detox: 20-40 min typical
- Android apps with Espresso: 15-25 min typical
- Flutter apps: 10-20 min typical
- Just unit tests (no emulator): 2-5 min

The emulator boot (~3 min) and Gradle build (~6-10 min) are the bottlenecks. The actual test execution is fast.

#### Quick Escape Valves

- Add `[skip-e2e]` to commit message → only unit tests run (~3 min)
- Add `[skip-ci]` to commit message → nothing runs (for typo fixes, docs)
- `workflow_dispatch` → manually trigger full matrix anytime

---

## Phase 6: Claude Code Skill — `/test-dabri`

### File: `Dabri/.claude/commands/test-dabri.md`

A project-specific Claude Code slash command that orchestrates:

| Subcommand | What it does |
|------------|-------------|
| `generate <file>` | Generate unit tests for a specific source file |
| `generate all` | Generate all missing tests |
| `run` / `run unit` / `run coverage` | Run Jest tests |
| `run e2e` | Run Maestro flows |
| `dataset add "<utterance>" <INTENT>` | Add a labeled case to the Hebrew test dataset |
| `dataset validate` | Run all dataset entries against the parser |
| `dataset report` | Coverage per intent type |
| `mock native` | Generate/refresh native module mocks |
| `check` | Pre-flight: verify dependencies, config, mocks are all set up |

### Conventions the Skill enforces
- Test files mirror `src/` structure under `__tests__/`
- Mock files in `__mocks__/` at project root
- Hebrew intent dataset in `__tests__/fixtures/hebrewIntentDataset.ts`
- Native module mocks centralized in `jest.setup.js`
- Test descriptions in English, test data in Hebrew
- Components tested with `@testing-library/react-native`

---

## Verification Plan

1. **After Phase 1**: Run `npm test` — existing App.test.tsx still passes
2. **After Phase 2**: Run `npm test -- --coverage` — verify >80% coverage on `src/services/` and `src/utils/` (including new hebrewTimeParser, reminderService, contactResolver disambiguation)
3. **After Phase 3**: Coverage also includes `src/components/` (including new ReminderEditModal, ReminderListCard, SmsViewerModal) and `src/screens/` and `src/hooks/`
4. **After Phase 4**: Run `maestro test e2e/maestro/flows/` on a local emulator — all 17 flows green
5. **After Phase 5**: Run on API 30/33/34/35/36 × multiple device profiles — no version-specific or form-factor failures
6. **After Phase 6**: Run `/test-dabri check` — passes all pre-flight checks

---

## File Summary

| File | Action |
|------|--------|
| `jest.config.js` | Modify — add moduleNameMapper, transforms, coverage |
| `jest.setup.js` | Create — global native module mocks (including ReminderBridge) |
| `__mocks__/*.js` (4 files) | Create — library-level mocks |
| `__tests__/fixtures/hebrewIntentDataset.ts` | Create — 120+ labeled test cases |
| `__tests__/fixtures/mockContacts.ts` | Create — mock contact data (including multi-word names for disambiguation) |
| `__tests__/services/intentParser.test.ts` | Create — ~110 cases, intent parsing + SET_REMINDER priority |
| `__tests__/services/hebrewTimeParser.test.ts` | Create — ~30 cases, Hebrew time expression parsing |
| `__tests__/services/contactResolver.test.ts` | Create — ~28 cases, 5-tier scoring + alignment + disambiguation |
| `__tests__/services/actionDispatcher.test.ts` | Create — ~6 cases |
| `__tests__/services/smsService.test.ts` | Create — ~20 cases, including disambiguation flow |
| `__tests__/services/callService.test.ts` | Create — ~8 cases, including disambiguation flow |
| `__tests__/services/whatsappService.test.ts` | Create — ~10 cases, including contact alignment |
| `__tests__/services/reminderService.test.ts` | Create — ~15 cases, CRUD + scheduling + permissions |
| `__tests__/utils/hebrewUtils.test.ts` | Create |
| `__tests__/store/index.test.ts` | Create — ~14 cases, including new state (disambiguation, silenceTimeout, aliases) |
| `__tests__/components/MicButton.test.tsx` | Create — ~6 cases, dual-state visuals |
| `__tests__/components/StatusIndicator.test.tsx` | Create — ~4 cases |
| `__tests__/components/ConversationLog.test.tsx` | Create — ~14 cases, disambiguation buttons + reminder cards + SMS hint |
| `__tests__/components/VoiceOverlay.test.tsx` | Create — ~6 cases |
| `__tests__/components/ReminderEditModal.test.tsx` | Create — ~8 cases |
| `__tests__/components/ReminderListCard.test.tsx` | Create — ~6 cases |
| `__tests__/components/SmsViewerModal.test.tsx` | Create — ~10 cases |
| `__tests__/screens/HomeScreen.test.tsx` | Create — ~12 cases, disambiguation + SMS viewer + assistant launch |
| `__tests__/screens/RemindersScreen.test.tsx` | Create — ~8 cases |
| `__tests__/screens/SilenceTimeoutSettingsScreen.test.tsx` | Create — ~5 cases |
| `__tests__/hooks/useVoiceRecognition.test.ts` | Create — ~10 cases, dual-timeout + error handling |
| `src/screens/HomeScreen.tsx` | Modify — add `__DEV__` debug TextInput for E2E |
| `e2e/maestro/flows/*.yaml` (17 files) | Create — core Maestro E2E flows (run on all emulators) |
| `e2e/maestro/flows-api33/*.yaml` (2 files) | Create — notification + exact alarm permission flows |
| `e2e/maestro/flows-api34/*.yaml` (1 file) | Create — foreground service verification |
| `e2e/maestro/flows-api35/*.yaml` (1 file) | Create — edge-to-edge layout verification |
| `e2e/maestro/flows-api36/*.yaml` (2 files) | Create — predictive back + full compliance smoke |
| `e2e/maestro/checks/verify-alarm-scheduled.yaml` | Create — ADB: confirm alarm registered in OS |
| `e2e/maestro/checks/verify-alarm-cancelled.yaml` | Create — ADB: confirm alarm removed from OS |
| `e2e/maestro/checks/verify-notification-channel.yaml` | Create — ADB: confirm channel exists with IMPORTANCE_HIGH |
| `e2e/maestro/checks/verify-sms-sent.yaml` | Create — ADB: confirm message in content://sms/sent |
| `e2e/maestro/checks/verify-sms-read.yaml` | Create — ADB: confirm readInbox bridge call in logcat |
| `e2e/maestro/checks/verify-call-initiated.yaml` | Create — ADB: confirm outgoing entry in call log |
| `e2e/maestro/checks/verify-whatsapp-intent.yaml` | Create — ADB: confirm whatsapp:// intent in logcat |
| `e2e/maestro/checks/verify-permissions.yaml` | Create — ADB: confirm all runtime permissions granted |
| `e2e/maestro/checks/verify-exact-alarm-permission.yaml` | Create — ADB: confirm SCHEDULE_EXACT_ALARM allowed |
| `e2e/maestro/checks/verify-reminder-persisted.yaml` | Create — ADB: confirm SharedPreferences has reminder entry |
| `e2e/maestro/checks/verify-debug-state.yaml` | Create — reads debug panel JSON, asserts native state |
| `e2e/maestro/checks/smoke-reminder-fires.yaml` | Create — 15s timer + verify notification appears |
| `e2e/maestro/checks/smoke-reminder-snooze.yaml` | Create — snooze + verify re-fires |
| `e2e/maestro/checks/smoke-sms-sent.yaml` | Create — send + verify in OS sent box |
| `e2e/maestro/checks/smoke-call-initiated.yaml` | Create — call + verify call log entry |
| `e2e/maestro/checks/smoke-boot-recovery.yaml` | Create — broadcast BOOT_COMPLETED + verify alarms re-scheduled |
| `e2e/maestro/config.yaml` | Create |
| `ReminderModule.kt` | Modify — add `getDebugState()` (DEBUG-only) |
| `SmsModule.kt` | Modify — add `getDebugState()` (DEBUG-only) |
| `PhoneModule.kt` | Modify — add `getDebugState()` (DEBUG-only) |
| `src/screens/HomeScreen.tsx` | Modify — add `__DEV__` debug state panel for health endpoint |
| `scripts/test-multi-emulator.sh` | Create — local multi-emulator test runner |
| `android/app/build.gradle` | Modify — add Gradle Managed Devices (API 30/33/34/35/36) |
| `.github/workflows/test.yml` | Create — CI pipeline (unit + E2E + form-factor matrix) |
| `.claude/commands/test-dabri.md` | Create — Claude Code Skill |
| `package.json` | Modify — add test:coverage, test:e2e scripts |
