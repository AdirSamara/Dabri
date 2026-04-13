package com.dabri.service.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ImageView
import com.dabri.R
import com.dabri.service.PipelineState
import com.dabri.service.config.ServicePreferences

class FloatingBubbleManager(
    private val context: Context,
    private val preferences: ServicePreferences,
    private val onTap: () -> Unit,
    private val onLongPress: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var bubbleView: ImageView? = null
    private var isShowing = false

    private val bubbleSizePx = dpToPx(56)
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

    // Touch state
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false

    private val layoutParams: WindowManager.LayoutParams by lazy {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        WindowManager.LayoutParams(
            bubbleSizePx,
            bubbleSizePx,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START

            // Restore saved position or use default
            val savedX = preferences.bubbleX
            val savedY = preferences.bubbleY
            if (savedX >= 0 && savedY >= 0) {
                x = savedX
                y = savedY
            } else {
                val metrics = getScreenMetrics()
                x = metrics.widthPixels - bubbleSizePx - dpToPx(8)
                y = metrics.heightPixels / 3
            }
        }
    }

    fun show() {
        if (isShowing) return
        if (!OverlayPermissionHelper.canDrawOverlays(context)) return

        try {
            val view = ImageView(context).apply {
                setImageResource(R.mipmap.ic_launcher_round)
                scaleType = ImageView.ScaleType.CENTER_CROP
                alpha = 0.9f
                elevation = dpToPx(6).toFloat()

                setOnTouchListener { _, event -> handleTouch(event) }
            }

            windowManager.addView(view, layoutParams)
            bubbleView = view
            isShowing = true
        } catch (e: Exception) {
            android.util.Log.e("FloatingBubble", "Failed to show bubble", e)
        }
    }

    fun hide() {
        if (!isShowing) return
        try {
            bubbleView?.let { windowManager.removeView(it) }
        } catch (_: Exception) { }
        bubbleView = null
        isShowing = false
    }

    fun updateState(state: PipelineState) {
        bubbleView?.let { view ->
            view.post {
                when (state) {
                    PipelineState.IDLE, PipelineState.DEGRADED -> {
                        view.alpha = 0.9f
                        view.clearAnimation()
                    }
                    PipelineState.RECOGNIZING -> {
                        view.alpha = 1.0f
                        startPulseAnimation(view, 600)
                    }
                    PipelineState.PARSING, PipelineState.EXECUTING -> {
                        view.alpha = 1.0f
                        startPulseAnimation(view, 400)
                    }
                    PipelineState.SPEAKING -> {
                        view.alpha = 1.0f
                        startPulseAnimation(view, 900)
                    }
                    PipelineState.PAUSED, PipelineState.PHONE_CALL_PAUSED -> {
                        view.alpha = 0.5f
                        view.clearAnimation()
                    }
                    PipelineState.ERROR -> {
                        view.alpha = 0.7f
                        view.clearAnimation()
                    }
                }
            }
        }
    }

    private fun startPulseAnimation(view: View, durationMs: Long) {
        val animator = ValueAnimator.ofFloat(1.0f, 1.15f, 1.0f).apply {
            duration = durationMs
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { animation ->
                val scale = animation.animatedValue as Float
                view.scaleX = scale
                view.scaleY = scale
            }
        }
        view.tag = animator
        animator.start()
    }

    private fun handleTouch(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                initialX = layoutParams.x
                initialY = layoutParams.y
                initialTouchX = event.rawX
                initialTouchY = event.rawY
                isDragging = false
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.rawX - initialTouchX
                val dy = event.rawY - initialTouchY

                if (!isDragging && (Math.abs(dx) > touchSlop || Math.abs(dy) > touchSlop)) {
                    isDragging = true
                }

                if (isDragging) {
                    layoutParams.x = initialX + dx.toInt()
                    layoutParams.y = initialY + dy.toInt()
                    try {
                        windowManager.updateViewLayout(bubbleView, layoutParams)
                    } catch (_: Exception) { }
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (!isDragging) {
                    onTap()
                } else {
                    snapToEdge()
                    // Save position
                    preferences.bubbleX = layoutParams.x
                    preferences.bubbleY = layoutParams.y
                }
                return true
            }
        }
        return false
    }

    private fun snapToEdge() {
        val metrics = getScreenMetrics()
        val screenWidth = metrics.widthPixels
        val currentX = layoutParams.x
        val margin = dpToPx(4)

        val targetX = if (currentX + bubbleSizePx / 2 < screenWidth / 2) {
            margin // Snap to left
        } else {
            screenWidth - bubbleSizePx - margin // Snap to right
        }

        val animator = ValueAnimator.ofInt(currentX, targetX).apply {
            duration = 200
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { animation ->
                layoutParams.x = animation.animatedValue as Int
                try {
                    windowManager.updateViewLayout(bubbleView, layoutParams)
                } catch (_: Exception) { }
            }
        }
        animator.start()
    }

    fun getPosition(): Pair<Int, Int> {
        return Pair(layoutParams.x, layoutParams.y)
    }

    private fun getScreenMetrics(): DisplayMetrics {
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getMetrics(metrics)
        return metrics
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * context.resources.displayMetrics.density).toInt()
    }
}
