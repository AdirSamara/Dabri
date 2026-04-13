package com.dabri.service.overlay

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.dabri.service.PipelineState
import com.dabri.service.config.ServicePreferences

class VoiceOverlayManager(
    private val context: Context,
    private val preferences: ServicePreferences,
    private val onClose: () -> Unit,
    private val onMicTap: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: View? = null
    private var isShowing = false
    private val handler = Handler(Looper.getMainLooper())
    private var hideRunnable: Runnable? = null

    private var statusDot: View? = null
    private var statusText: TextView? = null
    private var transcriptText: TextView? = null
    private var resultText: TextView? = null

    fun show() {
        if (isShowing) return
        if (!OverlayPermissionHelper.canDrawOverlays(context)) return

        cancelScheduledHide()

        try {
            val view = buildOverlayView()
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            val params = WindowManager.LayoutParams(
                dpToPx(280),
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.CENTER
            }

            windowManager.addView(view, params)
            overlayView = view
            isShowing = true
        } catch (e: Exception) {
            android.util.Log.e("VoiceOverlay", "Failed to show overlay", e)
        }
    }

    fun hide() {
        if (!isShowing) return
        cancelScheduledHide()
        try {
            overlayView?.let { windowManager.removeView(it) }
        } catch (_: Exception) { }
        overlayView = null
        isShowing = false
        statusDot = null
        statusText = null
        transcriptText = null
        resultText = null
    }

    fun scheduleHide(delayMs: Long) {
        cancelScheduledHide()
        hideRunnable = Runnable { hide() }
        handler.postDelayed(hideRunnable!!, delayMs)
    }

    private fun cancelScheduledHide() {
        hideRunnable?.let { handler.removeCallbacks(it) }
        hideRunnable = null
    }

    fun updateTranscript(text: String) {
        transcriptText?.post {
            transcriptText?.text = text
            transcriptText?.visibility = View.VISIBLE
        }
    }

    fun updateResult(text: String) {
        resultText?.post {
            resultText?.text = text
            resultText?.visibility = View.VISIBLE
        }
    }

    fun updateStatus(state: PipelineState) {
        handler.post {
            val isDark = preferences.isDarkMode

            val (dotColor, label) = when (state) {
                PipelineState.RECOGNIZING -> Color.parseColor("#C62828") to "מקשיב..."
                PipelineState.PARSING -> Color.parseColor("#E65100") to "מעבד..."
                PipelineState.EXECUTING -> Color.parseColor("#E65100") to "מבצע..."
                PipelineState.SPEAKING -> Color.parseColor("#2E7D32") to "הנה התשובה:"
                PipelineState.ERROR -> Color.parseColor("#F44336") to "שגיאה"
                else -> Color.parseColor("#1565C0") to "לחץ כדי להתחיל"
            }

            statusDot?.let { dot ->
                val bg = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(dotColor)
                }
                dot.background = bg
            }

            statusText?.text = label
        }
    }

    private fun buildOverlayView(): View {
        val isDark = preferences.isDarkMode
        val bgColor = if (isDark) Color.parseColor("#1E1E1E") else Color.WHITE
        val textColor = if (isDark) Color.parseColor("#E0E0E0") else Color.parseColor("#2C3E50")
        val secondaryTextColor = if (isDark) Color.parseColor("#999999") else Color.parseColor("#7F8C8D")
        val transcriptBg = if (isDark) Color.parseColor("#2A2A2A") else Color.parseColor("#F8F9FA")

        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(16), dpToPx(16), dpToPx(16), dpToPx(16))
            val bg = android.graphics.drawable.GradientDrawable().apply {
                setColor(bgColor)
                cornerRadius = dpToPx(16).toFloat()
            }
            background = bg
            elevation = dpToPx(8).toFloat()
        }

        // Header row: [close X] [status dot] [status text]
        val headerRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // Status dot
        val dot = View(context).apply {
            val size = dpToPx(8)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                marginEnd = dpToPx(8)
            }
            val bg = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.parseColor("#1565C0"))
            }
            background = bg
        }
        statusDot = dot
        headerRow.addView(dot)

        // Status text
        val status = TextView(context).apply {
            text = "מקשיב..."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(textColor)
            typeface = Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            textDirection = View.TEXT_DIRECTION_RTL
        }
        statusText = status
        headerRow.addView(status)

        // Close button
        val closeBtn = TextView(context).apply {
            text = "✕"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(secondaryTextColor)
            setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4))
            setOnClickListener { onClose() }
        }
        headerRow.addView(closeBtn)

        container.addView(headerRow)

        // Transcript area
        val transcriptScroll = ScrollView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(8)
            }
            val scrollBg = android.graphics.drawable.GradientDrawable().apply {
                setColor(transcriptBg)
                cornerRadius = dpToPx(8).toFloat()
            }
            background = scrollBg
            setPadding(dpToPx(12), dpToPx(8), dpToPx(12), dpToPx(8))
            // Max height ~100dp
            isScrollbarFadingEnabled = true
        }

        val transcript = TextView(context).apply {
            text = "..."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(textColor)
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_VIEW_START
            maxLines = 6
            visibility = View.VISIBLE
        }
        transcriptText = transcript
        transcriptScroll.addView(transcript)
        container.addView(transcriptScroll)

        // Result text
        val result = TextView(context).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(secondaryTextColor)
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_VIEW_START
            maxLines = 4
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(8)
            }
        }
        resultText = result
        container.addView(result)

        // Wrap in FrameLayout with margin for shadow
        return FrameLayout(context).apply {
            setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
            addView(container)
        }
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * context.resources.displayMetrics.density).toInt()
    }
}
