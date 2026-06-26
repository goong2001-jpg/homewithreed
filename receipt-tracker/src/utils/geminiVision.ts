import { ExtractedFields } from '../types';

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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      return JSON.parse(cleaned) as ExtractedFields;
    }

    lastMessage = r.message || `API 오류: ${r.status}`;

    // API 키 자체가 잘못된 경우는 다른 모델을 시도해도 소용없음
    if (r.status === 400 && /API key|API_KEY_INVALID/i.test(lastMessage)) {
      throw new Error('API 키가 올바르지 않습니다. 설정에서 키를 확인해주세요.');
    }

    // 할당량 초과(429)/모델 없음(404)/일시적 오류(503)면 다음 모델로 자동 전환
    if (r.status === 429 || r.status === 404 || r.status === 503) {
      if (r.status === 429) quotaHit = true;
      continue;
    }

    // 그 외 오류도 일단 다음 모델 시도
  }

  if (quotaHit) {
    throw new Error('오늘 무료 사용량을 모두 썼어요. 잠시 후(또는 내일 오후 5시 이후) 다시 시도해주세요.');
  }
  throw new Error(lastMessage || '인식에 실패했습니다.');
}
