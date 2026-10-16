"""한결 아침 보고 이미지 생성기.
사용: python3 hangyeol/render.py data.json  -> hangyeol/brief-YYYY-MM-DD.png
data.json 예시는 sample.json 참고. 선택 필드 "yesterday"(한 줄)를 넣으면 "어제 · …" 줄이 표시된다. 폰트는 처음 실행 시 /tmp/hangyeol-fonts에 내려받는다."""
import json, os, re, subprocess, sys, html, glob, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = "/tmp/hangyeol-fonts"
CSS_URL = "https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&display=swap"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read()

def ensure_fonts():
    fdir = os.path.join(WORK, "fonts")
    if os.path.exists(os.path.join(fdir, "local.css")):
        return
    os.makedirs(fdir, exist_ok=True)
    css = fetch(CSS_URL).decode()
    urls = sorted(set(re.findall(r"https://fonts\.gstatic\.com[^)]*", css)))
    local = lambda u: u.replace("https://fonts.gstatic.com/", "").replace("/", "_")
    def dl(u):
        with open(os.path.join(fdir, local(u)), "wb") as f:
            f.write(fetch(u))
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(dl, urls))
    for u in urls:
        css = css.replace(u, local(u))
    open(os.path.join(fdir, "local.css"), "w").write(css)

def br(text):
    return html.escape(text).replace("\n", "<br>")

def main(path):
    d = json.load(open(path))
    items = "".join(
        f'<li><div class="n">{i}</div><div><div class="h">{br(it["title"])}</div>'
        f'<div class="d">{br(it["detail"])}</div></div></li>'
        for i, it in enumerate(d["items"], 1))
    tpl = open(os.path.join(HERE, "template.html")).read()
    out = (tpl.replace("{{date}}", br(d["date_label"]))
              .replace("{{greet}}", br(d.get("greet", "묘사님, 좋은 아침입니다.")))
              .replace("{{lead}}", br(d.get("lead", "오늘은 이 세 가지만 챙기시면 됩니다.")))
              .replace("{{yday}}", f'<div class="yday">어제 · {br(d["yesterday"])}</div>' if d.get("yesterday") else "")
              .replace("{{items}}", items)
              .replace("{{note}}", br(d["note"]))
              .replace("{{sign}}", br(d.get("sign", "오늘도 곁에서 챙기겠습니다."))))
    ensure_fonts()
    page = os.path.join(WORK, "brief.html")
    open(page, "w").write(out)
    raw = os.path.join(WORK, "raw.png")
    chrome = (glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome") or ["chromium"])[0]
    subprocess.run([chrome, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    "--virtual-time-budget=5000", "--window-size=1080,1500",
                    f"--screenshot={raw}", f"file://{page}"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    from PIL import Image
    dest = os.path.join(HERE, f'brief-{d["date"]}.png')
    Image.open(raw).crop((0, 0, 1080, 1350)).save(dest)
    print(dest)

if __name__ == "__main__":
    main(sys.argv[1])
