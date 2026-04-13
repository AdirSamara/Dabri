package com.dabri.service.audio

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale

class TextToSpeechManager(
    context: Context,
    private val onDone: () -> Unit,
    private val onError: (String) -> Unit
) {
    companion object {
        private const val TAG = "TextToSpeechMgr"
        private const val UTTERANCE_ID = "dabri_response"
    }

    private var tts: TextToSpeech? = null
    private var isReady = false
    var rate: Float = 0.9f
    var pitch: Float = 1.0f

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = tts?.setLanguage(Locale("he", "IL"))
                isReady = result != TextToSpeech.LANG_MISSING_DATA &&
                    result != TextToSpeech.LANG_NOT_SUPPORTED

                if (!isReady) {
                    Log.w(TAG, "Hebrew TTS not available, trying default")
                    isReady = true // Still allow fallback
                }

                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        Log.d(TAG, "TTS started")
                    }

                    override fun onDone(utteranceId: String?) {
                        Log.d(TAG, "TTS done")
                        onDone()
                    }

                    @Deprecated("Deprecated in API 21")
                    override fun onError(utteranceId: String?) {
                        Log.e(TAG, "TTS error")
                        onError("TTS playback error")
                    }

                    override fun onError(utteranceId: String?, errorCode: Int) {
                        Log.e(TAG, "TTS error: $errorCode")
                        onError("TTS error: $errorCode")
                    }
                })

                Log.d(TAG, "TTS initialized successfully")
            } else {
                Log.e(TAG, "TTS init failed with status: $status")
                isReady = false
            }
        }
    }

    fun speak(text: String) {
        if (!isReady || text.isBlank()) {
            onDone()
            return
        }
        tts?.setSpeechRate(rate)
        tts?.setPitch(pitch)
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
    }

    fun stop() {
        tts?.stop()
    }

    fun destroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isReady = false
    }
}
