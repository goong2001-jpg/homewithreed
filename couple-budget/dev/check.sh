#!/usr/bin/env bash
# 한 줄 점검:  bash couple-budget/dev/check.sh        (어느 폴더에서 돌려도 된다)
#             bash couple-budget/dev/check.sh --quick  (단위 테스트만, 빌드·브라우저 생략)
#
# 커밋·PR 전에 돌린다. 하나라도 ❌ 이면 끝에 실패로 끝난다(종료 코드 1).
# CI(.github/workflows/ci.yml)도 같은 단위 테스트·빌드를 돌리지만, 여기서 먼저 잡는 게 빠르다.
set -uo pipefail
cd "$(dirname "$0")/.."
APP="$(pwd)"
QUICK=0; [[ "${1:-}" == "--quick" ]] && QUICK=1

pass=0; fail=0; failed=()
ok()   { echo "  ✅ $1"; pass=$((pass+1)); }
bad()  { echo "  ❌ $1"; fail=$((fail+1)); failed+=("$1"); }
step() { echo; echo "▶ $1"; }
start=$(date +%s)

step "Node 버전"
major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if   (( major >= 22 )); then ok "node $(node -v) (CI 와 같음)"
elif (( major >= 18 )); then ok "node $(node -v) — CI 는 22 를 쓴다. 되도록 22 로 맞추기"
else bad "node 18 이상이 필요합니다 (지금: $(node -v 2>/dev/null || echo 없음))"; fi

step "의존성"
if [[ -d node_modules/react-scripts ]]; then ok "node_modules 있음"
elif npm ci --no-audit --no-fund >/tmp/couple-budget-npm.log 2>&1; then ok "npm ci 완료"
else bad "npm ci 실패 (로그: /tmp/couple-budget-npm.log)"; fi

step "단위 테스트 (계산·병합·백업·주간 리포트·경조사)"
out=$(CI=true npx react-scripts test --watchAll=false 2>&1)
if echo "$out" | grep -q "Tests:.*failed"; then
  bad "단위 테스트 실패"; echo "$out" | grep -E "✕|●" | head -20
elif summary=$(echo "$out" | grep -E "^Tests:"); then ok "$(echo "${summary#Tests:}" | xargs)"
else bad "단위 테스트를 돌리지 못했습니다"; echo "$out" | tail -15; fi

step "이력 자동 기록 도구 테스트"
if out=$(node --test dev/history.test.mjs 2>&1); then
  ok "$(echo "$out" | grep -E '^# pass' | sed 's/# pass /통과 /')건"
else bad "dev/history.test.mjs 실패"; echo "$out" | grep -E "^not ok" | head; fi

step "문서"
for f in HANDOFF.md CLAUDE.md CHANGELOG.md README.md; do
  [[ -s "$f" ]] && ok "$f" || bad "$f 없음"
done
grep -q "AUTO-CHANGELOG:START" CHANGELOG.md && grep -q "AUTO-CHANGELOG:END" CHANGELOG.md \
  && ok "CHANGELOG.md 자동 기록 표시 있음" || bad "CHANGELOG.md 의 AUTO-CHANGELOG 표시가 없어졌습니다"

if (( QUICK )); then
  echo; echo "(--quick: 빌드·브라우저 점검 생략)"
else
  step "배포 빌드 (CI=true — 경고도 실패로 친다)"
  if out=$(CI=true npx react-scripts build 2>&1); then ok "빌드 성공"
  else bad "빌드 실패"; echo "$out" | tail -25; fi

  step "빌드 결과 점검"
  main=$(ls build/static/js/main.*.js 2>/dev/null | head -1)
  if [[ -z "$main" ]]; then bad "main 번들이 없습니다"
  else
    # firebase·xlsx 는 동적 import 로 따로 떨어져 있어야 한다 (동기화 안 쓰는 사람은 안 받는다)
    grep -q "firestore.googleapis.com" "$main" && bad "firebase 가 메인 번들에 들어왔습니다" || ok "firebase 는 메인 번들 밖"
    grep -q "SheetJS" "$main" && bad "xlsx 가 메인 번들에 들어왔습니다" || ok "xlsx 는 메인 번들 밖"
    kb=$(( $(gzip -c "$main" | wc -c) / 1024 ))
    (( kb < 200 )) && ok "메인 번들 gzip ${kb}KB" || bad "메인 번들이 커졌습니다: gzip ${kb}KB"
  fi
  grep -q '/homewithreed/couple-budget/manifest.json' build/index.html \
    && ok "배포 경로 /homewithreed/couple-budget/" || bad "index.html 의 배포 경로가 바뀌었습니다 (package.json homepage)"

  step "브라우저 스모크 (실제 빌드를 배포 경로로 띄워서 클릭)"
  node dev/smoke.mjs && pass=$((pass+1)) || { fail=$((fail+1)); failed+=("브라우저 스모크"); }
fi

echo
echo "────────────────────────────────────────"
echo "  통과 $pass · 실패 $fail · $(( $(date +%s) - start ))초"
if (( fail )); then
  printf '  ❌ %s\n' "${failed[@]}"
  exit 1
fi
echo "  ✅ 전부 통과 — 커밋·PR 해도 됩니다"
