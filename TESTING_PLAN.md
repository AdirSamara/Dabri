# Dabri Testing Strategy & Skill Creation Plan

## Context

Dabri is a Hebrew voice assistant React Native app (RN 0.85.0, TypeScript) that captures voice input, parses Hebrew commands into 9 intent types via regex + Gemini LLM fallback, dispatches actions (SMS, calls, WhatsApp, notifications, reminders, app launching), and responds via TTS. It has Kotlin native modules for SMS/phone/assistant.

**Current test state**: 1 basic render test (`__tests__/App.test.tsx`). No E2E framework. No test datasets. No mocks for native modules.

**Goal**: Comprehensive test coverage for the full voice-to-action pipeline, runnable on multiple Android emulators (API 28, 30, 33, 34), plus a Claude Code Skill to orchestrate testing.

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
Global mocks for all NativeModules: SmsModule, PhoneModule, AssistantModule, NotificationBridge, Voice, TextToSpeech

### 1.4 Create `__mocks__/` directory
- `__mocks__/react-native-tts.js`
- `__mocks__/react-native-contacts.js`
- `__mocks__/@react-native-voice/voice.js`
- `__mocks__/@react-native-async-storage/async-storage.js`

### 1.5 Verify existing test passes with new config

---

## Phase 2: Unit Tests (Highest Priority)

### 2.1 Hebrew Intent Test Dataset — `__tests__/fixtures/hebrewIntentDataset.ts`
Typed fixture with 100+ labeled test cases mapping Hebrew utterances to expected intents/params. Covers:
- All 9 intent types with multiple phrasings each
- Feminine/masculine verb forms
- WhatsApp alternate spellings (וואטסאפ, ווצאפ, ווטסאפ)
- Leading "ש" conjunction stripping, trailing platform keyword stripping
- Edge cases: empty strings, punctuation, single-letter contacts

### 2.2 `__tests__/services/intentParser.test.ts` (~83 test cases)
**Most critical file.** Tests `parseIntentWithRegex` via the public `parseIntent(text, '')` (empty API key forces regex-only path).

Key areas:
- **SEND_WHATSAPP** (25+ cases): 3 regex patterns — Pattern A (verb + optional noun/platform + contact + message), Pattern B (infinitive), Pattern C (implicit messaging verbs like תרשום/תגיד)
- **SEND_SMS** (3 cases): explicit "שלח הודעה ל..."
- **MAKE_CALL** (14 cases): all verb forms (תתקשר/תחייג/חייג/להתקשר...) + אל vs ל prepositions + punctuation stripping
- **READ_SMS** (6 cases): including `smsCount()` helper — singular "הודעה האחרונה" returns count=1, plural returns count=5
- **READ_WHATSAPP, READ_NOTIFICATIONS, OPEN_APP, SET_REMINDER**: 3-4 cases each
- **UNKNOWN**: unrecognized input, empty strings
- **Gemini mock tests**: mock `GoogleGenerativeAI` — valid JSON, invalid JSON, unknown intent, network error
- **Orchestrator tests**: regex success skips Gemini; regex UNKNOWN + API key calls Gemini; no API key returns UNKNOWN

**Notable finding**: WhatsApp Pattern A (line 45) intercepts "שלח הודעה ל..." before SMS (line 85), meaning ALL "שלח הודעה ל..." commands route to SEND_WHATSAPP. This appears intentional per the code comment on line 36. Tests should document this behavior explicitly.

### 2.3 `__tests__/utils/hebrewUtils.test.ts` (~23 test cases)
- `stripNiqqud`: niqqud marks, cantillation marks, sin/shin dots, empty string
- `normalizeHebrew`: whitespace collapsing, case folding, niqqud + spaces combo
- `levenshteinDistance`: identical strings (0), one insertion (1), empty vs non-empty, Hebrew names with typos
- `generateId`: returns string, uniqueness across calls

### 2.4 `__tests__/services/contactResolver.test.ts` (~12 test cases)
Mock `react-native-contacts`, `PermissionsAndroid`, and `useDabriStore.getState()`. Call `invalidateContactCache()` in beforeEach.
- Exact match, exact match with niqqud normalization
- Prefix match ("יוסי" matches "יוסי כהן")
- Levenshtein match (distance <=2), miss (distance >2)
- Alias resolution takes priority over exact match
- Permission denied -> null
- Empty contacts -> null

### 2.5 `__tests__/services/actionDispatcher.test.ts` (~6 test cases)
- Registered handler called with correct intent
- Unregistered intent returns Hebrew error
- Handler error caught and wrapped
- Handler throws non-Error -> generic error message

### 2.6 Service tests
- `__tests__/services/smsService.test.ts` (~14 cases): read/send flows, SmsBridge null, permission denied, empty inbox, message truncation
- `__tests__/services/callService.test.ts` (~5 cases): missing contact, not found, permission denied, PhoneModule null, success
- `__tests__/services/whatsappService.test.ts` (~8 cases): phone formatting (050→972), WhatsApp not installed, READ_WHATSAPP stub

### 2.7 `__tests__/store/index.test.ts` (~8 test cases)
Zustand store: initial state, setters, addConversation prepend + max cap, updateConversation merge, partialize persistence fields

---

## Phase 3: Component Tests

Using `@testing-library/react-native`:

- `__tests__/components/MicButton.test.tsx` (~4 cases): renders per VoiceStatus, correct colors, onPress fires
- `__tests__/components/StatusIndicator.test.tsx` (~4 cases): Hebrew status text per status, transcript display
- `__tests__/components/ConversationLog.test.tsx` (~6 cases): empty state text, intent labels, Gemini badge, status dot colors, relative time helper
- `__tests__/components/VoiceOverlay.test.tsx` (~6 cases): modal visibility, status text, transcript, close callback

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
    01-app-launch.yaml          # Verify app starts, title "דברי", greeting "שלום!"
    02-voice-overlay.yaml       # Open/close overlay, status transitions
    03-sms-flow.yaml            # Inject "שלח הודעה ל..." via debug input
    04-call-flow.yaml           # Inject "תתקשר ל..."
    05-settings-navigation.yaml # Navigate all settings screens
    06-api-key-settings.yaml    # Enter/save Gemini API key
    07-dark-mode-toggle.yaml    # Toggle dark mode, verify theme change
    08-permission-handling.yaml # Permission dialogs
    09-error-states.yaml        # Unknown intent, missing contact
  config.yaml
```

### TestIDs to Add
- `HomeScreen.tsx`: `mic-button`, `settings-button`, `debug-voice-input` (dev only)
- `VoiceOverlay.tsx`: `voice-overlay`, `overlay-close`, `overlay-mic`
- `SettingsScreen.tsx`: testIDs on each row

---

## Phase 5: Multi-Emulator / Multi-Version

### Target Android Versions
| API | Android | Why |
|-----|---------|-----|
| 28  | 9.0     | Near minSdk, older speech recognition |
| 30  | 11      | Scoped storage, package visibility |
| 33  | 13      | Notification permission (`POST_NOTIFICATIONS`) |
| 34  | 14      | Latest stable |

### Local: Gradle Managed Devices
Add to `android/app/build.gradle` inside `android {}`:
- Define 4 `localDevices` (Pixel 3/API 28, Pixel 4/API 30, Pixel 6/API 33, Pixel 7/API 34)
- Group them in `allApiLevels`
- Run: `./gradlew allApiLevelsGroupDebugAndroidTest`

### CI: Maestro Cloud
```bash
maestro cloud \
  --app-file app-debug.apk \
  --device-locale he_IL \
  --flows e2e/maestro/flows/ \
  --android-api-level 28,30,33,34
```

### GitHub Actions CI Pipeline (`.github/workflows/test.yml`)
- **Job 1**: Unit tests (`npm test -- --coverage`) — fast, runs on every push/PR
- **Job 2**: E2E tests — matrix strategy across API levels 28/30/33/34, uses `reactivecircus/android-emulator-runner@v2` + Maestro

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
2. **After Phase 2**: Run `npm test -- --coverage` — verify >80% coverage on `src/services/` and `src/utils/`
3. **After Phase 3**: Coverage also includes `src/components/`
4. **After Phase 4**: Run `maestro test e2e/maestro/flows/` on a local emulator — all flows green
5. **After Phase 5**: Run on 4 API levels — no version-specific failures
6. **After Phase 6**: Run `/test-dabri check` — passes all pre-flight checks

---

## File Summary

| File | Action |
|------|--------|
| `jest.config.js` | Modify — add moduleNameMapper, transforms, coverage |
| `jest.setup.js` | Create — global native module mocks |
| `__mocks__/*.js` (4 files) | Create — library-level mocks |
| `__tests__/fixtures/hebrewIntentDataset.ts` | Create — 100+ labeled test cases |
| `__tests__/fixtures/mockContacts.ts` | Create — mock contact data |
| `__tests__/services/*.test.ts` (6 files) | Create — intentParser, actionDispatcher, smsService, callService, whatsappService, contactResolver |
| `__tests__/utils/hebrewUtils.test.ts` | Create |
| `__tests__/store/index.test.ts` | Create |
| `__tests__/components/*.test.tsx` (4 files) | Create — MicButton, StatusIndicator, ConversationLog, VoiceOverlay |
| `src/screens/HomeScreen.tsx` | Modify — add `__DEV__` debug TextInput for E2E |
| `e2e/maestro/flows/*.yaml` (9 files) | Create — Maestro E2E flows |
| `e2e/maestro/config.yaml` | Create |
| `android/app/build.gradle` | Modify — add Gradle Managed Devices |
| `.github/workflows/test.yml` | Create — CI pipeline |
| `.claude/commands/test-dabri.md` | Create — Claude Code Skill |
| `package.json` | Modify — add test:coverage, test:e2e scripts |
