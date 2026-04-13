package com.dabri.service.pipeline

object HebrewUtils {

    fun cleanAppName(raw: String): String {
        var name = raw.trim()
        name = name.replace(Regex("^את\\s+ה"), "")
        name = name.replace(Regex("^את\\s+"), "")
        name = name.replace(Regex("^ה(?=[א-ת])"), "")
        name = name.replace(Regex("^ל(?=[א-ת])"), "")
        name = name.replace(Regex("^לי\\s+"), "")
        name = name.replace(Regex("^אפליקציית\\s+"), "")
        name = name.replace(Regex("^אפליקציה\\s+(?:של\\s+)?"), "")
        name = name.replace(Regex("\\s+בבקשה$"), "")
        return name.trim()
    }

    fun cleanDestination(raw: String): String {
        var dest = raw.trim()
        dest = dest.replace(Regex("^את\\s+ה"), "")
        dest = dest.replace(Regex("^את\\s+"), "")
        dest = dest.replace(Regex("^ה(?=[א-ת])"), "")
        dest = dest.replace(Regex("^לי\\s+"), "")
        dest = dest.replace(Regex("\\s+בבקשה$"), "")
        dest = dest.replace(Regex("^בבקשה\\s+"), "")
        return dest.trim()
    }

    fun normalizeHebrew(text: String): String {
        var result = text.lowercase().trim()
        // Remove niqqud (Hebrew vowel marks)
        result = result.replace(Regex("[\\u0591-\\u05C7]"), "")
        // Normalize common variations
        result = result.replace("וו", "ו")
        return result
    }

    fun levenshteinDistance(a: String, b: String): Int {
        val m = a.length
        val n = b.length
        val dp = Array(m + 1) { IntArray(n + 1) }

        for (i in 0..m) dp[i][0] = i
        for (j in 0..n) dp[0][j] = j

        for (i in 1..m) {
            for (j in 1..n) {
                dp[i][j] = if (a[i - 1] == b[j - 1]) {
                    dp[i - 1][j - 1]
                } else {
                    minOf(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
                }
            }
        }
        return dp[m][n]
    }
}
