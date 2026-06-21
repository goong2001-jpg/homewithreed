#!/usr/bin/env node
/* =============================================================================
   embed_art.js  —  게임 아트(PNG)를 game.html 안에 base64로 박아넣는 빌드 스크립트
   -----------------------------------------------------------------------------
   사용법:
     node embed_art.js "<이미지 폴더 경로>"
   예:
     node embed_art.js "게임아트_정리"
     node embed_art.js "D:/클로드/게임아트_정리"

   동작:
     - 아래 MAP의 (게임 키 → 폴더 내 상대경로)대로 PNG를 읽어 data URI로 변환
     - game.html / index.html 의 ART 주입 마커(소스 내 ART_START ~ ART_END) 사이에 삽입
     - 외부 의존성 없음(Node 내장 fs만 사용). 인터넷 불필요.

   주의:
     - 파일이 없으면 경고만 내고 건너뜀(해당 자산은 자동으로 이모지로 폴백).
     - 이미지가 크면 game.html 용량이 커집니다(권장: 캐릭터 256px, 배경 800px).
   ============================================================================= */
const fs = require("fs");
const path = require("path");

// 게임 키 → 폴더 내부 상대 경로(드라이브 정리 구조 기준)
const MAP = {
  // 배경
  zone0: "배경/01_침략의땅_숲.png",
  zone1: "배경/02_망자의땅_폐허.png",
  zone2: "배경/03_파멸의땅_화산.png",
  // 헌터(직업)
  berserker: "헌터/01_버서커.png",
  paladin:   "헌터/02_팔라딘.png",
  ranger:    "헌터/03_레인져.png",
  sorcerer:  "헌터/04_소서러.png",
  // 몬스터 (지역별 일반 a/b + 보스)
  z0_a:    "몬스터/숲_01_고블린.png",
  z0_b:    "몬스터/숲_02_다이어울프.png",
  z0_boss: "몬스터/숲_03_보스_나무정령.png",
  z1_a:    "몬스터/폐허_01_스켈레톤.png",
  z1_b:    "몬스터/폐허_02_레이스.png",
  z1_boss: "몬스터/폐허_03_보스_리치.png",
  z2_a:    "몬스터/화산_01_라바임프.png",
  z2_b:    "몬스터/화산_02_헬하운드.png",
  z2_boss: "몬스터/화산_03_보스_마그마골렘.png",
  // 등급 프레임 (6단계: 게임 등급 0~10을 2개씩 묶어 매핑)
  f0: "프레임/01_노말_회색.png",
  f1: "프레임/02_언커먼_초록.png",
  f2: "프레임/03_레어_파랑.png",
  f3: "프레임/04_에픽_보라.png",
  f4: "프레임/05_레전더리_주황.png",
  f5: "프레임/06_울티메이트_무지개.png",
  // 아이콘
  wood: "아이콘/01_나무.png",
  iron: "아이콘/02_철광석.png",
  mana: "아이콘/03_마정석.png",
  gold: "아이콘/04_골드.png",
  gem:  "아이콘/05_보석.png",
};

function mime(file){
  const e = path.extname(file).toLowerCase();
  if(e===".png") return "image/png";
  if(e===".jpg"||e===".jpeg") return "image/jpeg";
  if(e===".webp") return "image/webp";
  if(e===".gif") return "image/gif";
  return "image/png";
}

const artDir = process.argv[2] || "게임아트_정리";
if(!fs.existsSync(artDir)){
  console.error("❌ 폴더를 찾을 수 없습니다:", artDir);
  console.error('   사용법: node embed_art.js "<이미지 폴더 경로>"');
  process.exit(1);
}

let found = 0, missing = 0, totalBytes = 0;
const lines = [];
for(const key of Object.keys(MAP)){
  const fp = path.join(artDir, MAP[key]);
  if(!fs.existsSync(fp)){
    console.warn("⚠️  없음(건너뜀):", MAP[key]);
    missing++;
    continue;
  }
  const buf = fs.readFileSync(fp);
  totalBytes += buf.length;
  const uri = "data:" + mime(fp) + ";base64," + buf.toString("base64");
  lines.push("  " + JSON.stringify(key) + ": " + JSON.stringify(uri) + ",");
  found++;
}

const block = "/*__ART_START__*/\n" + lines.join("\n") + "\n/*__ART_END__*/";
const re = /\/\*__ART_START__\*\/[\s\S]*?\/\*__ART_END__\*\//;

let wrote = 0;
for(const target of ["game.html", "index.html"]){
  if(!fs.existsSync(target)) continue;
  let html = fs.readFileSync(target, "utf8");
  if(!re.test(html)){
    console.warn("⚠️  마커를 못 찾음(건너뜀):", target);
    continue;
  }
  html = html.replace(re, block);
  fs.writeFileSync(target, html);
  wrote++;
  console.log("✅ 주입 완료:", target, "(" + (html.length/1024/1024).toFixed(2) + " MB)");
}

console.log(`\n요약: 이미지 ${found}개 임베드, ${missing}개 누락, 원본 합계 ${(totalBytes/1024/1024).toFixed(2)} MB`);
if(wrote===0) console.error("❌ game.html/index.html 에 주입하지 못했습니다. 같은 폴더에서 실행했는지 확인하세요.");
else console.log("👉 이제 game.html 을 브라우저로 열어 확인하세요. (인터넷 불필요)");
