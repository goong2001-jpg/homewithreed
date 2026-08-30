# habit-push — 톡톡 습관친구 푸시 알림 서버

`habit-talk` 앱에 **진짜 폰 알림**을 보내주는 Cloudflare Worker입니다.
1분마다 깨어나서 "지금 알림 보낼 시간인가" 확인하고, 맞으면 푸시를 쏩니다.

**이 서버 없이도 앱은 정상 동작합니다.** 다만 알림이 안 오고, 앱을 열었을 때
그 시간대에 왔어야 할 메시지가 밀려 있는 형태가 됩니다.

## 왜 카카오톡이 아니라 이 방식인가

진짜 카카오톡으로 자녀에게 메시지를 보내려면 카카오 비즈니스 채널 심사 +
건당 유료 알림톡 + 상시 서버가 필요합니다. 개인이 쓰기엔 문턱이 너무 높아서,
**카톡처럼 생긴 앱을 폰에 설치하고 웹 푸시로 알림을 받는** 방식으로 만들었습니다.

## 비용

전부 무료 한도 안에서 돌아갑니다.

| 항목 | 사용량 | 무료 한도 |
|---|---|---|
| Worker 요청 | 하루 약 1,440회 (1분마다) | 하루 100,000회 |
| KV 읽기 | 하루 약 1,500회 | 하루 100,000회 |
| KV 쓰기 | 하루 5~10회 | 하루 1,000회 |

KV 쓰기가 제일 빡빡한 한도라, 설정이 바뀌지 않으면 앱이 아예 업로드를 건너뛰고
Worker도 내용이 같으면 저장을 생략합니다. `list()`는 쓰지 않습니다 —
1분마다 부르면 그것만으로 하루 한도를 넘깁니다.

---

## 설치 (한 번만 하면 됩니다)

### 1. Cloudflare 계정 만들기

<https://dash.cloudflare.com/sign-up> — 무료입니다. 카드 등록 필요 없습니다.

### 2. 로그인

```bash
cd habit-push
npm install
npx wrangler login
```

### 3. KV 네임스페이스 만들기

```bash
npx wrangler kv namespace create HABIT_KV
```

출력에 나온 `id = "..."` 값을 `wrangler.toml`의 `[[kv_namespaces]]` 아래
`id` 자리에 붙여넣으세요.

### 4. VAPID 키 만들기

```bash
npm run keys
```

* **공개키** → `wrangler.toml`의 `VAPID_PUBLIC_KEY` 에 넣기 (공개돼도 되는 값)
* **개인키** → 아래 5번에서 시크릿으로 넣기 (**절대 커밋하지 마세요**)

### 5. 시크릿 넣기

```bash
npx wrangler secret put VAPID_PRIVATE_KEY   # 4번의 개인키를 붙여넣기
npx wrangler secret put PASSPHRASE          # 아무 암호나 정하세요
```

`PASSPHRASE`는 아무나 이 서버에 구독을 등록하지 못하게 막는 값입니다.
나중에 앱 **설정 → 알림 암호**에 똑같이 입력해야 합니다.

### 6. `wrangler.toml` 마무리

* `ALLOWED_ORIGIN` — 앱이 올라간 주소. GitHub Pages라면 `https://<계정>.github.io`
* `VAPID_SUBJECT` — 본인 이메일 (`mailto:` 형태)

### 7. 배포

```bash
npm run deploy
```

배포되면 `https://habit-push.<계정>.workers.dev` 같은 주소가 나옵니다.

### 8. 앱에 연결하기

GitHub 저장소 → **Settings → Secrets and variables → Actions → Variables** 탭에서
저장소 변수 두 개를 추가하세요 (둘 다 공개돼도 되는 값이라 Secret이 아니라 Variable):

| 이름 | 값 |
|---|---|
| `VAPID_PUBLIC_KEY` | 4번에서 만든 공개키 |
| `PUSH_ENDPOINT` | 7번에서 나온 Worker 주소 |

그 다음 배포 워크플로를 다시 돌리면 앱에 푸시 기능이 켜집니다.

### 9. 폰에서 켜기

1. 폰에서 앱을 열고 **홈 화면에 추가**
2. **홈 화면 아이콘으로 다시 열기** (중요 — 아이폰은 사파리 탭에서는 알림이 안 됩니다)
3. 설정 → **알림 암호**에 5번의 `PASSPHRASE` 입력
4. **푸시 알림** 스위치 켜기 → 권한 허용

---

## 로컬에서 확인하기

```bash
npm test        # 발송 시각 고르는 로직 테스트
npm run typecheck
```

Worker를 직접 띄워보려면 `wrangler.toml`을 복사해 `wrangler.local.toml`을 만들고
(KV `id`는 아무 문자열이나 넣으면 됩니다), `.dev.vars`에 시크릿을 적은 뒤:

```bash
npx wrangler dev --config wrangler.local.toml --test-scheduled --local
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*"   # 크론 강제 실행
```

두 파일 모두 `.gitignore`에 들어 있습니다.

---

## 알아둘 것

**알림 시각이 몇 분 늦을 수 있습니다.** Cloudflare 크론은 정시를 보장하지 않습니다.
그래서 Worker는 예정 시각부터 **5분 안**이면 발송합니다. 7:30 알림이 7:33에
올 수는 있어도 아예 안 오지는 않습니다.

**드물게 알림이 두 번 올 수 있습니다.** KV는 방금 쓴 값이 바로 안 보일 수 있어서
(최대 1분쯤), 중복 방지 표시가 늦게 반영되면 같은 알림이 한 번 더 갈 수 있습니다.
메모리 캐시로 대부분 막지만 완전히 없애려면 Durable Objects가 필요합니다.
"양치했어?"가 두 번 오는 건 안 오는 것보다 낫다고 보고 이대로 뒀습니다.

**아이폰은 조건이 까다롭습니다.**
* iOS **16.4 이상**만 됩니다.
* **홈 화면에 추가한 앱 안에서만** 알림이 됩니다. 사파리 탭에서는 안 됩니다.
* 사파리와 홈 화면 앱은 **저장소가 완전히 분리**돼 있습니다. 사파리에서 설정한
  아이 이름·친구·시간표는 홈 화면 앱에 안 넘어갑니다. 홈 화면 앱에서 새로
  설정하거나, 설정 → 백업 내보내기/불러오기로 옮기세요.

**시간표를 바꿔도 재배포할 필요가 없습니다.** 알림 시각은 크론이 아니라 KV에
들어 있어서, 앱에서 시간을 바꾸면 앱이 알아서 다시 올립니다.

## API

| 경로 | 하는 일 |
|---|---|
| `POST /subscribe` | 구독 + 시간표 등록 (암호 필요). 내용이 같으면 저장을 건너뜁니다 |
| `POST /unsubscribe` | 등록 해제 (암호 필요) |
| `GET /health` | 서버가 떠 있는지, 키가 설정됐는지 확인 |
