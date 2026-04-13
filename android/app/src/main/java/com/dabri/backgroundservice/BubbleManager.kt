package com.dabri.backgroundservice

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Resources
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.core.content.ContextCompat
import com.dabri.R
import kotlin.math.abs

class BubbleManager(
    private val context: Context,
    private val onBubbleTapped: () -> Unit,
    private val onBubbleLongPressed: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var bubbleView: FrameLayout? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var pulseAnimator: ObjectAnimator? = null

    // Touch tracking
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private var lastTapTime = 0L
    private var longPressHandler: Handler? = null
    private var longPressRunnable: Runnable? = null

    // Colors for states
    private val colorIdle = 0xFF1565C0.toInt()
    private val colorListening = 0xFFF44336.toInt()
    private val colorProcessing = 0xFFFF9800.toInt()
    private val colorPaused = 0xFF9E9E9E.toInt()
    private val colorSpeaking = 0xFF4CAF50.toInt()

    companion object {
        private const val BUBBLE_SIZE_DP = 56
        private const val DRAG_THRESHOLD_DP = 10
        private const val TAP_DEBOUNCE_MS = 500L
        private const val LONG_PRESS_MS = 600L
        private const val SNAP_DURATION_MS = 250L
    }

    fun show() {
        if (bubbleView != null) return

        val bubbleSizePx = dpToPx(BUBBLE_SIZE_DP)

        // Create bubble view
        val bubble = FrameLayout(context).apply {
            val bg = ContextCompat.getDrawable(context, R.drawable.bubble_background)
            bg?.setTint(colorIdle)
            background = bg
            elevation = dpToPx(8).toFloat()

            val icon = ImageView(context).apply {
                setImageResource(R.drawable.ic_bubble)
                val iconSize = dpToPx(24)
                layoutParams = FrameLayout.LayoutParams(iconSize, iconSize).apply {
                    gravity = Gravity.CENTER
                }
            }
            addView(icon)
        }

        // Window params
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

            // Start at right edge, vertically centered
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
        } catch (e: Exception) {
            // Permission may have been revoked
        }
    }

    fun hide() {
        stopPulseAnimation()
        bubbleView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: Exception) {}
        }
        bubbleView = null
        layoutParams = null
    }

    fun isShowing(): Boolean = bubbleView != null

    fun updateState(state: String) {
        val bg = bubbleView?.background ?: return
        val color = when (state) {
            "listening" -> colorListening
            "processing" -> colorProcessing
            "speaking" -> colorSpeaking
            "paused" -> colorPaused
            else -> colorIdle
        }
        bg.setTint(color)
    }

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

                    // Start long press timer
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
                    }

                    if (isDragging) {
                        params.x = initialX + dx.toInt()
                        params.y = initialY + dy.toInt()
                        try {
                            windowManager.updateViewLayout(bubble, params)
                        } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    longPressHandler?.removeCallbacks(longPressRunnable!!)

                    if (isDragging) {
                        snapToEdge(params, bubble)
                        startPulseAnimation()
                    } else {
                        // Tap — debounce
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

        val targetX = if (centerX < screenWidth / 2) {
            0 // Snap left
        } else {
            screenWidth - bubbleWidth // Snap right
        }

        val animator = ValueAnimator.ofInt(params.x, targetX).apply {
            duration = SNAP_DURATION_MS
            addUpdateListener { anim ->
                params.x = anim.animatedValue as Int
                try {
                    windowManager.updateViewLayout(bubble, params)
                } catch (_: Exception) {}
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
