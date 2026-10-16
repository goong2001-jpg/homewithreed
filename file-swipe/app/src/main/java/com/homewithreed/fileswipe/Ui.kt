package com.homewithreed.fileswipe

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.MimeTypeMap
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object Pal {
    const val BG = 0xFFF6F1EA.toInt()
    const val INK = 0xFF2B2620.toInt()
    const val SUB = 0xFF7A6F63.toInt()
    const val LINE = 0xFFE4DACD.toInt()
    const val CHIP = 0xFFEBE2D6.toInt()
    const val ACCENT = 0xFFC8643B.toInt()
    const val ACCENT_LIGHT = 0xFFE58A5C.toInt()
    const val KEEP = 0xFF3E7C5A.toInt()
    const val TRASH = 0xFFB5442E.toInt()
    const val DARK = 0xFF1C1A17.toInt()
    const val DARK2 = 0xFF2E2A25.toInt()
    const val MUTED_DARK = 0xFFA89E92.toInt()
    const val WHITE = 0xFFFFFFFF.toInt()
}

const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
const val HOUR = 60L * 60 * 1000
const val DAY = 24 * HOUR

val mainHandler = Handler(Looper.getMainLooper())

fun Context.dp(v: Int): Int = (v * resources.displayMetrics.density + 0.5f).toInt()

fun rounded(color: Int, radius: Int): GradientDrawable =
    GradientDrawable().apply { cornerRadius = radius.toFloat(); setColor(color) }

fun Context.label(s: CharSequence, sp: Float = 15f, color: Int = Pal.INK, bold: Boolean = false): TextView =
    TextView(this).apply {
        text = s
        textSize = sp
        setTextColor(color)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

fun Context.pill(s: CharSequence, bg: Int, fg: Int = Pal.WHITE, onClick: (View) -> Unit): TextView =
    label(s, 15f, fg, true).apply {
        gravity = Gravity.CENTER
        setPadding(dp(14), dp(11), dp(14), dp(11))
        background = rounded(bg, dp(8))
        setOnClickListener { onClick(it) }
    }

fun Context.vbox(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

fun Context.hbox(): LinearLayout = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
}

fun lp(w: Int = MATCH, h: Int = WRAP, weight: Float = 0f) = LinearLayout.LayoutParams(w, h, weight)

fun LinearLayout.LayoutParams.margins(l: Int, t: Int, r: Int, b: Int): LinearLayout.LayoutParams =
    apply { setMargins(l, t, r, b) }

fun Context.toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()

fun fmtSize(b: Long): String = when {
    b >= 1L shl 30 -> "%.1fGB".format(b / 1073741824.0)
    b >= 1L shl 20 -> "%.1fMB".format(b / 1048576.0)
    b >= 1024 -> "${b / 1024}KB"
    else -> "${b}B"
}

fun fmtDate(ms: Long): String = SimpleDateFormat("yyyy.MM.dd", Locale.KOREA).format(Date(ms))

fun mimeOf(name: String): String =
    MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase()) ?: ""

fun Context.openFile(path: String, mime: String) {
    try {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", File(path))
        startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, mime.ifEmpty { "*/*" })
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        )
    } catch (e: Exception) {
        toast("이 파일을 열 수 있는 앱이 없어요")
    }
}

fun Context.openUrl(url: String) {
    try {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (e: Exception) {
        toast("브라우저를 열 수 없어요")
    }
}

// 파일을 옮기는 동안 화면을 막아두고, 끝나면 결과를 저장·안내한다.
fun Activity.runBusy(message: String, work: () -> String, after: () -> Unit) {
    val dialog = AlertDialog.Builder(this).setMessage(message).setCancelable(false).show()
    Thread {
        val result = try {
            work()
        } catch (e: Exception) {
            "오류: ${e.message}"
        }
        mainHandler.post {
            Store.save()
            if (!isFinishing) {
                dialog.dismiss()
                toast(result)
                after()
            }
        }
    }.start()
}
