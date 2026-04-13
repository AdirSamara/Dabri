package com.dabri.service.pipeline

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class ParsedIntent(
    val intent: String,
    val contact: String?,
    val message: String?,
    val appName: String?,
    val destination: String?,
    val navApp: String?,
    val reminderText: String?,
    val reminderTime: String?,
    val count: Int?,
    val source: String
)

class GeminiIntentParser {

    companion object {
        private const val TAG = "GeminiIntentParser"
        private const val MODEL = "gemini-2.5-flash-lite"
        private const val BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

        private val KNOWN_INTENTS = setOf(
            "SEND_SMS", "READ_SMS", "MAKE_CALL", "SEND_WHATSAPP",
            "READ_WHATSAPP", "READ_NOTIFICATIONS", "SET_REMINDER",
            "NAVIGATE", "OPEN_APP", "UNKNOWN"
        )
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun parse(text: String, apiKey: String): ParsedIntent {
        if (text.isBlank()) return unknownIntent()

        // Try regex first
        val regexResult = parseWithRegex(text)
        if (regexResult != null && regexResult.intent != "UNKNOWN") {
            return regexResult
        }

        // Fall back to Gemini if API key is available
        if (apiKey.isBlank()) {
            return regexResult ?: unknownIntent()
        }

        return try {
            val geminiResult = parseWithGemini(text, apiKey)
            geminiResult ?: regexResult ?: unknownIntent()
        } catch (e: Exception) {
            Log.e(TAG, "Gemini parsing failed", e)
            regexResult ?: unknownIntent()
        }
    }

    private suspend fun parseWithGemini(text: String, apiKey: String): ParsedIntent? {
        return withContext(Dispatchers.IO) {
            try {
                val url = "$BASE_URL/$MODEL:generateContent?key=$apiKey"

                val requestBody = JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("text", INTENT_PARSER_PROMPT + text)
                                })
                            })
                        })
                    })
                    put("generationConfig", JSONObject().apply {
                        put("temperature", 0.1)
                        put("maxOutputTokens", 256)
                        put("responseMimeType", "application/json")
                    })
                }

                val request = Request.Builder()
                    .url(url)
                    .post(requestBody.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext null

                if (!response.isSuccessful) {
                    Log.e(TAG, "Gemini API error: ${response.code} - $body")
                    return@withContext null
                }

                val json = JSONObject(body)
                val candidates = json.optJSONArray("candidates") ?: return@withContext null
                val content = candidates.getJSONObject(0)
                    .getJSONObject("content")
                    .getJSONArray("parts")
                    .getJSONObject(0)
                    .getString("text")

                val parsed = JSONObject(content)
                val intent = parsed.optString("intent", "UNKNOWN")

                if (intent !in KNOWN_INTENTS) return@withContext null

                ParsedIntent(
                    intent = intent,
                    contact = parsed.optStringOrNull("contact"),
                    message = parsed.optStringOrNull("message"),
                    appName = parsed.optStringOrNull("appName"),
                    destination = parsed.optStringOrNull("destination"),
                    navApp = parsed.optStringOrNull("navApp"),
                    reminderText = parsed.optStringOrNull("reminderText"),
                    reminderTime = parsed.optStringOrNull("reminderTime"),
                    count = if (parsed.has("count") && !parsed.isNull("count"))
                        parsed.optInt("count") else null,
                    source = "gemini"
                )
            } catch (e: Exception) {
                Log.e(TAG, "Gemini parse error", e)
                null
            }
        }
    }

    private fun parseWithRegex(text: String): ParsedIntent? {
        val lower = text.trim()

        // MAKE_CALL
        val callMatch = Regex("(?:תתקשר|תתקשרי|התקשר|התקשרי|תחייג|תחייגי|חייג|חייגי)(?:י)?\\s+(?:ל|אל\\s+)?(.+)")
            .find(lower)
        if (callMatch != null) {
            return ParsedIntent("MAKE_CALL", callMatch.groupValues[1].trim(), null, null, null, null, null, null, null, "regex")
        }

        // SEND_SMS
        val smsMatch = Regex("(?:שלח|שלחי|תשלח|תשלחי)\\s+(?:הודעה|סמס|SMS)\\s+(?:ל)(.+?)\\s+(?:ש|עם\\s+הטקסט\\s+|:)(.+)")
            .find(lower)
        if (smsMatch != null) {
            return ParsedIntent("SEND_SMS", smsMatch.groupValues[1].trim(), smsMatch.groupValues[2].trim(), null, null, null, null, null, null, "regex")
        }

        // READ_SMS
        if (Regex("(?:תקרא|קרא|תקראי|קראי|הקרא|הקראי).*(?:הודע|סמס|SMS|ההודעה)").containsMatchIn(lower)) {
            return ParsedIntent("READ_SMS", null, null, null, null, null, null, null, 5, "regex")
        }

        // SEND_WHATSAPP
        val wpMatch = Regex("(?:שלח|שלחי|תשלח|תשלחי|תרשום|רשום|תגיד|תגידי).*(?:וואטסאפ|ווטסאפ|whatsapp)?\\s+(?:ל)(.+?)\\s+(?:ש|:)(.+)")
            .find(lower)
        if (wpMatch != null) {
            return ParsedIntent("SEND_WHATSAPP", wpMatch.groupValues[1].trim(), wpMatch.groupValues[2].trim(), null, null, null, null, null, null, "regex")
        }

        // READ_NOTIFICATIONS
        if (Regex("(?:מה|תקרא|קרא|הקרא).*(?:התראות|נוטיפיקציות|הודעות\\s+שקיבלתי)").containsMatchIn(lower)) {
            return ParsedIntent("READ_NOTIFICATIONS", null, null, null, null, null, null, null, null, "regex")
        }

        // NAVIGATE
        val navMatch = Regex("(?:נווט|תנווט|תנווטי|קח\\s+אותי|סע|סעי|תסע|איך\\s+מגיעים)\\s+(?:ל|אל\\s+)?(.+)")
            .find(lower)
        if (navMatch != null) {
            val dest = HebrewUtils.cleanDestination(navMatch.groupValues[1])
            val navApp = when {
                Regex("וויז|ווייז|ויז|waze", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> "waze"
                Regex("גוגל\\s*מפות|google\\s*maps", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> "google_maps"
                else -> null
            }
            return ParsedIntent("NAVIGATE", null, null, null, dest, navApp, null, null, null, "regex")
        }

        // OPEN_APP
        val appMatch = Regex("(?:תפתח|תפתחי|פתח|פתחי|הפעל|הפעילי|תיכנס|היכנס)\\s+(?:לי\\s+)?(?:את\\s+)?(.+)")
            .find(lower)
        if (appMatch != null) {
            val appName = HebrewUtils.cleanAppName(appMatch.groupValues[1])
            return ParsedIntent("OPEN_APP", null, null, appName, null, null, null, null, null, "regex")
        }

        return null
    }

    private fun unknownIntent() = ParsedIntent(
        "UNKNOWN", null, null, null, null, null, null, null, null, "regex"
    )

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (!has(key) || isNull(key)) return null
        val v = optString(key, "")
        return v.ifBlank { null }
    }
}

private val INTENT_PARSER_PROMPT = """אתה מנתח פקודות קוליות בעברית. תפקידך לפרש פקודות בעברית ולהחזיר JSON בלבד, ללא הסבר.

החזר אובייקט JSON עם המבנה הבא:
{
  "intent": "<סוג_הפעולה>",
  "contact": "<שם_איש_הקשר או null>",
  "message": "<תוכן_ההודעה או null>",
  "appName": "<שם_האפליקציה או null>",
  "destination": "<יעד הניווט או null>",
  "navApp": "<'waze' | 'google_maps' | null — רק כשהמשתמש ציין אפליקציית ניווט>",
  "reminderText": "<תוכן_התזכורת או null>",
  "reminderTime": "<זמן_התזכורת או null>",
  "count": <מספר_ההודעות_לקריאה_או_null — 1 אם ביקשו הודעה אחת/אחרונה, 5 אם ביקשו הודעות ברבים, null אחרת>
}

סוגי פעולות אפשריים: SEND_SMS, READ_SMS, MAKE_CALL, SEND_WHATSAPP, READ_WHATSAPP, READ_NOTIFICATIONS, SET_REMINDER, NAVIGATE, OPEN_APP, UNKNOWN

חשוב לגבי SEND_WHATSAPP: הוצא מה-message רק את תוכן ההודעה עצמה. הסר פעלי פקודה (תשלח, תרשום, תכתוב, תגיד), מילות קישור (ש-, שאני, שהוא), ושמות פונים (שלום X). השאר אך ורק את מה שצריך להישלח.

חשוב לגבי SET_REMINDER: הפרד בין תוכן התזכורת (reminderText) לבין ביטוי הזמן (reminderTime).
- reminderText הוא מה שצריך לזכור (הפעולה/האירוע).
- reminderTime הוא מתי להזכיר (ביטוי הזמן בעברית, כולל "בעוד X דקות", "מחר בשעה Y", "ביום Z", "בערב" וכו').
- אם לא צוין זמן מפורש, reminderTime צריך להיות null.

חשוב לגבי NAVIGATE:
- destination הוא המקום שאליו לנווט (ללא "ל" בהתחלה, אלא אם זה חלק מהשם).
- navApp הוא 'waze' אם המשתמש ציין וויז/ויז/ווייז/Waze, או 'google_maps' אם ציין גוגל מפות/Google Maps, או null אם לא ציין אפליקציה ספציפית.

החזר ONLY JSON בלי שום טקסט נוסף.

הפקודה לניתוח:
"""
