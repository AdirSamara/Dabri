# דברי — Dabri

A Hebrew voice assistant for Android.

## Requirements

- **Android 8.0 (API 26) or higher** — Android 7 and below are not supported.
- Microphone permission
- Internet connection (for Gemini AI intent parsing)

## Features

- Make phone calls by voice
- Send SMS and WhatsApp messages by voice
- Set reminders by voice
- Read incoming SMS messages aloud
- Full Hebrew language support

## App Icon

The launcher icon uses Android's [Adaptive Icon](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive) system (`mipmap-anydpi-v26`), which requires Android 8+. Legacy PNG mipmap files are intentionally omitted — Android 7 and below are not supported.

## Development

```bash
# Install dependencies
npm install

# Run on Android
npx react-native run-android
```
