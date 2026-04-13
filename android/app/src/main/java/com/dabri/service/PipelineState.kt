package com.dabri.service

enum class PipelineState {
    IDLE,               // Wake word detector listening
    RECOGNIZING,        // STT active, user speaking
    PARSING,            // Gemini API call in-flight
    EXECUTING,          // Action dispatch in progress
    SPEAKING,           // TTS playing response
    PAUSED,             // User paused listening
    PHONE_CALL_PAUSED,  // Mic borrowed by phone call
    ERROR,              // Recoverable error
    DEGRADED            // No wake word (tap-only mode)
}
