# couple-budget (우리집 하루수입 가계부) — 작업 규칙

**작업 전에 `HANDOFF.md` 를 끝까지 먼저 읽는다.** 현재 버전은 `CHANGELOG.md` 맨 위.

## 핵심 규칙

1. **사용자 데이터를 지키기** — localStorage 키(`src/utils/storage.ts` 의 `KEYS`), Firestore 경로 `rooms/{코드}/{컬렉션}`, id 형식(`p1`, `budget-식비`)은 바꾸지 않는다. 삭제는 툼스톤(`deleted: true`)만. 필드는 더하기만 하고 옛 기록(필드 없음)을 처리한다.
2. **주소·구조 유지** — `package.json` `homepage` = `/homewithreed/couple-budget/`, 기본(배포) 브랜치 = `claude/intelligent-cannon-txjx76`. `deploy.yml`·`ci.yml` 은 모든 앱이 같이 쓴다 — 다른 앱 단계는 건드리지 않는다.
3. **커밋 메시지** — 첫 줄 `vNN: 무엇을 바꿨는지` (다음 번호 = CHANGELOG 맨 위 + 1), 본문은 `- ` 목록으로 사용자 말로. squash 병합 때 `commit_title`·`commit_message` 를 직접 넣는다.
4. **`CHANGELOG.md` 는 손대지 않는다** — 배포 성공 뒤 Actions 가 커밋 메시지로 자동 기록한다. **푸시 전에 `git pull --rebase origin claude/intelligent-cannon-txjx76`** (봇 커밋이 들어와 있을 수 있다).
5. **흐름** — 기본 브랜치 최신에서 작업 브랜치를 새로 만들기(`git checkout -B <브랜치> origin/claude/intelligent-cannon-txjx76`) → 작업 → `bash couple-budget/dev/check.sh` 전부 ✅ → PR → squash 병합 → 배포·이력 기록 성공 확인(HANDOFF 4-4) → 사용자에게 "폰 새로고침" 안내.
6. **비밀값** — 저장소는 공개. 사용자의 Firebase projectId·apiKey·우리집 코드, 이메일·실명·아이 이름을 코드·문서·커밋에 쓰지 않는다. 예시는 `wooricip-a1b2c`.
7. **설계 원칙** — 로컬 우선(네트워크를 기다리지 않음), firebase·xlsx 는 동적 import 로 메인 번들 밖, 돈 계산은 `src/utils/` 순수 함수 + 테스트, 경조사·카테고리 예산은 저금통 계산에 넣지 않음.
8. **답변** — 한국어 반말, 폰으로 읽으니 결론 먼저 짧게. "만들지는 말고"면 제안만.
