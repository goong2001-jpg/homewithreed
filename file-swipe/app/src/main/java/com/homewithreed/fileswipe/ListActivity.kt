package com.homewithreed.fileswipe

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.FrameLayout
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File

/** 정리 대기(분류별·삭제 대기)와 휴지통을 바둑판으로 보여준다. */
class ListActivity : Activity() {

    companion object {
        const val EXTRA_MODE = "mode"
        const val EXTRA_CAT = "cat"
        const val MODE_KEEP = "keep"
        const val MODE_WAIT = "wait"
        const val MODE_TRASH = "trash"
    }

    private class Entry(val path: String, val mime: String, val trash: TrashEntry?)

    private class Cell(ctx: Context) : FrameLayout(ctx) {
        val ext = TextView(ctx).apply {
            gravity = Gravity.CENTER
            setTextColor(Pal.SUB)
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
        }
        val img = ImageView(ctx).apply { scaleType = ImageView.ScaleType.CENTER_CROP }

        init {
            setBackgroundColor(Pal.LINE)
            addView(ext, FrameLayout.LayoutParams(MATCH, MATCH))
            addView(img, FrameLayout.LayoutParams(MATCH, MATCH))
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            super.onMeasure(widthMeasureSpec, widthMeasureSpec)
        }
    }

    private lateinit var mode: String
    private var cat: String? = null
    private var entries: List<Entry> = emptyList()
    private lateinit var title: TextView
    private lateinit var sub: TextView
    private lateinit var actions: LinearLayout
    private var cellPx = 300

    private val gridAdapter = object : BaseAdapter() {
        override fun getCount() = entries.size
        override fun getItem(position: Int): Any = entries[position]
        override fun getItemId(position: Int) = position.toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val cell = convertView as? Cell ?: Cell(this@ListActivity)
            val e = entries[position]
            cell.ext.text = e.path.substringAfterLast('.', "").uppercase()
            Thumbs.load(cell.img, e.path, e.mime, cellPx)
            return cell
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(this)
        mode = intent.getStringExtra(EXTRA_MODE) ?: MODE_TRASH
        cat = intent.getStringExtra(EXTRA_CAT)
        cellPx = resources.displayMetrics.widthPixels / 3

        val col = vbox().apply {
            setBackgroundColor(Pal.BG)
            setPadding(dp(14), dp(14), dp(14), 0)
        }
        val top = hbox()
        top.addView(label("‹", 28f, Pal.INK).apply {
            setPadding(dp(6), 0, dp(16), 0)
            setOnClickListener { finish() }
        })
        title = label("", 19f, Pal.INK, true)
        top.addView(title, lp(0, WRAP, 1f))
        col.addView(top, lp())
        sub = label("", 13f, Pal.SUB).apply { setPadding(dp(4), dp(4), 0, 0) }
        col.addView(sub, lp())
        actions = hbox()
        col.addView(actions, lp().margins(0, dp(10), 0, dp(10)))

        val grid = GridView(this).apply {
            numColumns = 3
            horizontalSpacing = dp(3)
            verticalSpacing = dp(3)
            stretchMode = GridView.STRETCH_COLUMN_WIDTH
            adapter = gridAdapter
            setOnItemClickListener { _, _, position, _ -> tap(entries[position]) }
        }
        col.addView(grid, lp(MATCH, 0, 1f))
        setContentView(col)
        reload()
    }

    private fun reload() {
        entries = when (mode) {
            MODE_TRASH -> {
                val dir = Ops.trashDir()
                Store.trash.sortedByDescending { it.time }.map { Entry(File(dir, it.name).path, mimeOf(it.name), it) }
            }
            else -> Store.decisions
                .filter { (_, d) -> if (mode == MODE_WAIT) d.isTrash else !d.isTrash && d.cat == cat }
                .toList()
                .sortedByDescending { it.second.time }
                .map { Entry(it.first, mimeOf(it.first), null) }
        }
        title.text = when (mode) {
            MODE_TRASH -> "휴지통 ${entries.size}개"
            MODE_WAIT -> "삭제 대기 ${entries.size}개"
            else -> "$cat ${entries.size}개"
        }
        sub.text = when (mode) {
            MODE_TRASH -> "탭하면 열어보거나 되살릴 수 있어요"
            else -> "탭하면 열어보거나 표시를 취소할 수 있어요"
        }
        actions.removeAllViews()
        if (mode == MODE_TRASH && entries.isNotEmpty()) {
            actions.addView(pill("전부 되살리기", Pal.INK) { confirmRestoreAll() }, lp(0, WRAP, 1f).margins(0, 0, dp(6), 0))
            actions.addView(pill("전부 비우기", Pal.TRASH) { confirmPurgeAll() }, lp(0, WRAP, 1f).margins(dp(6), 0, 0, 0))
        }
        gridAdapter.notifyDataSetChanged()
    }

    private fun tap(e: Entry) {
        val t = e.trash
        val options = if (mode == MODE_TRASH) arrayOf("열어보기", "되살리기") else arrayOf("열어보기", "표시 취소 (그대로 두기)")
        AlertDialog.Builder(this)
            .setTitle(e.path.substringAfterLast('/'))
            .setItems(options) { _, which ->
                when {
                    which == 0 -> openFile(e.path, e.mime)
                    t != null -> runBusy("되살리는 중…", {
                        if (Ops.restore(this, listOf(t))[0] > 0) "원래 자리로 되살렸어요" else "되살리지 못했어요"
                    }) { reload() }
                    else -> {
                        Store.decisions.remove(e.path)
                        Store.save()
                        reload()
                    }
                }
            }
            .show()
    }

    private fun confirmRestoreAll() {
        val all = Store.trash.toList()
        AlertDialog.Builder(this)
            .setTitle("${all.size}개 전부 되살리기")
            .setMessage("모두 원래 있던 폴더로 돌아가요.")
            .setPositiveButton("되살리기") { _, _ ->
                runBusy("되살리는 중…", { "${Ops.restore(this, all)[0]}개를 되살렸어요" }) { reload() }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun confirmPurgeAll() {
        val all = Store.trash.toList()
        AlertDialog.Builder(this)
            .setTitle("${all.size}개 완전히 지우기")
            .setMessage("지우면 되살릴 수 없어요.")
            .setPositiveButton("지우기") { _, _ ->
                runBusy("지우는 중…", { "${Ops.purge(all)}개를 지웠어요" }) { reload() }
            }
            .setNegativeButton("취소", null)
            .show()
    }
}
