import { Category, ExtractedFields, PaymentMethod, TransactionType } from '../types';

const CATEGORIES: Category[] = ['식비', '교통', '쇼핑', '의료', '생활', '여가', '기타'];
const TYPES: TransactionType[] = ['지출', '입금'];
const PAYMENT_METHODS: PaymentMethod[] = ['현금', '카드', '계좌이체', '기타'];

/**
 * 모델이 돌려준 JSON 을 그대로 믿지 않고 한 번 거른다.
 * 형식이 어긋난 값은 비워 두어 사용자가 폼에서 직접 채우게 한다.
 *  - date: YYYY-MM-DD 가 아니면 비움
 *  - amount: 유한한 0 이상 숫자가 아니면 비움 (쉼표·원 기호가 섞인 문자열은 숫자로 풀어본다)
 *  - category / type / paymentMethod: 허용된 값이 아니면 비움 (폼이 기본값을 고른다)
 */
export function normalizeExtracted(raw: unknown): ExtractedFields {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: ExtractedFields = {};

  if (typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) out.date = o.date;

  const amountText = typeof o.amount === 'string' ? o.amount.replace(/[^\d.-]/g, '') : '';
  const amount = typeof o.amount === 'number'
    ? o.amount
    : amountText ? Number(amountText) : NaN;   // Number('') 은 0 이라 빈 문자열은 따로 거른다
  if (Number.isFinite(amount) && amount >= 0) out.amount = amount;

  if (typeof o.content === 'string' && o.content.trim()) out.content = o.content.trim();

  if (typeof o.category === 'string' && (CATEGORIES as string[]).includes(o.category)) {
    out.category = o.category as Category;
  }
  if (typeof o.type === 'string' && (TYPES as string[]).includes(o.type)) {
    out.type = o.type as TransactionType;
  }
  if (typeof o.paymentMethod === 'string' && (PAYMENT_METHODS as string[]).includes(o.paymentMethod)) {
    out.paymentMethod = o.paymentMethod as PaymentMethod;
  }
  return out;
}

// 무료 한도가 있는 모델을 우선순위대로 시도 (앞 모델이 막히면 다음으로 자동 전환)
// 2026년 기준: 2.0-flash는 무료 한도 0이라 제외, 2.5 계열 사용
const MODELS = [
  'gemini-2.5-flash',       // 품질 좋음 (무료 ~250건/일)
  'gemini-2.5-flash-lite',  // 한도 큼   (무료 ~1000건/일)
  'gemini-flash-latest',    // 미래 대비 별칭
];

const PROMPT = `이 영수증 또는 결제 화면 이미지에서 정보를 추출해줘.
다음 JSON 형식으로만 응답해줘:
{"date":"YYYY-MM-DD","category":"식비|교통|쇼핑|의료|생활|여가|기타","content":"구매내용 또는 상호명","amount":숫자,"type":"지출|입금","paymentMethod":"현금|카드|계좌이체|기타"}
규칙:
- amount는 숫자만 (쉼표·원화기호 없이). 합계/결제금액 기준.
- 확실하지 않은 필드는 null.
- 카드/계좌 입금이나 환불이면 type을 "입금"으로.`;

interface CallResult {
  ok: boolean;
  status: number;
  data: any;
  message?: string;
}

async function callModel(model: string, mimeType: string, base64Data: string, apiKey: string): Promise<CallResult> {
  // 키는 URL(?key=)이 아니라 헤더로 보낸다 — URL 은 브라우저 기록·프록시 로그에 남는다
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    data,
    message: data?.error?.message,
  };
}

/**
 * Google Gemini API로 영수증 이미지를 분석해 항목을 추출합니다.
 * 무료 한도가 있는 모델을 자동으로 골라 사용합니다.
 */
export async function extractFromImage(
  imageDataUrl: string,
  apiKey: string
): Promise<ExtractedFields> {
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('유효하지 않은 이미지 형식입니다.');

  const mimeType = match[1];
  const base64Data = match[2];

  let lastMessage = '';
  let quotaHit = false;

  for (const model of MODELS) {
    const r = await callModel(model, mimeType, base64Data, apiKey);

    if (r.ok) {
      const text: string | undefined = r.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('인식 결과가 비어 있습니다.');
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error('인식 결과를 읽지 못했습니다. 직접 입력해주세요.');
      }
      return normalizeExtracted(parsed);
    }

    lastMessage = r.message || `API 오류: ${r.status}`;

    // API 키 자체가 잘못된 경우는 다른 모델을 시도해도 소용없음
    if (r.status === 401 || r.status === 403
      || (r.status === 400 && /API key|API_KEY_INVALID/i.test(lastMessage))) {
      throw new Error('API 키가 올바르지 않거나 권한이 없습니다. 설정에서 키를 확인해주세요.');
    }

    // 할당량 초과(429)/모델 없음(404)/일시적 오류(503)면 다음 모델로 자동 전환
    if (r.status === 429 || r.status === 404 || r.status === 503) {
      if (r.status === 429) quotaHit = true;
      continue;
    }

    // 그 외(400 잘못된 요청, 500 등)는 모델을 바꿔도 같으므로 바로 알린다
    throw new Error(`인식에 실패했습니다 (${r.status}). ${lastMessage}`);
  }

  if (quotaHit) {
    throw new Error('오늘 무료 사용량을 모두 썼어요. 잠시 후(또는 내일 오후 5시 이후) 다시 시도해주세요.');
  }
  throw new Error(lastMessage || '인식에 실패했습니다.');
}
