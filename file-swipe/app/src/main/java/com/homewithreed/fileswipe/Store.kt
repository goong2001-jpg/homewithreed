package com.homewithreed.fileswipe

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class Decision(val kind: String, val cat: String, val time: Long) {
    val isTrash get() = kind == TRASH

    companion object {
        const val KEEP = "keep"
        const val TRASH = "trash"
    }
}

/** 폴더별로 어디까지 봤는지. 파일 경로로 찾고, 없으면 순번으로 근처를 연다. */
class Session(val last: String?, val index: Int)

class TrashEntry(val name: String, val orig: String, val time: Long, val size: Long)

/**
 * 앱의 모든 기록을 state.json 하나에 둔다. 파일 자체는 건드리지 않는다.
 * 같은 내용을 '파일정리/.앱기록.json'에도 써두어, 앱을 지웠다 다시 깔아도 이어진다.
 */
object Store {
    private var file: File? = null
    private val backup: File get() = File(Repo.root, "${Repo.OUT}/.앱기록.json")

    val decisions = HashMap<String, Decision>()
    val sessions = HashMap<String, Session>()
    val trash = ArrayList<TrashEntry>()
    val categories = mutableListOf("증빙", "작업물", "메모")
    var newestFirst = true
    var lastSource: String? = null
    var lastUpdateCheck = 0L
    var latestVersion = 0
    var latestUrl = ""

    fun init(ctx: Context) {
        if (file != null) return
        val f = File(ctx.filesDir, "state.json")
        file = f
        if (!f.exists()) return
        try {
            load(JSONObject(f.readText()))
        } catch (e: Exception) {
            // 기록이 깨졌으면 빈 상태로 시작한다. 실제 파일은 그대로다.
        }
    }

    private fun load(o: JSONObject) {
        o.optJSONObject("decisions")?.let { d ->
            d.keys().forEach { k ->
                val v = d.getJSONObject(k)
                decisions[k] = Decision(v.getString("k"), v.optString("c"), v.optLong("t"))
            }
        }
        o.optJSONObject("sessions")?.let { s ->
            s.keys().forEach { k ->
                val v = s.getJSONObject(k)
                sessions[k] = Session(v.optString("last").ifEmpty { null }, v.optInt("i"))
            }
        }
        o.optJSONArray("trash")?.let { a ->
            for (i in 0 until a.length()) {
                val v = a.getJSONObject(i)
                trash.add(TrashEntry(v.getString("n"), v.getString("o"), v.optLong("t"), v.optLong("s")))
            }
        }
        o.optJSONArray("categories")?.let { a ->
            if (a.length() > 0) {
                categories.clear()
                for (i in 0 until a.length()) categories.add(a.getString(i))
            }
        }
        newestFirst = o.optBoolean("newestFirst", true)
        lastSource = o.optString("lastSource").ifEmpty { null }
        lastUpdateCheck = o.optLong("lastUpdateCheck")
        latestVersion = o.optInt("latestVersion")
        latestUrl = o.optString("latestUrl")
    }

    fun save() {
        val f = file ?: return
        val o = JSONObject()
        o.put("decisions", JSONObject().apply {
            for ((k, d) in decisions) put(k, JSONObject().put("k", d.kind).put("c", d.cat).put("t", d.time))
        })
        o.put("sessions", JSONObject().apply {
            for ((k, s) in sessions) put(k, JSONObject().put("last", s.last ?: "").put("i", s.index))
        })
        o.put("trash", JSONArray().apply {
            for (e in trash) put(JSONObject().put("n", e.name).put("o", e.orig).put("t", e.time).put("s", e.size))
        })
        o.put("categories", JSONArray(categories))
        o.put("newestFirst", newestFirst)
        o.put("lastSource", lastSource ?: "")
        o.put("lastUpdateCheck", lastUpdateCheck)
        o.put("latestVersion", latestVersion)
        o.put("latestUrl", latestUrl)
        val text = o.toString()
        val tmp = File(f.path + ".tmp")
        tmp.writeText(text)
        tmp.renameTo(f)
        try {
            backup.parentFile?.mkdirs()
            backup.writeText(text)
        } catch (e: Exception) {
            // 저장소 권한이 아직 없으면 백업은 다음 저장 때 쓴다.
        }
    }

    /** 새로 깔아서 기록이 비어 있으면, 폰에 남아 있던 백업을 불러온다. */
    fun adoptBackup() {
        if (decisions.isNotEmpty() || sessions.isNotEmpty() || trash.isNotEmpty()) return
        try {
            if (backup.exists()) {
                load(JSONObject(backup.readText()))
                save()
            }
        } catch (e: Exception) {
            // 백업이 깨졌으면 무시하고 빈 상태로 둔다.
        }
    }
}
