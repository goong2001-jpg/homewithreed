package com.homewithreed.fileswipe

import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import java.io.File

class Item(
    val path: String,
    val name: String,
    val mime: String,
    val size: Long,
    val modified: Long,
    val folder: String,
) {
    val isVideo get() = mime.startsWith("video/")
    val previewable get() = mime.startsWith("image/") || isVideo || mime == "application/pdf"
    val ext get() = name.substringAfterLast('.', "").uppercase().ifEmpty { "파일" }
}

class Source(val id: String, val title: String, val match: (String) -> Boolean)

/** 폰 안의 파일 목록. MediaStore 색인을 읽기만 한다. */
object Repo {
    const val OUT = "파일정리"
    val root: File get() = Environment.getExternalStorageDirectory()

    @Volatile var items: List<Item> = emptyList()
    @Volatile var scanned = false

    val presets = listOf(
        Source("p:shot", "스크린샷·화면녹화") {
            it.contains("Screenshots", true) || it.contains("Screen recordings", true)
        },
        Source("p:kakao", "카카오톡에서 받은 것") { it.contains("KakaoTalk", true) },
        Source("p:down", "다운로드") { it.startsWith("Download", true) && !it.contains("KakaoTalk", true) },
        Source("p:camera", "카메라") { it.startsWith("DCIM/Camera", true) },
    )

    fun folderSource(folder: String) = Source("f:$folder", folder.ifEmpty { "(맨 위 폴더)" }) { it == folder }

    fun source(id: String): Source =
        presets.firstOrNull { it.id == id } ?: folderSource(id.removePrefix("f:"))

    private fun rel(path: String): String {
        val r = root.absolutePath + "/"
        return if (path.startsWith(r)) path.removePrefix(r) else path
    }

    fun scan(ctx: Context): List<Item> {
        val out = ArrayList<Item>()
        val proj = arrayOf(
            MediaStore.MediaColumns.DATA,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.MIME_TYPE,
        )
        ctx.contentResolver.query(
            MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL),
            proj,
            "${MediaStore.MediaColumns.MIME_TYPE} IS NOT NULL AND ${MediaStore.MediaColumns.SIZE} > 0",
            null,
            null,
        )?.use { c ->
            while (c.moveToNext()) {
                val path = c.getString(0) ?: continue
                val rel = rel(path)
                if (rel.startsWith("Android/") || rel.startsWith("$OUT/")) continue
                if (rel.startsWith(".") || rel.contains("/.")) continue
                val name = c.getString(1) ?: path.substringAfterLast('/')
                out.add(Item(path, name, c.getString(4) ?: "", c.getLong(2), c.getLong(3) * 1000, rel.substringBeforeLast('/', "")))
            }
        }
        items = out
        scanned = true
        return out
    }

    /** 아직 결정하지 않은 파일만, 정해둔 순서로. */
    fun queue(src: Source): List<Item> {
        val list = items.filter { src.match(it.folder) && !Store.decisions.containsKey(it.path) && File(it.path).exists() }
        return if (Store.newestFirst) list.sortedByDescending { it.modified } else list.sortedBy { it.modified }
    }

    /** [남은 개수, 전체 개수] */
    fun counts(src: Source): IntArray {
        val r = IntArray(2)
        for (it in items) if (src.match(it.folder)) {
            r[1]++
            if (!Store.decisions.containsKey(it.path)) r[0]++
        }
        return r
    }

    /** 폴더별 [남은 개수, 전체 개수], 파일 많은 폴더부터. */
    fun folderStats(): List<Pair<String, IntArray>> {
        val m = HashMap<String, IntArray>()
        for (it in items) {
            val r = m.getOrPut(it.folder) { IntArray(2) }
            r[1]++
            if (!Store.decisions.containsKey(it.path)) r[0]++
        }
        return m.toList().sortedByDescending { it.second[1] }
    }
}
