package com.homewithreed.fileswipe

import android.content.Context
import android.media.MediaScannerConnection
import java.io.File

/** 실제로 파일을 옮기는 곳. 사용자가 홈에서 버튼을 눌렀을 때만 불린다. */
object Ops {

    fun trashDir(): File {
        val d = File(Repo.root, "${Repo.OUT}/.휴지통")
        d.mkdirs()
        // 갤러리에 휴지통 사진이 앨범으로 뜨지 않게 한다.
        val nomedia = File(d, ".nomedia")
        if (!nomedia.exists()) nomedia.createNewFile()
        return d
    }

    private fun folderName(cat: String) = cat.replace('/', '-').trim().ifEmpty { "기타" }

    private fun unique(dir: File, name: String): File {
        var f = File(dir, name)
        if (!f.exists()) return f
        val base = name.substringBeforeLast('.')
        val ext = name.substringAfterLast('.', "")
        var n = 1
        while (true) {
            f = File(dir, if (ext.isEmpty()) "$base ($n)" else "$base ($n).$ext")
            if (!f.exists()) return f
            n++
        }
    }

    private fun move(src: File, dst: File): Boolean {
        dst.parentFile?.mkdirs()
        if (src.renameTo(dst)) return true
        return try {
            src.copyTo(dst)
            if (dst.length() == src.length()) {
                src.delete()
                true
            } else {
                dst.delete()
                false
            }
        } catch (e: Exception) {
            dst.delete()
            false
        }
    }

    // 갤러리·내 파일 앱이 바뀐 위치를 바로 알도록 색인을 갱신한다.
    private fun rescan(ctx: Context, paths: List<String>) {
        if (paths.isNotEmpty()) MediaScannerConnection.scanFile(ctx, paths.toTypedArray(), null, null)
    }

    /** 보관 분류를 '파일정리/분류' 폴더로 옮긴다. [성공, 실패] */
    fun keep(ctx: Context, cat: String, paths: List<String>): IntArray {
        val dir = File(Repo.root, "${Repo.OUT}/${folderName(cat)}")
        val r = IntArray(2)
        val scan = ArrayList<String>()
        for (p in paths) {
            val src = File(p)
            if (!src.exists()) {
                Store.decisions.remove(p)
                continue
            }
            val dst = unique(dir, src.name)
            if (move(src, dst)) {
                r[0]++
                Store.decisions.remove(p)
                scan.add(p)
                scan.add(dst.path)
            } else r[1]++
        }
        rescan(ctx, scan)
        return r
    }

    /** 삭제 대기를 앱 휴지통으로 옮긴다. 지우지는 않는다. [성공, 실패] */
    fun trash(ctx: Context, paths: List<String>): IntArray {
        val dir = trashDir()
        val r = IntArray(2)
        val scan = ArrayList<String>()
        val now = System.currentTimeMillis()
        for (p in paths) {
            val src = File(p)
            if (!src.exists()) {
                Store.decisions.remove(p)
                continue
            }
            val size = src.length()
            val dst = unique(dir, src.name)
            if (move(src, dst)) {
                r[0]++
                Store.decisions.remove(p)
                Store.trash.add(TrashEntry(dst.name, p, now, size))
                scan.add(p)
            } else r[1]++
        }
        rescan(ctx, scan)
        return r
    }

    /** 휴지통에서 원래 자리로 되돌린다. 같은 이름이 생겼으면 (1)을 붙인다. */
    fun restore(ctx: Context, entries: List<TrashEntry>): IntArray {
        val dir = trashDir()
        val r = IntArray(2)
        val scan = ArrayList<String>()
        for (e in entries) {
            val src = File(dir, e.name)
            if (!src.exists()) {
                Store.trash.remove(e)
                continue
            }
            val orig = File(e.orig)
            val dst = if (orig.exists()) unique(orig.parentFile ?: Repo.root, orig.name) else orig
            if (move(src, dst)) {
                r[0]++
                Store.trash.remove(e)
                scan.add(dst.path)
            } else r[1]++
        }
        rescan(ctx, scan)
        return r
    }

    /** 휴지통에서 완전히 지운다. 되돌릴 수 없다. */
    fun purge(entries: List<TrashEntry>): Int {
        val dir = trashDir()
        var n = 0
        for (e in entries) {
            val f = File(dir, e.name)
            if (!f.exists() || f.delete()) {
                Store.trash.remove(e)
                n++
            }
        }
        return n
    }
}
