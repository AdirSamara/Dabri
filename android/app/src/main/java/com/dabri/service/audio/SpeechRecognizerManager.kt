package com.dabri.service.audio

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log

class SpeechRecognizerManager(
    private val context: Context,
    private val locale: String = "he-IL",
    private val maxListeningMs: Long = 15000,
    private val onPartialResult: (String) -> Unit,
    private val onFinalResult: (String) -> Unit,
    private val onError: (String) -> Unit
) {
    companion object {
        private const val TAG = "SpeechRecognizerMgr"
    }

    private var recognizer: SpeechRecognizer? = null
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var timeoutRunnable: Runnable? = null
    private var lastIntent: Intent? = null
    private var retryCount = 0
    private val MAX_RETRIES = 3

    fun start() {
        mainHandler.post {
            if (isListening) return@post
            retryCount = 0

            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                onError("Speech recognition is not available on this device")
                return@post
            }

            try {
                recognizer = SpeechRecognizer.createSpeechRecognizer(context)
                recognizer?.setRecognitionListener(createListener())

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    // Keep listening longer before timeout
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 5000L)
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
                }
                lastIntent = intent

                // Small delay to ensure listener is fully registered before starting
                mainHandler.postDelayed({
                    recognizer?.startListening(intent)
                    Log.d(TAG, "startListening() called")
                    isListening = true

                    // Hard timeout
                    timeoutRunnable = Runnable { stop() }
                    mainHandler.postDelayed(timeoutRunnable!!, maxListeningMs)

                    Log.d(TAG, "Started listening ($locale)")
                }, 100)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start speech recognizer", e)
                onError("Failed to start speech recognition: ${e.message}")
            }
        }
    }

    fun stop() {
        mainHandler.post {
            if (!isListening) return@post
            timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            timeoutRunnable = null

            try {
                recognizer?.stopListening()
            } catch (_: Exception) { }
            isListening = false
            Log.d(TAG, "Stopped listening")
        }
    }

    fun destroy() {
        mainHandler.post {
            timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            timeoutRunnable = null
            try {
                recognizer?.cancel()
            } catch (_: Exception) { }
            try {
                recognizer?.destroy()
            } catch (_: Exception) { }
            recognizer = null
            isListening = false
            Log.d(TAG, "SpeechRecognizerManager destroyed")
        }
    }

    private fun createListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d(TAG, "Ready for speech")
                Log.d(TAG, "Ready - microphone is active")
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Beginning of speech")
            }

            override fun onRmsChanged(rmsdB: Float) { }

            override fun onBufferReceived(buffer: ByteArray?) { }

            override fun onEndOfSpeech() {
                Log.d(TAG, "End of speech")
                isListening = false
            }

            override fun onError(error: Int) {
                isListening = false
                val errorMsg = when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                    SpeechRecognizer.ERROR_CLIENT -> "Client error"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                    SpeechRecognizer.ERROR_NETWORK -> "Network error"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                    SpeechRecognizer.ERROR_NO_MATCH -> "No match found"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
                    SpeechRecognizer.ERROR_SERVER -> "Server error"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected"
                    else -> "Unknown error: $error"
                }
                Log.e(TAG, "Recognition error: $errorMsg")

                // NO_MATCH and SPEECH_TIMEOUT — retry up to MAX_RETRIES before giving up
                if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                    error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                    retryCount++
                    if (retryCount >= MAX_RETRIES) {
                        Log.d(TAG, "Max retries ($MAX_RETRIES) reached, giving up")
                        onFinalResult("")
                    } else {
                        Log.d(TAG, "Timeout/no match, restarting (retry $retryCount/$MAX_RETRIES)")
                        mainHandler.postDelayed({
                            try {
                                lastIntent?.let { intent ->
                                    recognizer?.startListening(intent)
                                    isListening = true
                                    Log.d(TAG, "Restarted listening after timeout")
                                } ?: onFinalResult("")
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to restart after timeout", e)
                                onFinalResult("")
                            }
                        }, 200)
                    }
                } else {
                    onError(errorMsg)
                }
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""
                Log.d(TAG, "Final result: $text")
                onFinalResult(text)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: return
                onPartialResult(text)
            }

            override fun onEvent(eventType: Int, params: Bundle?) { }
        }
    }
}
