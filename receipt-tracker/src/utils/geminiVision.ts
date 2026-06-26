import { ExtractedFields } from '../types';

// 무료 한도가 넉넉한 Gemini Flash 모델
const MODEL = 'gemini-2.0-flash';

/**
 * Google Gemini API로 영수증 이미지를 분석해 항목을 추출합니다.
 * 무료 API 키만 있으면 되고, 브라우저에서 직접 호출합니다.
 */
export async function extractFromImage(
  imageDataUrl: string,
  apiKey: string
): Promise<ExtractedFields> {
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('유효하지 않은 이미지 형식입니다.');

  const mimeType = match[1];
  const base64Data = match[2];

  const prompt = `이 영수증 또는 결제 화면 이미지에서 정보를 추출해줘.
다음 JSON 형식으로만 응답해줘:
{"date":"YYYY-MM-DD","category":"식비|교통|쇼핑|의료|생활|여가|기타","content":"구매내용 또는 상호명","amount":숫자,"type":"지출|입금","paymentMethod":"현금|카드|계좌이체|기타"}
규칙:
- amount는 숫자만 (쉼표·원화기호 없이). 합계/결제금액 기준.
- 확실하지 않은 필드는 null.
- 카드/계좌 입금이나 환불이면 type을 "입금"으로.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    const msg = (err as any)?.error?.message || `API 오류: ${res.status}`;
    if (res.status === 400 && /API key/i.test(msg)) {
      throw new Error('API 키가 올바르지 않습니다. 설정을 확인해주세요.');
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('인식 결과가 비어 있습니다.');

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned) as ExtractedFields;
}
