package com.homewithreed.fileswipe

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * 한 장씩 넘기며 표시하는 화면.
 * 위 = 보관(분류 고르기), 아래 = 삭제 대기, 왼쪽 = 이전, 오른쪽 = 다음.
 * 여기서는 기록만 하고 파일은 옮기지 않는다.
 */
class SwipeActivity : Activity() {

    companion object {
        const val EXTRA_SOURCE = "source"
        private const val H = 0.22f // 좌우로 이만큼(화면 폭 비율) 밀면 넘어간다
        private const val V = 0.14f // 위아래로 이만큼(화면 높이 비율) 밀면 결정된다
    }

    private class Step(val index: Int, val path: String, val before: Decision?)

    private lateinit var src: Source
    private var list: List<Item> = emptyList()
    private var index = 0
    private val steps = ArrayList<Step>()
    private var busy = false
    private var px = 1600
    private var slop = 16
    private var sx = 0f
    private var sy = 0f
    private var dragging = false

    private lateinit var progress: TextView
    private lateinit var stage: FrameLayout
    private lateinit var card: FrameLayout
    private lateinit var image: ImageView
    private lateinit var doc: LinearLayout
    private lateinit var docExt: TextView
    private lateinit var docName: TextView
    private lateinit var badge: TextView
    private lateinit var play: TextView
    private lateinit var hint: TextView
    private lateinit var info: TextView
    private lateinit var catPanel: LinearLayout
    private lateinit var endPanel: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(this)
        src = Repo.source(intent.getStringExtra(EXTRA_SOURCE) ?: Repo.presets[0].id)
        val dm = resources.displayMetrics
        px = min(max(dm.widthPixels, dm.heightPixels), 2048)
        slop = ViewConfiguration.get(this).scaledTouchSlop
        buildUi()
        if (Repo.scanned) {
            load()
        } else {
            progress.text = "불러오는 중…"
            Thread {
                Repo.scan(this)
                mainHandler.post { if (!isFinishing) load() }
            }.start()
        }
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply { setBackgroundColor(Pal.DARK) }
        val col = vbox()
        root.addView(col, FrameLayout.LayoutParams(MATCH, MATCH))

        val top = hbox().apply { setPadding(dp(6), dp(8), dp(8), dp(4)) }
        top.addView(label("✕", 20f, Pal.WHITE).apply {
            setPadding(dp(14), dp(8), dp(14), dp(8))
            setOnClickListener { finish() }
        })
        val titles = vbox()
        titles.addView(label(src.title, 16f, Pal.WHITE, true).apply { maxLines = 1 })
        progress = label("", 13f, Pal.MUTED_DARK)
        titles.addView(progress)
        top.addView(titles, lp(0, WRAP, 1f))
        top.addView(label("되돌리기", 14f, Pal.ACCENT_LIGHT, true).apply {
            setPadding(dp(12), dp(8), dp(12), dp(8))
            setOnClickListener { undo() }
        })
        col.addView(top, lp())

        stage = FrameLayout(this)
        card = FrameLayout(this)
        image = ImageView(this).apply { scaleType = ImageView.ScaleType.FIT_CENTER }
        card.addView(image, FrameLayout.LayoutParams(MATCH, MATCH))

        doc = vbox().apply {
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(32), dp(24), dp(32))
            background = rounded(Pal.DARK2, dp(12))
        }
        docExt = label("", 40f, Pal.ACCENT_LIGHT, true).apply { gravity = Gravity.CENTER }
        docName = label("", 15f, Pal.WHITE).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(8))
        }
        doc.addView(docExt, lp())
        doc.addView(docName, lp())
        doc.addView(label("탭하면 다른 앱으로 열어요", 13f, Pal.MUTED_DARK).apply { gravity = Gravity.CENTER }, lp())
        card.addView(doc, FrameLayout.LayoutParams(MATCH, WRAP, Gravity.CENTER).apply { setMargins(dp(20), 0, dp(20), 0) })

        play = label("▶", 44f, Pal.WHITE).apply { setShadowLayer(10f, 0f, 0f, Pal.DARK) }
        card.addView(play, FrameLayout.LayoutParams(WRAP, WRAP, Gravity.CENTER))
        badge = label("", 13f, Pal.WHITE, true).apply { setPadding(dp(10), dp(5), dp(10), dp(5)) }
        card.addView(badge, FrameLayout.LayoutParams(WRAP, WRAP, Gravity.TOP or Gravity.START).apply { setMargins(dp(10), dp(10), 0, 0) })

        stage.addView(card, FrameLayout.LayoutParams(MATCH, MATCH).apply { setMargins(dp(12), dp(4), dp(12), dp(4)) })
        hint = label("", 22f, Pal.WHITE, true).apply {
            setPadding(dp(18), dp(10), dp(18), dp(10))
            alpha = 0f
        }
        stage.addView(hint, FrameLayout.LayoutParams(WRAP, WRAP, Gravity.CENTER))
        stage.setOnTouchListener { _, e ->
            onTouch(e)
            true
        }
        col.addView(stage, lp(MATCH, 0, 1f))

        info = label("", 13f, Pal.MUTED_DARK).apply {
            setPadding(dp(20), dp(6), dp(20), dp(8))
            maxLines = 2
        }
        col.addView(info, lp())

        val buttons = hbox().apply { setPadding(dp(10), 0, dp(10), dp(16)) }
        fun add(text: String, color: Int, action: () -> Unit) {
            val b = pill(text, color) { if (!busy) action() }.apply {
                textSize = 14f
                setPadding(0, dp(13), 0, dp(13))
            }
            buttons.addView(b, lp(0, WRAP, 1f).margins(dp(4), 0, dp(4), 0))
        }
        add("← 이전", Pal.DARK2) { goPrev() }
        add("↓ 삭제", Pal.TRASH) { trash() }
        add("↑ 보관", Pal.KEEP) { askKeep() }
        add("다음 →", Pal.DARK2) { goNext() }
        col.addView(buttons, lp())

        catPanel = vbox().apply {
            setPadding(dp(18), dp(20), dp(18), dp(24))
            background = rounded(Pal.DARK2, dp(16))
            visibility = View.GONE
            isClickable = true
        }
        root.addView(catPanel, FrameLayout.LayoutParams(MATCH, WRAP, Gravity.BOTTOM))

        endPanel = vbox().apply {
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Pal.DARK)
            visibility = View.GONE
            isClickable = true
        }
        root.addView(endPanel, FrameLayout.LayoutParams(MATCH, MATCH))

        setContentView(root)
    }

    /** 남은 파일 목록을 만들고, 지난번에 보던 파일부터 연다. */
    private fun load() {
        list = Repo.queue(src)
        steps.clear()
        val s = Store.sessions[src.id]
        val at = s?.last?.let { p -> list.indexOfFirst { it.path == p } } ?: -1
        index = if (at >= 0) at else (s?.index ?: 0).coerceIn(0, max(0, list.size - 1))
        if (list.isEmpty()) showEnd() else show()
    }

    private fun show() {
        endPanel.visibility = View.GONE
        val it = list[index]
        card.animate().cancel()
        card.translationX = 0f
        card.translationY = 0f
        card.rotation = 0f
        card.alpha = 1f
        progress.text = "${index + 1} / ${list.size}"
        info.text = "${it.name}\n${fmtDate(it.modified)} · ${fmtSize(it.size)} · ${it.folder.ifEmpty { "/" }}"

        val d = Store.decisions[it.path]
        if (d == null) {
            badge.visibility = View.GONE
        } else {
            badge.visibility = View.VISIBLE
            badge.text = if (d.isTrash) "삭제 대기" else "보관 · ${d.cat}"
            badge.background = rounded(if (d.isTrash) Pal.TRASH else Pal.KEEP, dp(6))
        }

        if (it.previewable) {
            doc.visibility = View.GONE
            image.visibility = View.VISIBLE
            play.visibility = if (it.isVideo) View.VISIBLE else View.GONE
            Thumbs.load(image, it.path, it.mime, px) { bmp ->
                if (bmp == null && list.getOrNull(index)?.path == it.path) showDoc(it)
            }
        } else {
            showDoc(it)
        }
        list.getOrNull(index + 1)?.let { n -> if (n.previewable) Thumbs.prefetch(n.path, n.mime, px) }

        Store.sessions[src.id] = Session(it.path, index)
        Store.save()
    }

    private fun showDoc(it: Item) {
        image.visibility = View.GONE
        play.visibility = View.GONE
        doc.visibility = View.VISIBLE
        docExt.text = it.ext
        docName.text = it.name
    }

    private fun onTouch(e: MotionEvent) {
        if (busy || index !in list.indices || catPanel.visibility == View.VISIBLE) return
        val dx = e.rawX - sx
        val dy = e.rawY - sy
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                sx = e.rawX
                sy = e.rawY
                dragging = false
            }
            MotionEvent.ACTION_MOVE -> {
                if (!dragging && hypot(dx, dy) > slop) dragging = true
                if (dragging) drag(dx, dy)
            }
            MotionEvent.ACTION_UP -> if (dragging) release(dx, dy) else list[index].let { openFile(it.path, it.mime) }
            MotionEvent.ACTION_CANCEL -> snapBack()
        }
    }

    private fun drag(dx: Float, dy: Float) {
        card.translationX = dx
        card.translationY = dy
        card.rotation = (dx / 25f).coerceIn(-12f, 12f)
        val horizontal = abs(dx) > abs(dy)
        val text: String
        val color: Int
        val need: Float
        when {
            horizontal && dx > 0 -> { text = "다음 →"; color = Pal.DARK2; need = stage.width * H }
            horizontal -> { text = "← 이전"; color = Pal.DARK2; need = stage.width * H }
            dy < 0 -> { text = "↑ 보관"; color = Pal.KEEP; need = stage.height * V }
            else -> { text = "↓ 삭제 대기"; color = Pal.TRASH; need = stage.height * V }
        }
        hint.text = text
        hint.background = rounded(color, dp(10))
        hint.alpha = (hypot(dx, dy) / need).coerceIn(0f, 1f)
    }

    private fun release(dx: Float, dy: Float) {
        hint.animate().alpha(0f).setDuration(120).start()
        val horizontal = abs(dx) > abs(dy)
        val passed = if (horizontal) abs(dx) > stage.width * H else abs(dy) > stage.height * V
        when {
            !passed -> snapBack()
            horizontal && dx > 0 -> goNext()
            horizontal -> goPrev()
            dy < 0 -> {
                snapBack()
                askKeep()
            }
            else -> trash()
        }
    }

    private fun snapBack() {
        card.animate().translationX(0f).translationY(0f).rotation(0f).setDuration(150).start()
        hint.animate().alpha(0f).setDuration(120).start()
    }

    private fun fly(tx: Float, ty: Float, then: () -> Unit) {
        busy = true
        card.animate().translationX(tx).translationY(ty).alpha(0f).setDuration(170).withEndAction {
            busy = false
            then()
        }.start()
    }

    private fun goNext() {
        if (index !in list.indices) return
        fly(stage.width * 1.2f, card.translationY) { advance() }
    }

    private fun goPrev() {
        if (index <= 0) {
            snapBack()
            toast("첫 파일이에요")
            return
        }
        index--
        show()
        card.translationX = -stage.width.toFloat()
        card.animate().translationX(0f).setDuration(170).start()
    }

    private fun trash() {
        if (index !in list.indices) return
        record(Decision.TRASH, "")
        fly(card.translationX, stage.height * 1.2f) { advance() }
    }

    private fun askKeep() {
        if (index !in list.indices) return
        catPanel.removeAllViews()
        catPanel.addView(label("어디에 보관할까요?", 18f, Pal.WHITE, true))
        catPanel.addView(
            label("지금은 표시만 해요. 실제로 옮기는 건 홈 › 정리 대기에서 한 번에.", 13f, Pal.MUTED_DARK)
                .apply { setPadding(0, dp(4), 0, dp(14)) }
        )
        for (c in Store.categories) {
            catPanel.addView(
                pill(c, Pal.KEEP) { keep(c) }.apply { setPadding(0, dp(15), 0, dp(15)) },
                lp().margins(0, 0, 0, dp(8)),
            )
        }
        catPanel.addView(pill("취소", Pal.DARK) { catPanel.visibility = View.GONE }, lp())
        catPanel.visibility = View.VISIBLE
    }

    private fun keep(cat: String) {
        catPanel.visibility = View.GONE
        record(Decision.KEEP, cat)
        fly(card.translationX, -stage.height * 1.2f) { advance() }
    }

    private fun record(kind: String, cat: String) {
        val it = list[index]
        steps.add(Step(index, it.path, Store.decisions[it.path]))
        Store.decisions[it.path] = Decision(kind, cat, System.currentTimeMillis())
        Store.save()
    }

    private fun advance() {
        index++
        if (index < list.size) show() else showEnd()
    }

    private fun undo() {
        if (busy) return
        val s = steps.removeLastOrNull()
        if (s == null) {
            toast("되돌릴 결정이 없어요")
            return
        }
        if (s.before == null) Store.decisions.remove(s.path) else Store.decisions[s.path] = s.before
        Store.save()
        index = s.index.coerceIn(0, max(0, list.size - 1))
        if (list.isNotEmpty()) show()
        toast("되돌렸어요")
    }

    private fun showEnd() {
        // 끝까지 봤으면 다음에는 남은 것(건너뛴 것 + 새 파일)의 처음부터 연다.
        Store.sessions[src.id] = Session(null, 0)
        Store.save()
        var kept = 0
        var trashed = 0
        for (it in list) {
            when (Store.decisions[it.path]?.kind) {
                Decision.KEEP -> kept++
                Decision.TRASH -> trashed++
            }
        }
        val skipped = list.size - kept - trashed
        progress.text = ""
        endPanel.removeAllViews()
        endPanel.addView(label(if (list.isEmpty()) "남은 파일이 없어요" else "끝까지 봤어요", 24f, Pal.WHITE, true))
        if (list.isNotEmpty()) {
            endPanel.addView(
                label("보관 $kept · 삭제 대기 $trashed · 건너뜀 $skipped", 15f, Pal.MUTED_DARK)
                    .apply { setPadding(0, dp(8), 0, dp(24)) }
            )
        } else {
            endPanel.addView(View(this), lp(MATCH, dp(24)))
        }
        endPanel.addView(pill("홈에서 정리 마무리하기", Pal.ACCENT) { finish() }, lp().margins(0, 0, 0, dp(10)))
        if (skipped > 0) endPanel.addView(pill("건너뛴 것 다시 보기", Pal.DARK2) { load() }, lp().margins(0, 0, 0, dp(10)))
        if (steps.isNotEmpty()) endPanel.addView(pill("마지막 결정 되돌리기", Pal.DARK2) { undo() }, lp())
        endPanel.visibility = View.VISIBLE
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (catPanel.visibility == View.VISIBLE) catPanel.visibility = View.GONE else super.onBackPressed()
    }
}
