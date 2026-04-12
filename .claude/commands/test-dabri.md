# /test-dabri — Dabri Test Orchestrator

Run and manage the Dabri test suite.

## Usage

Based on the user's input, perform the appropriate action:

### `run` / `run unit` — Run unit tests
```bash
npx jest --no-coverage
```

### `run coverage` — Run with coverage report
```bash
npx jest --coverage
```

### `run <file>` — Run tests for a specific file
```bash
npx jest --no-coverage <file-pattern>
```

### `generate <source-file>` — Generate tests for a source file
Read the source file, understand its exports and logic, then create a test file at the mirrored path under `__tests__/`. Follow these conventions:
- Test file mirrors `src/` structure: `src/services/foo.ts` → `__tests__/services/foo.test.ts`
- Import from relative path to source
- Mock native modules via `jest.setup.js` (already configured)
- Mock `PermissionsAndroid` using the `global.__mockPermissionRequest` pattern
- Test descriptions in English, test data in Hebrew
- Components use `@testing-library/react-native`
- Mock `useTheme` from `../../src/utils/theme`

### `check` — Pre-flight verification
Verify the test setup is complete:
1. Check `jest.config.js` exists and has correct moduleNameMapper
2. Check `jest.setup.js` exists with NativeModule mocks
3. Check `__mocks__/` directory has all required mocks
4. Check `@testing-library/react-native` is installed
5. Run `npx jest --no-coverage` and report results

### `dataset add "<utterance>" <INTENT>` — Add to Hebrew intent dataset
Add a new test case to `__tests__/fixtures/hebrewIntentDataset.ts`.

### `dataset validate` — Validate all dataset entries
Run just the intent parser dataset tests:
```bash
npx jest __tests__/services/intentParser.test.ts --no-coverage
```

### `e2e` — List E2E flows
List all Maestro flow files in `e2e/maestro/flows/`.

## Test file structure
```
__tests__/
  fixtures/         — Test datasets and mock data
  services/         — Service unit tests
  utils/            — Utility tests
  store/            — Zustand store tests
  components/       — React component tests
  screens/          — Screen-level tests
  hooks/            — Hook tests
__mocks__/          — Library-level Jest mocks
e2e/maestro/        — Maestro E2E flows
  flows/            — Core flows (all emulators)
  flows-api33/      — API 33+ specific
  flows-api34/      — API 34+ specific
  flows-api35/      — API 35+ specific
  flows-api36/      — API 36 specific
  checks/           — ADB native verification
```