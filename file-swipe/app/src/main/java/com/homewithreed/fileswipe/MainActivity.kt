package com.homewithreed.fileswipe

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import java.io.File

class MainActivity : Activity() {
    private lateinit var body: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(this)
        val scroll = ScrollView(this).apply { setBackgroundColor(Pal.BG) }
        body = vbox().apply { setPadding(dp(20), dp(22), dp(20), dp(40)) }
        scroll.addView(body)
        setContentView(scroll)
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        if (!Environment.isExternalStorageManager()) {
            renderNoPermission()
            return
        }
        Store.adoptBackup()
        if (Repo.scanned) render() else renderLoading()
        Thread {
            Repo.scan(this)
            mainHandler.post {
                if (!isFinishing) {
                    pruneVanished()
                    render()
                }
            }
        }.start()
        if (System.currentTimeMillis() - Store.lastUpdateCheck > 12 * HOUR) {
            Updater.check { ok -> if (ok && Repo.scanned && !isFinishing) render() }
        }
    }

    // 다른 앱에서 지운 파일은 기록에서도 뺀다.
    private fun pruneVanished() {
        if (Store.decisions.keys.removeAll { !File(it).exists() }) Store.save()
    }

    private fun header() {
        body.addView(label("스와이프 정리", 26f, Pal.INK, true))
        body.addView(
            label("위로 보관 · 아래로 삭제 대기 · 좌우로 넘기기\n표시만 해두고, 옮기기·삭제는 이 화면에서 한 번에.", 14f, Pal.SUB)
                .apply { setPadding(0, dp(6), 0, 0) }
        )
    }

    private fun renderNoPermission() {
        body.removeAllViews()
        header()
        body.addView(label("시작하려면 ‘모든 파일 접근’을 허용해 주세요", 18f, Pal.INK, true).apply { setPadding(0, dp(28), 0, dp(8)) })
        body.addView(
            label(
                "폴더를 훑어 미리보기를 보여주고, 고른 파일을 옮기거나 휴지통으로 보내려면 이 권한이 필요해요. " +
                    "파일을 인터넷으로 보내지 않아요.",
                14f, Pal.SUB,
            )
        )
        body.addView(pill("권한 허용하러 가기", Pal.ACCENT) { askPermission() }, lp().margins(0, dp(20), 0, 0))
        body.addView(
            label("설정 화면에서 ‘스와이프 정리’ 스위치를 켠 뒤 뒤로 가기를 누르면 돼요.", 13f, Pal.SUB)
                .apply { setPadding(0, dp(10), 0, 0) }
        )
    }

    private fun askPermission() {
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName")))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        }
    }

    private fun renderLoading() {
        body.removeAllViews()
        header()
        body.addView(label("폴더를 훑는 중…", 15f, Pal.SUB).apply { setPadding(0, dp(28), 0, 0) })
    }

    private fun render() {
        body.removeAllViews()
        header()

        if (Store.latestVersion > BuildConfig.VERSION_CODE) {
            body.addView(
                pill("새 버전 v${Store.latestVersion} 받기 (지금 v${BuildConfig.VERSION_CODE})", Pal.INK) { openUrl(Store.latestUrl) },
                lp().margins(0, dp(16), 0, 0),
            )
        }

        Store.lastSource?.let { id ->
            val s = Repo.source(id)
            val left = Repo.counts(s)[0]
            if (left > 0) {
                body.addView(
                    pill("이어서 하기 · ${s.title} · 남은 ${left}개", Pal.ACCENT) { openSwipe(id) }
                        .apply { setPadding(dp(16), dp(16), dp(16), dp(16)) },
                    lp().margins(0, dp(16), 0, 0),
                )
            }
        }

        pendingSection()
        trashSection()

        section("어디부터 정리할까요")
        for (s in Repo.presets) {
            val c = Repo.counts(s)
            if (c[1] > 0) row(s.title, "남은 ${c[0]}개 / 전체 ${c[1]}개") { openSwipe(s.id) }
        }

        section("모든 폴더")
        for ((folder, c) in Repo.folderStats()) {
            val s = Repo.folderSource(folder)
            row(s.title, "남은 ${c[0]}개 / 전체 ${c[1]}개") { openSwipe(s.id) }
        }

        settingsSection()
    }

    private fun pendingSection() {
        val keep = LinkedHashMap<String, MutableList<String>>()
        val wait = ArrayList<String>()
        for ((p, d) in Store.decisions) {
            if (d.isTrash) wait.add(p) else keep.getOrPut(d.cat) { ArrayList() }.add(p)
        }
        section("정리 대기 · 아직 표시만 된 파일")
        if (keep.isEmpty() && wait.isEmpty()) {
            body.addView(
                label("아직 없어요. 아래에서 폴더를 골라 스와이프로 시작하세요.", 14f, Pal.SUB)
                    .apply { setPadding(0, dp(10), 0, dp(10)) }
            )
            return
        }
        for ((cat, paths) in keep) {
            row(
                "$cat · ${paths.size}개", "${Repo.OUT}/$cat 폴더로 옮겨요",
                small("보기", Pal.CHIP, Pal.INK) { openList(ListActivity.MODE_KEEP, cat) },
                small("옮기기", Pal.KEEP) { confirmKeep(cat, paths) },
            )
        }
        if (wait.isNotEmpty()) {
            val size = wait.sumOf { File(it).length() }
            row(
                "삭제 대기 · ${wait.size}개", "${fmtSize(size)} · 휴지통에 들어가도 되살릴 수 있어요",
                small("보기", Pal.CHIP, Pal.INK) { openList(ListActivity.MODE_WAIT, null) },
                small("휴지통으로", Pal.TRASH) { confirmTrash(wait) },
            )
        }
    }

    private fun trashSection() {
        section("휴지통")
        val total = Store.trash.sumOf { it.size }
        row(
            "휴지통 · ${Store.trash.size}개",
            if (Store.trash.isEmpty()) "비어 있어요" else "${fmtSize(total)} · 눌러서 되살리거나 비우기",
        ) { openList(ListActivity.MODE_TRASH, null) }
        val now = System.currentTimeMillis()
        val old = Store.trash.filter { now - it.time > 30 * DAY }
        if (old.isNotEmpty()) {
            row(
                "30일 지난 ${old.size}개", fmtSize(old.sumOf { it.size }),
                small("비우기", Pal.TRASH) { confirmPurge(old) },
            )
        }
    }

    private fun settingsSection() {
        section("설정")
        row("보관 분류 이름", Store.categories.joinToString(", ")) { editCategories() }
        row("보는 순서", if (Store.newestFirst) "최신 파일부터" else "오래된 파일부터") {
            Store.newestFirst = !Store.newestFirst
            Store.save()
            render()
        }
        row("업데이트 확인", "지금 버전 v${BuildConfig.VERSION_CODE}") {
            Updater.check { ok ->
                toast(
                    when {
                        !ok -> "확인하지 못했어요. 인터넷 연결을 확인해 주세요"
                        Store.latestVersion > BuildConfig.VERSION_CODE -> "새 버전 v${Store.latestVersion}이 있어요"
                        else -> "최신 버전이에요"
                    }
                )
                if (!isFinishing) render()
            }
        }
        body.addView(
            label("옮긴 파일은 내장 저장공간/${Repo.OUT} 에 있어요. 인터넷은 업데이트 확인에만 써요.", 12f, Pal.SUB)
                .apply { setPadding(0, dp(18), 0, 0) }
        )
    }

    private fun section(title: String) {
        body.addView(label(title, 13f, Pal.SUB, true).apply { setPadding(0, dp(28), 0, dp(4)) })
        body.addView(View(this).apply { setBackgroundColor(Pal.LINE) }, lp(MATCH, 1))
    }

    private fun row(title: String, sub: String?, vararg actions: View, onClick: (() -> Unit)? = null) {
        val r = hbox().apply { setPadding(0, dp(13), 0, dp(13)) }
        val t = vbox()
        t.addView(label(title, 16f, Pal.INK, true))
        if (sub != null) t.addView(label(sub, 13f, Pal.SUB).apply { setPadding(0, dp(2), 0, 0) })
        r.addView(t, lp(0, WRAP, 1f))
        for (a in actions) r.addView(a, lp(WRAP, WRAP).margins(dp(8), 0, 0, 0))
        if (onClick != null) {
            r.setOnClickListener { onClick() }
            if (actions.isEmpty()) r.addView(label("›", 24f, Pal.SUB).apply { setPadding(dp(10), 0, 0, 0) })
        }
        body.addView(r, lp())
        body.addView(View(this).apply { setBackgroundColor(Pal.LINE) }, lp(MATCH, 1))
    }

    private fun small(text: String, bg: Int, fg: Int = Pal.WHITE, onClick: () -> Unit) =
        pill(text, bg, fg) { onClick() }.apply {
            textSize = 13f
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }

    private fun openSwipe(id: String) {
        Store.lastSource = id
        Store.save()
        startActivity(Intent(this, SwipeActivity::class.java).putExtra(SwipeActivity.EXTRA_SOURCE, id))
    }

    private fun openList(mode: String, cat: String?) {
        startActivity(
            Intent(this, ListActivity::class.java)
                .putExtra(ListActivity.EXTRA_MODE, mode)
                .putExtra(ListActivity.EXTRA_CAT, cat)
        )
    }

    private fun confirmKeep(cat: String, paths: List<String>) {
        AlertDialog.Builder(this)
            .setTitle("$cat ${paths.size}개 옮기기")
            .setMessage("내장 저장공간/${Repo.OUT}/$cat 폴더로 옮겨요. 갤러리에서는 ‘$cat’ 앨범으로 보여요.")
            .setPositiveButton("옮기기") { _, _ ->
                runBusy("옮기는 중…", {
                    val r = Ops.keep(this, cat, paths)
                    if (r[1] == 0) "${r[0]}개 옮겼어요" else "${r[0]}개 옮김 · ${r[1]}개 실패"
                }) { refresh() }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun confirmTrash(paths: List<String>) {
        AlertDialog.Builder(this)
            .setTitle("${paths.size}개를 휴지통으로")
            .setMessage("앱 휴지통으로 옮겨요. 비우기 전까지는 언제든 되살릴 수 있어요.")
            .setPositiveButton("휴지통으로") { _, _ ->
                runBusy("휴지통으로 옮기는 중…", {
                    val r = Ops.trash(this, paths)
                    if (r[1] == 0) "${r[0]}개를 휴지통에 넣었어요" else "${r[0]}개 이동 · ${r[1]}개 실패"
                }) { refresh() }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun confirmPurge(entries: List<TrashEntry>) {
        AlertDialog.Builder(this)
            .setTitle("${entries.size}개 완전히 지우기")
            .setMessage("지우면 되살릴 수 없어요.")
            .setPositiveButton("지우기") { _, _ ->
                runBusy("지우는 중…", { "${Ops.purge(entries)}개를 지웠어요" }) { refresh() }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun editCategories() {
        val input = EditText(this).apply {
            setText(Store.categories.joinToString(", "))
            setSingleLine()
        }
        val box = FrameLayout(this).apply {
            setPadding(dp(22), dp(8), dp(22), 0)
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle("보관 분류 (쉼표로 구분, 최대 4개)")
            .setView(box)
            .setPositiveButton("저장") { _, _ ->
                val list = input.text.split(',', '，')
                    .map { it.trim().replace('/', '-') }
                    .filter { it.isNotEmpty() }
                    .distinct()
                    .take(4)
                if (list.isEmpty()) {
                    toast("분류가 1개 이상 있어야 해요")
                } else {
                    Store.categories.clear()
                    Store.categories.addAll(list)
                    Store.save()
                    render()
                }
            }
            .setNegativeButton("취소", null)
            .show()
    }
}
