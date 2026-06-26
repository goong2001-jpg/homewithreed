import { ExtractedFields } from '../types';

export async function resizeImage(dataUrl: string, maxSize = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

export async function extractFromImage(
  imageDataUrl: string,
  apiKey: string
): Promise<ExtractedFields> {
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('유효하지 않은 이미지 형식입니다.');

  const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const base64Data = match[2];

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data }
        },
        {
          type: 'text',
          text: `이 영수증 또는 결제 화면 이미지에서 정보를 추출해줘.
다음 JSON 형식으로만 응답해줘 (다른 텍스트나 설명 없이):
{"date":"YYYY-MM-DD","category":"식비|교통|쇼핑|의료|생활|여가|기타","content":"구매내용 또는 상호명","amount":숫자만,"type":"지출|입금","paymentMethod":"현금|카드|계좌이체|기타"}
확실하지 않은 필드는 null로 해줘. amount는 숫자만 (쉼표, 원화 기호 없이).`
        }
      ]
    }]
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned) as ExtractedFields;
}
