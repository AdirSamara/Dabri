package com.dabri.service.pipeline

import java.util.Calendar
import java.util.regex.Pattern

object HebrewTimeParserNative {

    private val HEBREW_NUMBERS = mapOf(
        "אחת" to 1, "אחד" to 1, "שתיים" to 2, "שניים" to 2, "שתי" to 2, "שני" to 2,
        "שלוש" to 3, "שלושה" to 3, "ארבע" to 4, "ארבעה" to 4,
        "חמש" to 5, "חמישה" to 5, "שש" to 6, "שישה" to 6,
        "שבע" to 7, "שבעה" to 7, "שמונה" to 8, "שמונת" to 8,
        "תשע" to 9, "תשעה" to 9, "עשר" to 10, "עשרה" to 10,
        "חמש עשרה" to 15, "עשרים" to 20, "עשרים וחמש" to 25,
        "שלושים" to 30, "ארבעים" to 40, "ארבעים וחמש" to 45,
        "חצי" to 30, "רבע" to 15
    )

    fun parse(timeExpr: String?): Long? {
        if (timeExpr == null) return null
        val text = timeExpr.trim()
        if (text.isEmpty()) return null

        val cal = Calendar.getInstance()

        // "בעוד X דקות/שעות"
        val relativeMatch = Regex("בעוד\\s+(.+?)\\s+(דקות?|שעות?|שעה)").find(text)
        if (relativeMatch != null) {
            val amountStr = relativeMatch.groupValues[1]
            val unit = relativeMatch.groupValues[2]
            val amount = parseNumber(amountStr) ?: return null

            return when {
                unit.startsWith("דק") -> {
                    cal.add(Calendar.MINUTE, amount)
                    cal.timeInMillis
                }
                unit.startsWith("שע") -> {
                    cal.add(Calendar.HOUR_OF_DAY, amount)
                    cal.timeInMillis
                }
                else -> null
            }
        }

        // "בעוד חצי שעה"
        if (text.contains("חצי שעה")) {
            cal.add(Calendar.MINUTE, 30)
            return cal.timeInMillis
        }

        // "בעוד שעה"
        if (Regex("בעוד\\s+שעה(?!ת)").containsMatchIn(text)) {
            cal.add(Calendar.HOUR_OF_DAY, 1)
            return cal.timeInMillis
        }

        // "בעוד שעתיים"
        if (text.contains("שעתיים")) {
            cal.add(Calendar.HOUR_OF_DAY, 2)
            return cal.timeInMillis
        }

        // "מחר" / "מחרתיים"
        if (text.contains("מחרתיים")) {
            cal.add(Calendar.DAY_OF_YEAR, 2)
        } else if (text.contains("מחר")) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }

        // "בשעה X" or "ב-HH:MM"
        val timeMatch = Regex("(?:בשעה\\s+|ב-?)(\\d{1,2})(?::(\\d{2}))?").find(text)
        if (timeMatch != null) {
            val hour = timeMatch.groupValues[1].toInt()
            val minute = timeMatch.groupValues[2].toIntOrNull() ?: 0
            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, minute)
            cal.set(Calendar.SECOND, 0)

            // If time has passed today, push to tomorrow
            if (cal.timeInMillis <= System.currentTimeMillis()) {
                cal.add(Calendar.DAY_OF_YEAR, 1)
            }
            return cal.timeInMillis
        }

        // Hebrew number time: "בשעה שמונה בבוקר"
        val hebrewTimeMatch = Regex("בשעה\\s+(.+?)(?:\\s+ב(בוקר|צהריים|ערב|לילה))?$").find(text)
        if (hebrewTimeMatch != null) {
            val hourStr = hebrewTimeMatch.groupValues[1].trim()
            val period = hebrewTimeMatch.groupValues[2]
            var hour = parseNumber(hourStr) ?: return null

            when (period) {
                "ערב", "לילה" -> if (hour < 12) hour += 12
                "בוקר" -> {} // AM
                "צהריים" -> if (hour < 12) hour = 12
            }

            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0)

            if (cal.timeInMillis <= System.currentTimeMillis()) {
                cal.add(Calendar.DAY_OF_YEAR, 1)
            }
            return cal.timeInMillis
        }

        // "בבוקר" / "בצהריים" / "בערב" / "בלילה" (no specific hour)
        when {
            text.contains("בבוקר") -> {
                cal.set(Calendar.HOUR_OF_DAY, 8)
                cal.set(Calendar.MINUTE, 0)
            }
            text.contains("בצהריים") -> {
                cal.set(Calendar.HOUR_OF_DAY, 12)
                cal.set(Calendar.MINUTE, 0)
            }
            text.contains("בערב") -> {
                cal.set(Calendar.HOUR_OF_DAY, 19)
                cal.set(Calendar.MINUTE, 0)
            }
            text.contains("בלילה") -> {
                cal.set(Calendar.HOUR_OF_DAY, 21)
                cal.set(Calendar.MINUTE, 0)
            }
            else -> return null
        }

        cal.set(Calendar.SECOND, 0)
        if (cal.timeInMillis <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }

    private fun parseNumber(text: String): Int? {
        // Try digit first
        text.trim().toIntOrNull()?.let { return it }

        // Try Hebrew number words
        HEBREW_NUMBERS[text.trim()]?.let { return it }

        // Try partial match
        for ((word, num) in HEBREW_NUMBERS) {
            if (text.trim().startsWith(word)) return num
        }
        return null
    }
}
