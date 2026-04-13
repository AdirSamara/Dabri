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

    private var cardBg = 0
    private var textColor = 0
    private var textSecondaryColor = 0
    private var transcriptBg = 0
    private var transcriptTextColor = 0
    private var subtleBg = 0

    private val colorListening = Color.parseColor("#E74C3C")
    private val colorProcessing = Color.parseColor("#3498DB")
    private val colorSpeaking = Color.parseColor("#4CAF50")
    private val accentColor = Color.parseColor("#2196F3")

    fun show() {
        if (overlayView != null) return
        resolveTheme()

        val displayMetrics = Resources.getSystem().displayMetrics
        val screenWidth = displayMetrics.widthPixels

        // Root: full-screen backdrop
        val root = FrameLayout(context).apply {
            setBackgroundColor(Color.parseColor("#99000000"))
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) { onClose(); true } else false
            }
        }

        // Card
        val cardWidth = (screenWidth * 0.88).toInt()
        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            val bg = GradientDrawable().apply {
                setColor(cardBg)
                cornerRadius = dpToPx(20f)
            }
            background = bg
            elevation = dpToPx(12f)
            setPadding(dpToPx(18f).toInt(), dpToPx(14f).toInt(), dpToPx(18f).toInt(), dpToPx(16f).toInt())
            setOnTouchListener { _, _ -> true }
        }
        val cardParams = FrameLayout.LayoutParams(cardWidth, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER
        }

        // ── Top bar: [open app link]  ···  [✕ close] ──
        val topBar = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(28f).toInt()
            )
        }

        // Close button (top-left in RTL = visual top-right)
        val closeBtn = FrameLayout(context).apply {
            val size = dpToPx(28f).toInt()
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
            }
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(subtleBg)
            }
            background = bg
            addView(TextView(context).apply {
                text = "✕"
                setTextColor(textSecondaryColor)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                gravity = Gravity.CENTER
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            })
            setOnClickListener { onClose() }
        }

        // "פתח דברי" as a small text link (top-right in RTL = visual top-left)
        val openLink = TextView(context).apply {
            text = "פתח דברי ←"
            setTextColor(accentColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            textDirection = View.TEXT_DIRECTION_RTL
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.END or Gravity.CENTER_VERTICAL
            }
            setOnClickListener { onOpenApp() }
        }

        topBar.addView(closeBtn)
        topBar.addView(openLink)
        card.addView(topBar)

        // ── Status row: dot + text ──
        val statusRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dpToPx(14f).toInt() }
        }

        val sText = TextView(context).apply {
            text = "מקשיב לך..."
            setTextColor(colorListening)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }
        statusText = sText

        val dot = View(context).apply {
            val dotSize = dpToPx(8f).toInt()
            layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                marginStart = dpToPx(8f).toInt()
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

        // ── Transcript area ──
        val transcriptWrapper = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            val bg = GradientDrawable().apply {
                setColor(transcriptBg)
                cornerRadius = dpToPx(12f)
            }
            background = bg
            setPadding(dpToPx(14f).toInt(), dpToPx(12f).toInt(), dpToPx(14f).toInt(), dpToPx(12f).toInt())
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dpToPx(12f).toInt() }
            minimumHeight = dpToPx(56f).toInt()
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
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            maxLines = 5
            ellipsize = TextUtils.TruncateAt.END
            setLineSpacing(dpToPx(3f), 1f)
        }
        transcriptText = tText
        scroll.addView(tText)
        transcriptWrapper.addView(scroll)
        card.addView(transcriptWrapper)

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
        val isDark = try {
            val prefs = context.getSharedPreferences("dabri-store", Context.MODE_PRIVATE)
            val json = prefs.getString("dabri-store", null)
            json?.contains("\"isDarkMode\":true") == true
        } catch (_: Exception) { false }

        if (isDark) {
            cardBg = Color.parseColor("#1E1E1E")
            textColor = Color.parseColor("#F0F0F0")
            textSecondaryColor = Color.parseColor("#999999")
            transcriptBg = Color.parseColor("#2A2A2A")
            transcriptTextColor = Color.parseColor("#E0E0E0")
            subtleBg = Color.parseColor("#2A2A2A")
        } else {
            cardBg = Color.parseColor("#FFFFFF")
            textColor = Color.parseColor("#1A1A1A")
            textSecondaryColor = Color.parseColor("#666666")
            transcriptBg = Color.parseColor("#F8F9FA")
            transcriptTextColor = Color.parseColor("#2C3E50")
            subtleBg = Color.parseColor("#F0F0F0")
        }
    }

    private fun dpToPx(dp: Float): Float {
        return dp * Resources.getSystem().displayMetrics.density
    }
}
