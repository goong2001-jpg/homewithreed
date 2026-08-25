import { LessonSet } from './types';

/**
 * 여행·일상에서 바로 쓰는 20세트.
 * 각 세트는 단어 1개와, 그 단어가 그대로 들어간 회화 1개로 짝을 이룬다.
 * (회화에 단어가 통째로 들어가야 빈칸 문제를 만들 수 있다)
 */
export const LESSONS: LessonSet[] = [
  {
    id: 1,
    category: '인사',
    word: { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: '안녕하세요' },
    phrase: {
      hanzi: '你好，很高兴认识你。',
      pinyin: 'Nǐ hǎo, hěn gāoxìng rènshi nǐ.',
      meaning: '안녕하세요, 만나서 반갑습니다.',
      situation: '처음 인사할 때',
    },
    tip: '아무 때나 쓸 수 있는 만능 인사. 시간대와 상관없이 통합니다.',
  },
  {
    id: 2,
    category: '인사',
    word: { hanzi: '谢谢', pinyin: 'xièxie', meaning: '고맙습니다' },
    phrase: {
      hanzi: '谢谢你的帮助。',
      pinyin: 'Xièxie nǐ de bāngzhù.',
      meaning: '도와주셔서 감사합니다.',
      situation: '도움을 받았을 때',
    },
    tip: '대답은 不客气(bú kèqi, 천만에요). 같이 외워두면 좋습니다.',
  },
  {
    id: 3,
    category: '인사',
    word: { hanzi: '对不起', pinyin: 'duìbuqǐ', meaning: '죄송합니다' },
    phrase: {
      hanzi: '对不起，请让一下。',
      pinyin: 'Duìbuqǐ, qǐng ràng yíxià.',
      meaning: '실례합니다, 좀 지나갈게요.',
      situation: '사람 사이를 지나갈 때',
    },
    tip: '사과와 "실례합니다"를 겸합니다. 지하철에서 제일 많이 씁니다.',
  },
  {
    id: 4,
    category: '인사',
    word: { hanzi: '再见', pinyin: 'zàijiàn', meaning: '안녕히 가세요' },
    phrase: {
      hanzi: '再见，下次见！',
      pinyin: 'Zàijiàn, xià cì jiàn!',
      meaning: '안녕히 가세요, 다음에 봐요!',
      situation: '헤어질 때',
    },
    tip: '再(다시) + 见(보다) = 다시 봐요. 글자를 뜯어보면 안 잊힙니다.',
  },
  {
    id: 5,
    category: '소통',
    word: { hanzi: '慢', pinyin: 'màn', meaning: '느리다, 천천히' },
    phrase: {
      hanzi: '请说慢一点。',
      pinyin: 'Qǐng shuō màn yìdiǎn.',
      meaning: '조금 천천히 말해 주세요.',
      situation: '상대가 너무 빨리 말할 때',
    },
    tip: '이 한마디면 대화가 반은 풀립니다. 여행 중 사용 빈도 1위.',
  },
  {
    id: 6,
    category: '소통',
    word: { hanzi: '帮', pinyin: 'bāng', meaning: '돕다' },
    phrase: {
      hanzi: '能帮我一下吗？',
      pinyin: 'Néng bāng wǒ yíxià ma?',
      meaning: '좀 도와주실 수 있나요?',
      situation: '도움을 요청할 때',
    },
    tip: '能…吗?는 "…할 수 있나요?" 부탁을 부드럽게 만드는 틀입니다.',
  },
  {
    id: 7,
    category: '소통',
    word: { hanzi: '洗手间', pinyin: 'xǐshǒujiān', meaning: '화장실' },
    phrase: {
      hanzi: '洗手间在哪里？',
      pinyin: 'Xǐshǒujiān zài nǎlǐ?',
      meaning: '화장실이 어디예요?',
      situation: '급할 때',
    },
    tip: '在哪里?(zài nǎlǐ, 어디예요?)만 알면 어떤 장소든 물어볼 수 있습니다.',
  },
  {
    id: 8,
    category: '쇼핑',
    word: { hanzi: '多少钱', pinyin: 'duōshao qián', meaning: '얼마예요' },
    phrase: {
      hanzi: '这个多少钱？',
      pinyin: 'Zhège duōshao qián?',
      meaning: '이거 얼마예요?',
      situation: '가격을 물을 때',
    },
    tip: '这个(zhège, 이것)를 손가락으로 가리키며 말하면 끝납니다.',
  },
  {
    id: 9,
    category: '쇼핑',
    word: { hanzi: '便宜', pinyin: 'piányi', meaning: '싸다' },
    phrase: {
      hanzi: '太贵了，便宜一点吧。',
      pinyin: 'Tài guì le, piányi yìdiǎn ba.',
      meaning: '너무 비싸요, 좀 깎아주세요.',
      situation: '시장에서 값을 깎을 때',
    },
    tip: '贵(guì)는 비싸다. 太…了는 "너무 …하다"입니다.',
  },
  {
    id: 10,
    category: '쇼핑',
    word: { hanzi: '微信', pinyin: 'wēixìn', meaning: '위챗' },
    phrase: {
      hanzi: '可以用微信支付吗？',
      pinyin: 'Kěyǐ yòng wēixìn zhīfù ma?',
      meaning: '위챗페이로 결제할 수 있나요?',
      situation: '계산 방법을 물을 때',
    },
    tip: '중국은 현금보다 QR 결제가 기본. 支付(zhīfù)가 "결제"입니다.',
  },
  {
    id: 11,
    category: '식당',
    word: { hanzi: '菜单', pinyin: 'càidān', meaning: '메뉴판' },
    phrase: {
      hanzi: '请给我菜单。',
      pinyin: 'Qǐng gěi wǒ càidān.',
      meaning: '메뉴판 좀 주세요.',
      situation: '자리에 앉은 뒤',
    },
    tip: '请给我…(qǐng gěi wǒ, …주세요)는 뒤에 아무 물건이나 붙여 쓰면 됩니다.',
  },
  {
    id: 12,
    category: '식당',
    word: { hanzi: '水', pinyin: 'shuǐ', meaning: '물' },
    phrase: {
      hanzi: '请给我一杯水。',
      pinyin: 'Qǐng gěi wǒ yì bēi shuǐ.',
      meaning: '물 한 잔 주세요.',
      situation: '물이 필요할 때',
    },
    tip: '중국 식당의 기본은 따뜻한 물. 찬물은 冰水(bīngshuǐ)라고 합니다.',
  },
  {
    id: 13,
    category: '식당',
    word: { hanzi: '辣', pinyin: 'là', meaning: '맵다' },
    phrase: {
      hanzi: '我不能吃辣。',
      pinyin: 'Wǒ bù néng chī là.',
      meaning: '저는 매운 걸 못 먹어요.',
      situation: '주문 전에 미리 말할 때',
    },
    tip: '주문할 때 먼저 말해야 합니다. 나온 뒤에는 못 바꿔줍니다.',
  },
  {
    id: 14,
    category: '식당',
    word: { hanzi: '结账', pinyin: 'jiézhàng', meaning: '계산하다' },
    phrase: {
      hanzi: '服务员，结账。',
      pinyin: 'Fúwùyuán, jiézhàng.',
      meaning: '저기요, 계산할게요.',
      situation: '식사를 마치고',
    },
    tip: '服务员(fúwùyuán)은 종업원을 부르는 말. 손을 들고 부르면 됩니다.',
  },
  {
    id: 15,
    category: '교통',
    word: { hanzi: '机场', pinyin: 'jīchǎng', meaning: '공항' },
    phrase: {
      hanzi: '请送我去机场。',
      pinyin: 'Qǐng sòng wǒ qù jīchǎng.',
      meaning: '공항까지 가주세요.',
      situation: '택시를 탔을 때',
    },
    tip: '去(qù, 가다) 뒤의 장소만 바꾸면 어디든 갈 수 있습니다.',
  },
  {
    id: 16,
    category: '교통',
    word: { hanzi: '地铁', pinyin: 'dìtiě', meaning: '지하철' },
    phrase: {
      hanzi: '地铁站怎么走？',
      pinyin: 'Dìtiě zhàn zěnme zǒu?',
      meaning: '지하철역은 어떻게 가나요?',
      situation: '길을 물을 때',
    },
    tip: '怎么走?(zěnme zǒu, 어떻게 가요?)는 길 찾기 만능 문장입니다.',
  },
  {
    id: 17,
    category: '교통',
    word: { hanzi: '这里', pinyin: 'zhèlǐ', meaning: '여기' },
    phrase: {
      hanzi: '请停在这里。',
      pinyin: 'Qǐng tíng zài zhèlǐ.',
      meaning: '여기서 세워 주세요.',
      situation: '택시에서 내릴 때',
    },
    tip: '停(tíng)은 멈추다. 지도를 보여주며 말하면 확실합니다.',
  },
  {
    id: 18,
    category: '숙소',
    word: { hanzi: '入住', pinyin: 'rùzhù', meaning: '체크인' },
    phrase: {
      hanzi: '我要办理入住。',
      pinyin: 'Wǒ yào bànlǐ rùzhù.',
      meaning: '체크인 하려고요.',
      situation: '호텔 프런트에서',
    },
    tip: '체크아웃은 退房(tuìfáng). 여권을 함께 내밀면 빠릅니다.',
  },
  {
    id: 19,
    category: '숙소',
    word: { hanzi: '密码', pinyin: 'mìmǎ', meaning: '비밀번호' },
    phrase: {
      hanzi: 'WiFi密码是多少？',
      pinyin: 'WiFi mìmǎ shì duōshao?',
      meaning: '와이파이 비밀번호가 뭐예요?',
      situation: '호텔·카페에서',
    },
    tip: '是多少?(shì duōshao?)는 숫자를 물을 때 쓰는 표현입니다.',
  },
  {
    id: 20,
    category: '위급',
    word: { hanzi: '医院', pinyin: 'yīyuàn', meaning: '병원' },
    phrase: {
      hanzi: '我不舒服，要去医院。',
      pinyin: 'Wǒ bù shūfu, yào qù yīyuàn.',
      meaning: '몸이 안 좋아요, 병원에 가야 해요.',
      situation: '아플 때',
    },
    tip: '不舒服(bù shūfu)는 "몸이 안 좋다". 응급 전화는 120입니다.',
  },
];

export function findLesson(id: number): LessonSet | undefined {
  return LESSONS.find((l) => l.id === id);
}
