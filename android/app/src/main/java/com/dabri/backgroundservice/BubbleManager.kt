package com.dabri.backgroundservice

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Resources
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import com.dabri.R
import kotlin.math.abs
import kotlin.math.sqrt

class BubbleManager(
    private val context: Context,
    private val onBubbleTapped: () -> Unit,
    private val onBubbleLongPressed: () -> Unit,
    private val onBubbleDismissed: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var bubbleView: FrameLayout? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var pulseAnimator: ObjectAnimator? = null

    // Dismiss zone
    private var dismissZoneView: FrameLayout? = null
    private var dismissZoneParams: WindowManager.LayoutParams? = null
    private var isNearDismissZone = false

    // Touch tracking
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private var lastTapTime = 0L
    private var longPressHandler: Handler? = null
    private var longPressRunnable: Runnable? = null

    companion object {
        private const val BUBBLE_SIZE_DP = 56
        private const val DRAG_THRESHOLD_DP = 10
        private const val TAP_DEBOUNCE_MS = 500L
        private const val LONG_PRESS_MS = 600L
        private const val SNAP_DURATION_MS = 250L
        private const val DISMISS_ZONE_SIZE_DP = 56
        private const val DISMISS_ZONE_RADIUS_DP = 60
    }

    fun show() {
        if (bubbleView != null) return

        val bubbleSizePx = dpToPx(BUBBLE_SIZE_DP)

        // Create bubble view with app icon
        val bubble = FrameLayout(context).apply {
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#1565C0"))
            }
            background = bg
            elevation = dpToPx(8).toFloat()

            val icon = ImageView(context).apply {
                setImageResource(R.drawable.ic_launcher_foreground)
                scaleType = ImageView.ScaleType.CENTER_INSIDE
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            addView(icon)
        }

        val params = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            format = PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            width = bubbleSizePx
            height = bubbleSizePx
            gravity = Gravity.TOP or Gravity.START

            val displayMetrics = Resources.getSystem().displayMetrics
            x = displayMetrics.widthPixels - bubbleSizePx
            y = displayMetrics.heightPixels / 2 - bubbleSizePx / 2
        }

        setupTouchListener(bubble, params)

        try {
            windowManager.addView(bubble, params)
            bubbleView = bubble
            layoutParams = params
            startPulseAnimation()
        } catch (_: Exception) {}
    }

    fun hide() {
        stopPulseAnimation()
        hideDismissZone()
        bubbleView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        bubbleView = null
        layoutParams = null
    }

    fun isShowing(): Boolean = bubbleView != null

    fun updateState(state: String) {
        val bg = bubbleView?.background as? GradientDrawable ?: return
        val color = when (state) {
            "listening" -> Color.parseColor("#C62828")
            "processing" -> Color.parseColor("#E65100")
            "speaking" -> Color.parseColor("#2E7D32")
            "paused" -> Color.parseColor("#9E9E9E")
            else -> Color.parseColor("#1565C0")
        }
        bg.setColor(color)
    }

    // ── Dismiss zone ────────────────────────────────────────────────

    private fun showDismissZone() {
        if (dismissZoneView != null) return

        val zoneSizePx = dpToPx(DISMISS_ZONE_SIZE_DP)
        val displayMetrics = Resources.getSystem().displayMetrics

        val zone = FrameLayout(context).apply {
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#CC333333"))
                setStroke(dpToPx(2), Color.parseColor("#CCFFFFFF"))
            }
            background = bg
            elevation = dpToPx(12).toFloat()

            val xText = TextView(context).apply {
                text = "✕"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            addView(xText)
        }

        val params = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            format = PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
            width = zoneSizePx
            height = zoneSizePx
            gravity = Gravity.TOP or Gravity.START
            x = displayMetrics.widthPixels / 2 - zoneSizePx / 2
            y = displayMetrics.heightPixels - zoneSizePx - dpToPx(60)
        }

        try {
            windowManager.addView(zone, params)
            dismissZoneView = zone
            dismissZoneParams = params
        } catch (_: Exception) {}
    }

    private fun hideDismissZone() {
        dismissZoneView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        dismissZoneView = null
        dismissZoneParams = null
        isNearDismissZone = false
    }

    private fun updateDismissZoneHighlight(bubbleX: Int, bubbleY: Int) {
        val displayMetrics = Resources.getSystem().displayMetrics
        val zoneSizePx = dpToPx(DISMISS_ZONE_SIZE_DP)
        val bubbleSizePx = dpToPx(BUBBLE_SIZE_DP)
        val radiusPx = dpToPx(DISMISS_ZONE_RADIUS_DP)

        val zoneCenterX = displayMetrics.widthPixels / 2
        val zoneCenterY = displayMetrics.heightPixels - zoneSizePx / 2 - dpToPx(60)
        val bubbleCenterX = bubbleX + bubbleSizePx / 2
        val bubbleCenterY = bubbleY + bubbleSizePx / 2

        val dx = (bubbleCenterX - zoneCenterX).toFloat()
        val dy = (bubbleCenterY - zoneCenterY).toFloat()
        val distance = sqrt(dx * dx + dy * dy)

        val nearNow = distance < radiusPx
        if (nearNow != isNearDismissZone) {
            isNearDismissZone = nearNow
            val bg = dismissZoneView?.background as? GradientDrawable ?: return
            if (nearNow) {
                bg.setColor(Color.parseColor("#EEF44336"))
                bg.setStroke(dpToPx(2), Color.WHITE)
            } else {
                bg.setColor(Color.parseColor("#CC333333"))
                bg.setStroke(dpToPx(2), Color.parseColor("#CCFFFFFF"))
            }
        }
    }

    // ── Touch handling ──────────────────────────────────────────────

    private fun setupTouchListener(bubble: FrameLayout, params: WindowManager.LayoutParams) {
        longPressHandler = Handler(Looper.getMainLooper())

        bubble.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false

                    longPressRunnable = Runnable {
                        if (!isDragging) {
                            onBubbleLongPressed()
                        }
                    }
                    longPressHandler?.postDelayed(longPressRunnable!!, LONG_PRESS_MS)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    val threshold = dpToPx(DRAG_THRESHOLD_DP)

                    if (!isDragging && (abs(dx) > threshold || abs(dy) > threshold)) {
                        isDragging = true
                        longPressHandler?.removeCallbacks(longPressRunnable!!)
                        stopPulseAnimation()
                        showDismissZone()
                    }

                    if (isDragging) {
                        params.x = initialX + dx.toInt()
                        params.y = initialY + dy.toInt()
                        try {
                            windowManager.updateViewLayout(bubble, params)
                        } catch (_: Exception) {}
                        updateDismissZoneHighlight(params.x, params.y)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    longPressHandler?.removeCallbacks(longPressRunnable!!)

                    if (isDragging) {
                        if (isNearDismissZone) {
                            hideDismissZone()
                            onBubbleDismissed()
                        } else {
                            hideDismissZone()
                            snapToEdge(params, bubble)
                            startPulseAnimation()
                        }
                    } else {
                        val now = System.currentTimeMillis()
                        if (now - lastTapTime > TAP_DEBOUNCE_MS) {
                            lastTapTime = now
                            onBubbleTapped()
                        }
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    longPressHandler?.removeCallbacks(longPressRunnable!!)
                    hideDismissZone()
                    if (isDragging) {
                        snapToEdge(params, bubble)
                        startPulseAnimation()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun snapToEdge(params: WindowManager.LayoutParams, bubble: View) {
        val screenWidth = Resources.getSystem().displayMetrics.widthPixels
        val bubbleWidth = dpToPx(BUBBLE_SIZE_DP)
        val centerX = params.x + bubbleWidth / 2

        val targetX = if (centerX < screenWidth / 2) 0 else screenWidth - bubbleWidth

        val animator = ValueAnimator.ofInt(params.x, targetX).apply {
            duration = SNAP_DURATION_MS
            addUpdateListener { anim ->
                params.x = anim.animatedValue as Int
                try { windowManager.updateViewLayout(bubble, params) } catch (_: Exception) {}
            }
        }
        animator.start()
    }

    private fun startPulseAnimation() {
        val view = bubbleView ?: return
        stopPulseAnimation()

        val scaleX = PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.05f, 1f)
        val scaleY = PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.05f, 1f)

        pulseAnimator = ObjectAnimator.ofPropertyValuesHolder(view, scaleX, scaleY).apply {
            duration = 2000
            repeatMode = ValueAnimator.RESTART
            repeatCount = ValueAnimator.INFINITE
            start()
        }
    }

    private fun stopPulseAnimation() {
        pulseAnimator?.cancel()
        pulseAnimator = null
        bubbleView?.scaleX = 1f
        bubbleView?.scaleY = 1f
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * Resources.getSystem().displayMetrics.density).toInt()
    }
}
