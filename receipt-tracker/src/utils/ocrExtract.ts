import Tesseract from 'tesseract.js';
import { ExtractedFields, Category, PaymentMethod } from '../types';

/**
 * 영수증 이미지를 브라우저 안에서 OCR로 읽어 항목을 추출합니다.
 * API 키도, 서버도, 비용도 없습니다 (Tesseract.js).
 * 처음 실행 시 언어 데이터(kor+eng)를 CDN에서 한 번 내려받아 캐시합니다.
 */
export async function ocrImage(
  imageDataUrl: string,
  onProgress?: (pct: number) => void
): Promise<ExtractedFields> {
  const result = await Tesseract.recognize(imageDataUrl, 'kor+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  return parseReceipt(result.data.text);
}

function pad(s: string | number): string {
  return String(s).padStart(2, '0');
}

export function parseReceipt(text: string): ExtractedFields {
  return {
    date: parseDate(text),
    amount: parseAmount(text),
    content: parseContent(text),
    category: guessCategory(text),
    paymentMethod: guessPayment(text),
    type: '지출',
  };
}

function parseDate(text: string): string | null {
  // 2024-01-15 / 2024.01.15 / 2024/01/15 / 2024년 01월 15일
  let m = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) {
    const mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[1]}-${pad(mo)}-${pad(d)}`;
  }
  // 24.01.15 (2자리 연도)
  m = text.match(/(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (m) {
    const mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${2000 + +m[1]}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

function parseAmount(text: string): number | null {
  const lines = text.split('\n');
  const totalKeywords = ['합계', '합 계', '총액', '총 액', '결제', '받을', '판매', '청구', '금액'];
  const num = (s: string) => parseInt(s.replace(/,/g, ''), 10);

  // 1) 합계/결제금액 등 키워드가 있는 줄을 우선
  let best: number | null = null;
  for (const line of lines) {
    if (totalKeywords.some((k) => line.includes(k))) {
      const nums = Array.from(line.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,})\s*원?/g))
        .map((mm) => num(mm[1]))
        .filter((n) => n >= 100);
      if (nums.length) best = Math.max(best ?? 0, ...nums);
    }
  }
  if (best) return best;

  // 2) 폴백: 쉼표가 들어간 금액 중 가장 큰 값
  const all = Array.from(text.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+)/g))
    .map((mm) => num(mm[1]))
    .filter((n) => n >= 100);
  return all.length ? Math.max(...all) : null;
}

function parseContent(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const skip = ['합계', '총액', '결제', '카드', '현금', '영수증', '사업자', '대표', '주소', '전화', 'TEL'];
  for (const line of lines) {
    if (!/[가-힣]/.test(line)) continue;
    if (line.length < 2 || line.length > 20) continue;
    if (/\d{3,}/.test(line)) continue;
    if (skip.some((k) => line.includes(k))) continue;
    const cleaned = line.replace(/[^가-힣A-Za-z0-9 ()&]/g, '').trim();
    if (cleaned.length >= 2) return cleaned;
  }
  return null;
}

const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ['식비', ['식당', '카페', '커피', '스타벅스', '베이커리', '음식', '분식', '치킨', '피자', '버거', '레스토랑', 'cafe', 'coffee']],
  ['교통', ['주유', '택시', '버스', '지하철', '교통', '주차', '철도', 'ktx', '고속']],
  ['쇼핑', ['마트', '백화점', '의류', '편의점', 'gs25', 'cu', '세븐일레븐', '이마트', '홈플러스', '쿠팡', '올리브영']],
  ['의료', ['약국', '병원', '의원', '치과', '한의원', '클리닉']],
  ['생활', ['통신', '관리비', '공과금', '전기', '가스', '수도', '인터넷']],
  ['여가', ['영화', 'cgv', '롯데시네마', '메가박스', '노래', 'pc방', '게임', '서점']],
];

function guessCategory(text: string): Category {
  const lower = text.toLowerCase();
  for (const [cat, keys] of CATEGORY_KEYWORDS) {
    if (keys.some((k) => lower.includes(k))) return cat;
  }
  return '기타';
}

function guessPayment(text: string): PaymentMethod {
  if (/현금/.test(text)) return '현금';
  if (/계좌|이체/.test(text)) return '계좌이체';
  if (/신용|체크|카드|승인/.test(text)) return '카드';
  return '카드';
}
