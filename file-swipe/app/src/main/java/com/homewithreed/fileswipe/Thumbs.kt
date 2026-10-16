package com.homewithreed.fileswipe

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.pdf.PdfRenderer
import android.media.ThumbnailUtils
import android.os.ParcelFileDescriptor
import android.util.LruCache
import android.util.Size
import android.widget.ImageView
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.max

/** 미리보기 그림을 뒤에서 만들고, 최근 것은 메모리에 잠깐 둔다. */
object Thumbs {
    private val pool = Executors.newFixedThreadPool(3)
    private val cache = object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 1024 / 6).toInt()) {
        override fun sizeOf(key: String, value: Bitmap) = value.allocationByteCount / 1024
    }

    fun load(view: ImageView, path: String, mime: String, px: Int, done: ((Bitmap?) -> Unit)? = null) {
        val key = "$px|$path"
        view.tag = key
        cache.get(key)?.let {
            view.setImageBitmap(it)
            done?.invoke(it)
            return
        }
        view.setImageDrawable(null)
        pool.execute {
            val bmp = decode(path, mime, px)
            if (bmp != null) cache.put(key, bmp)
            mainHandler.post {
                if (view.tag == key) {
                    view.setImageBitmap(bmp)
                    done?.invoke(bmp)
                }
            }
        }
    }

    fun prefetch(path: String, mime: String, px: Int) {
        val key = "$px|$path"
        if (cache.get(key) != null) return
        pool.execute { decode(path, mime, px)?.let { cache.put(key, it) } }
    }

    private fun decode(path: String, mime: String, px: Int): Bitmap? = try {
        when {
            mime.startsWith("image/") ->
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(File(path))) { d, info, _ ->
                    val w = info.size.width
                    val h = info.size.height
                    val scale = max(w, h).toFloat() / px
                    if (scale > 1f) d.setTargetSize(max(1, (w / scale).toInt()), max(1, (h / scale).toInt()))
                    d.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                }
            mime.startsWith("video/") ->
                ThumbnailUtils.createVideoThumbnail(File(path), Size(px, px), null)
            mime == "application/pdf" -> pdfFirstPage(path, px)
            else -> null
        }
    } catch (e: Throwable) {
        null
    }

    private fun pdfFirstPage(path: String, px: Int): Bitmap? =
        ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
            PdfRenderer(fd).use { r ->
                if (r.pageCount == 0) return null
                r.openPage(0).use { page ->
                    val scale = px.toFloat() / max(page.width, page.height)
                    val bmp = Bitmap.createBitmap(
                        max(1, (page.width * scale).toInt()),
                        max(1, (page.height * scale).toInt()),
                        Bitmap.Config.ARGB_8888,
                    )
                    bmp.eraseColor(Color.WHITE)
                    page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    bmp
                }
            }
        }
}
