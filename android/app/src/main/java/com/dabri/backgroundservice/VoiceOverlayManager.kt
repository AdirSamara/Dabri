package com.dabri.backgroundservice

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
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class VoiceOverlayManager(
    private val context: Context,
    private val onClose: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: FrameLayout? = null
    private var statusDot: View? = null
    private var statusText: TextView? = null
    private var transcriptText: TextView? = null

    // Colors matching the app's VoiceOverlay
    private val colorListening = Color.parseColor("#F44336")
    private val colorProcessing = Color.parseColor("#2196F3")
    private val colorSpeaking = Color.parseColor("#4CAF50")
    private val colorIdle = Color.parseColor("#9E9E9E")

    fun show() {
        if (overlayView != null) return

        val displayMetrics = Resources.getSystem().displayMetrics
        val screenWidth = displayMetrics.widthPixels
        val screenHeight = displayMetrics.heightPixels

        // Root: full-screen transparent backdrop
        val root = FrameLayout(context).apply {
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    onClose()
                    true
                } else false
            }
        }

        // Card: bottom sheet
        val cardWidth = (screenWidth * 0.9).toInt()
        val cardHeight = (screenHeight * 0.40).toInt()

        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#1A1A2E"))
                cornerRadii = floatArrayOf(
                    dpToPx(24f), dpToPx(24f), // top-left
                    dpToPx(24f), dpToPx(24f), // top-right
                    0f, 0f, 0f, 0f             // bottom
                )
            }
            background = bg
            elevation = dpToPx(16f)
            setPadding(dpToPx(20f).toInt(), dpToPx(16f).toInt(), dpToPx(20f).toInt(), dpToPx(24f).toInt())

            // Consume touches so they don't pass through to backdrop
            setOnTouchListener { _, _ -> true }
        }

        val cardParams = FrameLayout.LayoutParams(cardWidth, cardHeight).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        }

        // Close button row
        val closeRow = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(32f).toInt()
            )
        }
        val closeBtn = ImageView(context).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(Color.WHITE)
            val size = dpToPx(24f).toInt()
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = Gravity.END or Gravity.CENTER_VERTICAL
            }
            setOnClickListener { onClose() }
        }
        closeRow.addView(closeBtn)
        card.addView(closeRow)

        // Status row (dot + text)
        val statusRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dpToPx(8f).toInt() }
        }
        val dot = View(context).apply {
            val dotSize = dpToPx(10f).toInt()
            layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                marginEnd = dpToPx(8f).toInt()
            }
            val shape = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(colorListening)
            }
            background = shape
        }
        statusDot = dot

        val sText = TextView(context).apply {
            text = "...מקשיב לך"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
        }
        statusText = sText

        statusRow.addView(sText)
        statusRow.addView(dot)
        card.addView(statusRow)

        // Transcript scroll view
        val scroll = ScrollView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0, // weight-based
                1f
            ).apply { topMargin = dpToPx(12f).toInt() }
            isFillViewport = true
        }
        val tText = TextView(context).apply {
            text = ""
            setTextColor(Color.parseColor("#E0E0E0"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            textDirection = View.TEXT_DIRECTION_RTL
            textAlignment = View.TEXT_ALIGNMENT_VIEW_END
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            maxLines = 8
            ellipsize = TextUtils.TruncateAt.END
        }
        transcriptText = tText
        scroll.addView(tText)
        card.addView(scroll)

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
        } catch (_: Exception) {
            // Overlay permission may have been revoked
        }
    }

    fun hide() {
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: Exception) {}
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
                statusText?.text = "...מקשיב לך"
            }
            "processing" -> {
                dotBg.setColor(colorProcessing)
                statusText?.text = "...מעבד נתונים"
            }
            "speaking" -> {
                dotBg.setColor(colorSpeaking)
                statusText?.text = "הנה התשובה:"
            }
            else -> {
                dotBg.setColor(colorIdle)
                statusText?.text = "לחץ כדי להתחיל"
            }
        }
    }

    fun updateTranscript(text: String) {
        transcriptText?.text = text
    }

    private fun dpToPx(dp: Float): Float {
        return dp * Resources.getSystem().displayMetrics.density
    }
}
