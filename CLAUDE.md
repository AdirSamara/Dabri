# Dabri Project Instructions

## Test Awareness Rule

**Whenever you modify source code in `src/`**, you MUST:

1. **Check if tests exist** for the modified file — look in `__tests__/` mirroring the `src/` structure (e.g., `src/services/intentParser.ts` → `__tests__/services/intentParser.test.ts`)
2. **If tests exist**: Review them against your changes. If any test would break or no longer cover the new behavior, update the test file accordingly.
3. **If tests don't exist yet**: Consider whether the change is significant enough to warrant a new test file. For non-trivial logic changes (new regex patterns, new service functions, new component behavior), create the test.
4. **If you add a new file** in `src/`: Create a corresponding test file unless it's purely a type definition or trivial re-export.

### What counts as "can break a test"
- Changed function signatures or return types
- Modified regex patterns in intentParser
- Changed scoring/matching logic in contactResolver
- New or modified Hebrew time parsing patterns
- Changed store state shape or defaults
- Modified component props or rendered output
- Changed service behavior (new error paths, different return values)
- Changed native bridge calls

### Test file conventions
- Test files mirror `src/` structure under `__tests__/`
- Mock files in `__mocks__/` at project root
- Hebrew intent dataset in `__tests__/fixtures/hebrewIntentDataset.ts`
- Native module mocks centralized in `jest.setup.js`
- Test descriptions in English, test data in Hebrew
- Components tested with `@testing-library/react-native`

## Project Context

- Hebrew voice assistant React Native app (Android-focused)
- RTL layout — all UI must respect right-to-left
- Kotlin native modules: SmsModule, PhoneModule, AssistantModule, ReminderBridge, NotificationBridge
- Intent parsing: regex first, Gemini LLM fallback
- Target: minSdk 24, targetSdk 36
