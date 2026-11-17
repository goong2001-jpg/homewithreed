# subtech-orders (써브텍 주문앱)

작업 전에 **`subtech-orders/HANDOFF.md`를 먼저 읽고** 그 규칙대로 진행한다.
핵심: 작업 브랜치 `ccr-45fa06b9-ax86xs`에 푸시하면 자동 배포 · 새 배포 금지(주소 바뀜) · 재고앱 폴더(`subtech-inventory/`)와 재고 탭(품목마스터 읽기만, 거래로그 등은 손대지 않음) 보호 · `APP_VERSION`(Code.gs)과 `HTML_VERSION`(Index.html)을 같이 올리기 · 엑셀 양식(열 순서·머리줄)은 바꾸지 않기 · 실제 고객 정보(카톡 원문·엑셀 원본)를 저장소에 올리지 않기 · 사용자에게는 한국어로 짧게.
변경 이력은 배포 성공 시 `CHANGELOG.md`에 자동 기록됨 → 커밋 메시지를 `vNN: 무엇을 바꿨는지` + `- ` 목록으로 쓰고, CHANGELOG.md는 손대지 말고, 푸시 전 `git pull --rebase`.
