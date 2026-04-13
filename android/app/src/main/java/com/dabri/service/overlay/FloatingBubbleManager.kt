package com.dabri.service.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ImageView
import android.widget.TextView
import com.dabri.R
import com.dabri.service.PipelineState

class FloatingBubbleManager(
    private val context: Context,
    private val onTap: () -> Unit,
    private val onLongPress: () -> Unit,
    private val onDismiss: () -> Unit = {}
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

    // Dismiss zone
    private var dismissZoneView: View? = null
    private var isDismissZoneShowing = false
    private val dismissZoneSizePx = dpToPx(48)
    private val dismissThresholdPx = dpToPx(80)

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

            // Default position: right edge, 1/3 down
            val metrics = getScreenMetrics()
            x = metrics.widthPixels - bubbleSizePx - dpToPx(8)
            y = metrics.heightPixels / 3
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
        hideDismissZone()
        try {
            bubbleView?.let { windowManager.removeView(it) }
        } catch (_: Exception) { }
        bubbleView = null
        isShowing = false
    }

    fun updateState(state: PipelineState) {
        if (!isShowing) return
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
                    showDismissZone()
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
                    if (isBubbleInDismissZone()) {
                        hideDismissZone()
                        onDismiss()
                    } else {
                        hideDismissZone()
                        snapToEdge()
                    }
                }
                return true
            }
        }
        return false
    }

    private fun showDismissZone() {
        if (isDismissZoneShowing) return
        try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            val view = TextView(context).apply {
                text = "\u2715"
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                setTextColor(Color.WHITE)
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                val bg = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(Color.parseColor("#99000000"))
                }
                background = bg
            }

            val params = WindowManager.LayoutParams(
                dismissZoneSizePx,
                dismissZoneSizePx,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                y = dpToPx(48)
            }

            windowManager.addView(view, params)
            dismissZoneView = view
            isDismissZoneShowing = true
        } catch (e: Exception) {
            android.util.Log.e("FloatingBubble", "Failed to show dismiss zone", e)
        }
    }

    private fun hideDismissZone() {
        if (!isDismissZoneShowing) return
        try {
            dismissZoneView?.let { windowManager.removeView(it) }
        } catch (_: Exception) { }
        dismissZoneView = null
        isDismissZoneShowing = false
    }

    private fun isBubbleInDismissZone(): Boolean {
        val metrics = getScreenMetrics()
        val bubbleCenterX = layoutParams.x + bubbleSizePx / 2
        val bubbleCenterY = layoutParams.y + bubbleSizePx / 2

        // Dismiss zone is at bottom center
        val dismissCenterX = metrics.widthPixels / 2
        val dismissCenterY = metrics.heightPixels - dpToPx(48) - dismissZoneSizePx / 2

        val dx = bubbleCenterX - dismissCenterX
        val dy = bubbleCenterY - dismissCenterY
        val distance = Math.sqrt((dx * dx + dy * dy).toDouble())

        return distance < dismissThresholdPx
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
