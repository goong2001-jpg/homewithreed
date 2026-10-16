package com.homewithreed.fileswipe

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** GitHub 릴리스에 올라간 최신 버전 번호와 APK 주소를 확인한다. */
object Updater {
    private const val API = "https://api.github.com/repos/goong2001-jpg/homewithreed/releases/tags/file-swipe"
    const val PAGE = "https://github.com/goong2001-jpg/homewithreed/releases/tag/file-swipe"

    fun check(done: (Boolean) -> Unit) {
        Thread {
            var version = -1
            var url = PAGE
            try {
                val c = URL(API).openConnection() as HttpURLConnection
                c.connectTimeout = 8000
                c.readTimeout = 8000
                c.setRequestProperty("Accept", "application/vnd.github+json")
                if (c.responseCode == 200) {
                    val o = JSONObject(c.inputStream.bufferedReader().readText())
                    version = Regex("\\d+").find(o.optString("name"))?.value?.toIntOrNull() ?: 0
                    val assets = o.optJSONArray("assets")
                    if (assets != null) for (i in 0 until assets.length()) {
                        val a = assets.getJSONObject(i)
                        if (a.optString("name").endsWith(".apk")) url = a.optString("browser_download_url")
                    }
                }
                c.disconnect()
            } catch (e: Exception) {
                version = -1
            }
            mainHandler.post {
                if (version >= 0) {
                    Store.latestVersion = version
                    Store.latestUrl = url
                    Store.lastUpdateCheck = System.currentTimeMillis()
                    Store.save()
                }
                done(version >= 0)
            }
        }.start()
    }
}
