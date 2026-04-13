package com.dabri.service.pipeline

import android.content.Context
import android.provider.ContactsContract
import android.util.Log

data class ResolvedContact(
    val name: String,
    val phoneNumber: String,
    val score: Double
)

class ContactResolverNative(private val context: Context) {

    companion object {
        private const val TAG = "ContactResolver"
    }

    fun resolve(query: String, aliases: Map<String, String> = emptyMap()): ResolvedContact? {
        // Check aliases first
        val aliasMatch = aliases[query.trim()]

        val contacts = loadContacts()
        if (contacts.isEmpty()) {
            Log.w(TAG, "No contacts found")
            return null
        }

        val searchName = aliasMatch ?: query.trim()
        val normalizedQuery = HebrewUtils.normalizeHebrew(searchName)

        var bestMatch: ResolvedContact? = null
        var bestScore = 0.0

        for (contact in contacts) {
            val normalizedContact = HebrewUtils.normalizeHebrew(contact.first)
            val score = calculateMatchScore(normalizedQuery, normalizedContact)

            if (score > bestScore && score > 0.5) {
                bestScore = score
                bestMatch = ResolvedContact(
                    name = contact.first,
                    phoneNumber = contact.second,
                    score = score
                )
            }
        }

        if (bestMatch != null) {
            Log.d(TAG, "Resolved '$query' -> '${bestMatch.name}' (score: $bestScore)")
        } else {
            Log.d(TAG, "No match found for '$query'")
        }

        return bestMatch
    }

    private fun calculateMatchScore(query: String, contactName: String): Double {
        // Exact match
        if (query == contactName) return 1.0

        // Contains match
        if (contactName.contains(query)) return 0.9
        if (query.contains(contactName)) return 0.85

        // Starts with match
        if (contactName.startsWith(query)) return 0.88

        // Check individual name parts
        val queryParts = query.split(" ")
        val contactParts = contactName.split(" ")

        for (qPart in queryParts) {
            for (cPart in contactParts) {
                if (qPart == cPart) return 0.8
                if (cPart.startsWith(qPart) || qPart.startsWith(cPart)) return 0.75
            }
        }

        // Levenshtein distance
        val distance = HebrewUtils.levenshteinDistance(query, contactName)
        val maxLen = maxOf(query.length, contactName.length)
        if (maxLen == 0) return 0.0
        val similarity = 1.0 - (distance.toDouble() / maxLen)
        return if (similarity > 0.6) similarity * 0.7 else 0.0
    }

    private fun loadContacts(): List<Pair<String, String>> {
        val contacts = mutableListOf<Pair<String, String>>()

        val cursor = context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            ),
            null, null,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
        )

        cursor?.use { c ->
            val nameCol = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
            val numberCol = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)

            val seen = mutableSetOf<String>()
            while (c.moveToNext()) {
                val name = c.getString(nameCol) ?: continue
                val number = c.getString(numberCol) ?: continue
                val key = "$name|$number"
                if (seen.add(key)) {
                    contacts.add(Pair(name, number.replace(Regex("[\\s-]"), "")))
                }
            }
        }

        return contacts
    }
}
