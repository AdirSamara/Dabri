package com.dabri.service.pipeline

import android.content.Context
import android.content.Intent
import android.util.Log

data class ResolvedApp(
    val packageName: String,
    val label: String,
    val score: Double
)

class AppNameResolverNative(private val context: Context) {

    companion object {
        private const val TAG = "AppNameResolver"
    }

    private var cachedApps: List<Pair<String, String>>? = null

    fun resolve(query: String): ResolvedApp? {
        val apps = getInstalledApps()
        val normalizedQuery = HebrewUtils.normalizeHebrew(query)

        var bestMatch: ResolvedApp? = null
        var bestScore = 0.0

        for ((pkg, label) in apps) {
            val normalizedLabel = HebrewUtils.normalizeHebrew(label)
            val score = calculateScore(normalizedQuery, normalizedLabel)

            if (score > bestScore && score > 0.4) {
                bestScore = score
                bestMatch = ResolvedApp(pkg, label, score)
            }
        }

        if (bestMatch != null) {
            Log.d(TAG, "Resolved '$query' -> '${bestMatch.label}' (${bestMatch.packageName})")
        }
        return bestMatch
    }

    private fun calculateScore(query: String, label: String): Double {
        if (query == label) return 1.0
        if (label.contains(query)) return 0.9
        if (query.contains(label)) return 0.85

        val distance = HebrewUtils.levenshteinDistance(query, label)
        val maxLen = maxOf(query.length, label.length)
        if (maxLen == 0) return 0.0
        val similarity = 1.0 - (distance.toDouble() / maxLen)
        return if (similarity > 0.5) similarity * 0.8 else 0.0
    }

    private fun getInstalledApps(): List<Pair<String, String>> {
        cachedApps?.let { return it }

        val pm = context.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val activities = pm.queryIntentActivities(mainIntent, 0)
        val selfPkg = context.packageName

        val apps = activities
            .mapNotNull { ri ->
                val pkg = ri.activityInfo.packageName
                if (pkg == selfPkg) return@mapNotNull null
                val label = ri.loadLabel(pm).toString()
                Pair(pkg, label)
            }
            .distinctBy { it.first }
            .sortedBy { it.second.lowercase() }

        cachedApps = apps
        return apps
    }
}
