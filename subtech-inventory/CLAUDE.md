# subtech-inventory (써브텍 재고앱)

작업 전에 **`subtech-inventory/HANDOFF.md`를 먼저 읽고** 그 규칙대로 진행한다.
핵심: 작업 브랜치 `claude/spreadsheet-accessibility-opmsi3`에 푸시하면 자동 배포 · 새 배포 금지(주소 바뀜) · 시트 데이터 삭제 금지 · `APP_VERSION`(Code.gs)과 `HTML_VERSION`(Index.html)을 같이 올리기 · 배포 성공 확인까지가 작업 · 사용자에게는 한국어로 짧게.
변경 이력은 배포 성공 시 `CHANGELOG.md`에 자동 기록됨 → 커밋 메시지를 `vNN: 무엇을 바꿨는지` + `- ` 목록으로 쓰고, CHANGELOG.md는 손대지 말고, 푸시 전 `git pull --rebase`.
