package com.dabri.backgroundservice

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Resources
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class VoiceOverlayManager(
    private val context: Context,
    private val onClose: () -> Unit,
    private val onOpenApp: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: FrameLayout? = null
    private var statusDot: View? = null
    private var statusText: TextView? = null
    private var transcriptText: TextView? = null
    private var dotPulseAnimator: ObjectAnimator? = null

    // Theme colors — resolved at show() time
    private var cardBg = 0
    private var textColor = 0
    private var textSecondaryColor = 0
    private var transcriptBg = 0
    private var transcriptTextColor = 0
    private var closeBtnBg = 0

    // Status colors (match RN VoiceOverlay.tsx)
    private val colorListening = Color.parseColor("#E74C3C")
    private val colorProcessing = Color.parseColor("#3498DB")
    private val colorSpeaking = Color.parseColor("#4CAF50")

    fun show() {
        if (overlayView != null) return
        resolveTheme()

        val displayMetrics = Resources.getSystem().displayMetrics
        val screenWidth = displayMetrics.widthPixels

        // Root: full-screen transparent backdrop
        val root = FrameLayout(context).apply {
            setBackgroundColor(Color.parseColor("#99000000"))
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    onClose()
                    true
                } else false
            }
        }

        // Card: centered panel
        val cardWidth = (screenWidth * 0.85).toInt()
        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            val bg = GradientDrawable().apply {
                setColor(cardBg)
                cornerRadius = dpToPx(24f)
            }
            background = bg
            elevation = dpToPx(16f)
            setPadding(dpToPx(24f).toInt(), dpToPx(24f).toInt(), dpToPx(24f).toInt(), dpToPx(28f).toInt())
            setOnTouchListener { _, _ -> true } // consume touches
        }

        val cardParams = FrameLayout.LayoutParams(cardWidth, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER
        }

        // Close button (top-end)
        val closeRow = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        val closeBtn = FrameLayout(context).apply {
            val size = dpToPx(32f).toInt()
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = Gravity.START // RTL layout, so START = visual right
            }
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(closeBtnBg)
            }
            background = bg
            val xLabel = TextView(context).apply {
                text = "✕"
                setTextColor(textSecondaryColor)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                gravity = Gravity.CENTER
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            addView(xLabel)
            setOnClickListener { onClose() }
        }
        closeRow.addView(closeBtn)
        card.addView(closeRow)

        // Status row (dot + text) — RTL layout
        val statusRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dpToPx(16f).toInt() }
        }

        val sText = TextView(context).apply {
            text = "מקשיב לך..."
            setTextColor(colorListening)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }
        statusText = sText

        val dot = View(context).apply {
            val dotSize = dpToPx(10f).toInt()
            layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                marginStart = dpToPx(10f).toInt()
                gravity = Gravity.CENTER_VERTICAL
            }
            val shape = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(colorListening)
            }
            background = shape
        }
        statusDot = dot

        statusRow.addView(sText)
        statusRow.addView(dot)
        card.addView(statusRow)

        // Transcript area with background
        val transcriptWrapper = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            val bg = GradientDrawable().apply {
                setColor(transcriptBg)
                cornerRadius = dpToPx(16f)
            }
            background = bg
            setPadding(dpToPx(16f).toInt(), dpToPx(16f).toInt(), dpToPx(16f).toInt(), dpToPx(16f).toInt())
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(16f).toInt()
            }
            minimumHeight = dpToPx(80f).toInt()
        }

        val scroll = ScrollView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            isFillViewport = true
        }

        val tText = TextView(context).apply {
            text = "התחל לדבר..."
            setTextColor(textSecondaryColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            maxLines = 6
            ellipsize = TextUtils.TruncateAt.END
            setLineSpacing(dpToPx(4f), 1f)
        }
        transcriptText = tText
        scroll.addView(tText)
        transcriptWrapper.addView(scroll)
        card.addView(transcriptWrapper)

        // "Open app" button
        val openAppBtn = TextView(context).apply {
            text = "פתח את דברי"
            setTextColor(Color.parseColor("#2196F3"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            val btnBg = GradientDrawable().apply {
                setColor(Color.parseColor("#2196F320"))
                cornerRadius = dpToPx(10f)
            }
            background = btnBg
            setPadding(dpToPx(12f).toInt(), dpToPx(10f).toInt(), dpToPx(12f).toInt(), dpToPx(10f).toInt())
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(12f).toInt()
            }
            setOnClickListener { onOpenApp() }
        }
        card.addView(openAppBtn)

        root.addView(card, cardParams)

        // Window params
        val params = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            format = PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
            width = WindowManager.LayoutParams.MATCH_PARENT
            height = WindowManager.LayoutParams.MATCH_PARENT
        }

        try {
            windowManager.addView(root, params)
            overlayView = root
        } catch (_: Exception) {}
    }

    fun hide() {
        stopDotPulse()
        overlayView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        overlayView = null
        statusDot = null
        statusText = null
        transcriptText = null
    }

    fun isShowing(): Boolean = overlayView != null

    fun updateStatus(status: String) {
        val dotBg = statusDot?.background as? GradientDrawable ?: return
        when (status) {
            "listening" -> {
                dotBg.setColor(colorListening)
                statusText?.setTextColor(colorListening)
                statusText?.text = "מקשיב לך..."
                startDotPulse()
            }
            "processing" -> {
                dotBg.setColor(colorProcessing)
                statusText?.setTextColor(colorProcessing)
                statusText?.text = "מעבד נתונים..."
                startDotPulse()
            }
            "speaking" -> {
                dotBg.setColor(colorSpeaking)
                statusText?.setTextColor(colorSpeaking)
                statusText?.text = "הנה התשובה:"
                stopDotPulse()
            }
            else -> {
                dotBg.setColor(textSecondaryColor)
                statusText?.setTextColor(textSecondaryColor)
                statusText?.text = "לחץ כדי להתחיל"
                stopDotPulse()
            }
        }
    }

    private fun startDotPulse() {
        stopDotPulse()
        val dot = statusDot ?: return
        dotPulseAnimator = ObjectAnimator.ofFloat(dot, View.ALPHA, 1f, 0.3f, 1f).apply {
            duration = 1200
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }
    }

    private fun stopDotPulse() {
        dotPulseAnimator?.cancel()
        dotPulseAnimator = null
        statusDot?.alpha = 1f
    }

    fun updateTranscript(text: String) {
        transcriptText?.text = text
        transcriptText?.setTextColor(transcriptTextColor)
    }

    private fun resolveTheme() {
        // Read isDarkMode from the Zustand AsyncStorage persisted store
        val isDark = try {
            val prefs = context.getSharedPreferences("dabri-store", Context.MODE_PRIVATE)
            val json = prefs.getString("dabri-store", null)
            json?.contains("\"isDarkMode\":true") == true
        } catch (_: Exception) {
            false
        }

        if (isDark) {
            cardBg = Color.parseColor("#1E1E1E")
            textColor = Color.parseColor("#F0F0F0")
            textSecondaryColor = Color.parseColor("#999999")
            transcriptBg = Color.parseColor("#2A2A2A")
            transcriptTextColor = Color.parseColor("#E0E0E0")
            closeBtnBg = Color.parseColor("#2A2A2A")
        } else {
            cardBg = Color.parseColor("#FFFFFF")
            textColor = Color.parseColor("#1A1A1A")
            textSecondaryColor = Color.parseColor("#666666")
            transcriptBg = Color.parseColor("#F8F9FA")
            transcriptTextColor = Color.parseColor("#2C3E50")
            closeBtnBg = Color.parseColor("#F0F0F0")
        }
    }

    private fun dpToPx(dp: Float): Float {
        return dp * Resources.getSystem().displayMetrics.density
    }
}
