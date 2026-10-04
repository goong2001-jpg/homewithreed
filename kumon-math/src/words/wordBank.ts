export interface Word {
  /** 영어 단어 */
  en: string;
  /** 뜻 */
  ko: string;
  /** 그림 대신 보여줄 이모지 */
  emoji: string;
}

/**
 * 7살 아이를 위한 기초 영단어. 매일 10개씩 겹치지 않게 뽑아 쓴다.
 * 단어 수가 많을수록 같은 단어가 다시 나오기까지 오래 걸린다.
 */
export const WORD_BANK: Word[] = [
  // 동물
  { en: 'dog', ko: '강아지', emoji: '🐶' }, { en: 'cat', ko: '고양이', emoji: '🐱' },
  { en: 'rabbit', ko: '토끼', emoji: '🐰' }, { en: 'bear', ko: '곰', emoji: '🐻' },
  { en: 'panda', ko: '판다', emoji: '🐼' }, { en: 'lion', ko: '사자', emoji: '🦁' },
  { en: 'tiger', ko: '호랑이', emoji: '🐯' }, { en: 'monkey', ko: '원숭이', emoji: '🐵' },
  { en: 'pig', ko: '돼지', emoji: '🐷' }, { en: 'cow', ko: '소', emoji: '🐮' },
  { en: 'horse', ko: '말', emoji: '🐴' }, { en: 'sheep', ko: '양', emoji: '🐑' },
  { en: 'chicken', ko: '닭', emoji: '🐔' }, { en: 'duck', ko: '오리', emoji: '🦆' },
  { en: 'bird', ko: '새', emoji: '🐦' }, { en: 'owl', ko: '부엉이', emoji: '🦉' },
  { en: 'penguin', ko: '펭귄', emoji: '🐧' }, { en: 'frog', ko: '개구리', emoji: '🐸' },
  { en: 'snake', ko: '뱀', emoji: '🐍' }, { en: 'turtle', ko: '거북이', emoji: '🐢' },
  { en: 'fish', ko: '물고기', emoji: '🐟' }, { en: 'whale', ko: '고래', emoji: '🐳' },
  { en: 'dolphin', ko: '돌고래', emoji: '🐬' }, { en: 'shark', ko: '상어', emoji: '🦈' },
  { en: 'octopus', ko: '문어', emoji: '🐙' }, { en: 'crab', ko: '게', emoji: '🦀' },
  { en: 'butterfly', ko: '나비', emoji: '🦋' }, { en: 'bee', ko: '벌', emoji: '🐝' },
  { en: 'ant', ko: '개미', emoji: '🐜' }, { en: 'spider', ko: '거미', emoji: '🕷️' },
  { en: 'elephant', ko: '코끼리', emoji: '🐘' }, { en: 'giraffe', ko: '기린', emoji: '🦒' },
  { en: 'zebra', ko: '얼룩말', emoji: '🦓' }, { en: 'deer', ko: '사슴', emoji: '🦌' },
  { en: 'fox', ko: '여우', emoji: '🦊' }, { en: 'wolf', ko: '늑대', emoji: '🐺' },
  { en: 'mouse', ko: '쥐', emoji: '🐭' }, { en: 'squirrel', ko: '다람쥐', emoji: '🐿️' },
  { en: 'hedgehog', ko: '고슴도치', emoji: '🦔' }, { en: 'koala', ko: '코알라', emoji: '🐨' },

  // 과일 · 채소 · 음식
  { en: 'apple', ko: '사과', emoji: '🍎' }, { en: 'banana', ko: '바나나', emoji: '🍌' },
  { en: 'grape', ko: '포도', emoji: '🍇' }, { en: 'orange', ko: '오렌지', emoji: '🍊' },
  { en: 'strawberry', ko: '딸기', emoji: '🍓' }, { en: 'watermelon', ko: '수박', emoji: '🍉' },
  { en: 'peach', ko: '복숭아', emoji: '🍑' }, { en: 'pear', ko: '배', emoji: '🍐' },
  { en: 'lemon', ko: '레몬', emoji: '🍋' }, { en: 'cherry', ko: '체리', emoji: '🍒' },
  { en: 'pineapple', ko: '파인애플', emoji: '🍍' }, { en: 'mango', ko: '망고', emoji: '🥭' },
  { en: 'kiwi', ko: '키위', emoji: '🥝' }, { en: 'tomato', ko: '토마토', emoji: '🍅' },
  { en: 'carrot', ko: '당근', emoji: '🥕' }, { en: 'potato', ko: '감자', emoji: '🥔' },
  { en: 'corn', ko: '옥수수', emoji: '🌽' }, { en: 'cucumber', ko: '오이', emoji: '🥒' },
  { en: 'onion', ko: '양파', emoji: '🧅' }, { en: 'garlic', ko: '마늘', emoji: '🧄' },
  { en: 'bread', ko: '빵', emoji: '🍞' }, { en: 'cheese', ko: '치즈', emoji: '🧀' },
  { en: 'egg', ko: '달걀', emoji: '🥚' }, { en: 'milk', ko: '우유', emoji: '🥛' },
  { en: 'rice', ko: '밥', emoji: '🍚' }, { en: 'noodle', ko: '국수', emoji: '🍜' },
  { en: 'pizza', ko: '피자', emoji: '🍕' }, { en: 'hamburger', ko: '햄버거', emoji: '🍔' },
  { en: 'sandwich', ko: '샌드위치', emoji: '🥪' }, { en: 'cake', ko: '케이크', emoji: '🍰' },
  { en: 'cookie', ko: '쿠키', emoji: '🍪' }, { en: 'candy', ko: '사탕', emoji: '🍬' },
  { en: 'chocolate', ko: '초콜릿', emoji: '🍫' }, { en: 'ice cream', ko: '아이스크림', emoji: '🍦' },
  { en: 'juice', ko: '주스', emoji: '🧃' }, { en: 'water', ko: '물', emoji: '💧' },
  { en: 'honey', ko: '꿀', emoji: '🍯' }, { en: 'soup', ko: '수프', emoji: '🍲' },
  { en: 'popcorn', ko: '팝콘', emoji: '🍿' }, { en: 'donut', ko: '도넛', emoji: '🍩' },

  // 자연 · 날씨
  { en: 'sun', ko: '해', emoji: '☀️' }, { en: 'moon', ko: '달', emoji: '🌙' },
  { en: 'star', ko: '별', emoji: '⭐' }, { en: 'cloud', ko: '구름', emoji: '☁️' },
  { en: 'rain', ko: '비', emoji: '🌧️' }, { en: 'snow', ko: '눈', emoji: '❄️' },
  { en: 'rainbow', ko: '무지개', emoji: '🌈' }, { en: 'fire', ko: '불', emoji: '🔥' },
  { en: 'tree', ko: '나무', emoji: '🌳' }, { en: 'flower', ko: '꽃', emoji: '🌸' },
  { en: 'leaf', ko: '나뭇잎', emoji: '🍃' }, { en: 'mountain', ko: '산', emoji: '⛰️' },
  { en: 'sea', ko: '바다', emoji: '🌊' }, { en: 'beach', ko: '해변', emoji: '🏖️' },
  { en: 'forest', ko: '숲', emoji: '🌲' }, { en: 'rock', ko: '바위', emoji: '🪨' },
  { en: 'earth', ko: '지구', emoji: '🌍' }, { en: 'lightning', ko: '번개', emoji: '⚡' },
  { en: 'volcano', ko: '화산', emoji: '🌋' }, { en: 'island', ko: '섬', emoji: '🏝️' },

  // 몸
  { en: 'eye', ko: '눈', emoji: '👁️' }, { en: 'nose', ko: '코', emoji: '👃' },
  { en: 'mouth', ko: '입', emoji: '👄' }, { en: 'ear', ko: '귀', emoji: '👂' },
  { en: 'hand', ko: '손', emoji: '✋' }, { en: 'foot', ko: '발', emoji: '🦶' },
  { en: 'leg', ko: '다리', emoji: '🦵' }, { en: 'arm', ko: '팔', emoji: '💪' },
  { en: 'tooth', ko: '이빨', emoji: '🦷' }, { en: 'tongue', ko: '혀', emoji: '👅' },
  { en: 'face', ko: '얼굴', emoji: '🙂' }, { en: 'brain', ko: '뇌', emoji: '🧠' },
  { en: 'heart', ko: '심장', emoji: '❤️' }, { en: 'bone', ko: '뼈', emoji: '🦴' },

  // 사람 · 가족 · 직업
  { en: 'mom', ko: '엄마', emoji: '👩' }, { en: 'dad', ko: '아빠', emoji: '👨' },
  { en: 'baby', ko: '아기', emoji: '👶' }, { en: 'boy', ko: '남자아이', emoji: '👦' },
  { en: 'girl', ko: '여자아이', emoji: '👧' }, { en: 'family', ko: '가족', emoji: '👨‍👩‍👧' },
  { en: 'friend', ko: '친구', emoji: '🤝' }, { en: 'teacher', ko: '선생님', emoji: '👩‍🏫' },
  { en: 'doctor', ko: '의사', emoji: '🧑‍⚕️' }, { en: 'police', ko: '경찰', emoji: '👮' },
  { en: 'chef', ko: '요리사', emoji: '🧑‍🍳' }, { en: 'farmer', ko: '농부', emoji: '🧑‍🌾' },
  { en: 'king', ko: '왕', emoji: '🤴' }, { en: 'queen', ko: '여왕', emoji: '👸' },
  { en: 'firefighter', ko: '소방관', emoji: '🧑‍🚒' }, { en: 'singer', ko: '가수', emoji: '🧑‍🎤' },

  // 물건 · 학교
  { en: 'book', ko: '책', emoji: '📚' }, { en: 'pencil', ko: '연필', emoji: '✏️' },
  { en: 'pen', ko: '펜', emoji: '🖊️' }, { en: 'crayon', ko: '크레용', emoji: '🖍️' },
  { en: 'ruler', ko: '자', emoji: '📏' }, { en: 'scissors', ko: '가위', emoji: '✂️' },
  { en: 'bag', ko: '가방', emoji: '🎒' }, { en: 'chair', ko: '의자', emoji: '🪑' },
  { en: 'clock', ko: '시계', emoji: '🕐' }, { en: 'computer', ko: '컴퓨터', emoji: '💻' },
  { en: 'phone', ko: '전화', emoji: '📱' }, { en: 'camera', ko: '카메라', emoji: '📷' },
  { en: 'television', ko: '텔레비전', emoji: '📺' }, { en: 'key', ko: '열쇠', emoji: '🔑' },
  { en: 'door', ko: '문', emoji: '🚪' }, { en: 'window', ko: '창문', emoji: '🪟' },
  { en: 'bed', ko: '침대', emoji: '🛏️' }, { en: 'lamp', ko: '전등', emoji: '💡' },
  { en: 'cup', ko: '컵', emoji: '🥤' }, { en: 'spoon', ko: '숟가락', emoji: '🥄' },
  { en: 'fork', ko: '포크', emoji: '🍴' }, { en: 'knife', ko: '칼', emoji: '🔪' },
  { en: 'box', ko: '상자', emoji: '📦' }, { en: 'ball', ko: '공', emoji: '⚽' },
  { en: 'balloon', ko: '풍선', emoji: '🎈' }, { en: 'gift', ko: '선물', emoji: '🎁' },
  { en: 'umbrella', ko: '우산', emoji: '☂️' }, { en: 'hat', ko: '모자', emoji: '🎩' },
  { en: 'shoes', ko: '신발', emoji: '👟' }, { en: 'shirt', ko: '셔츠', emoji: '👕' },
  { en: 'pants', ko: '바지', emoji: '👖' }, { en: 'dress', ko: '원피스', emoji: '👗' },
  { en: 'socks', ko: '양말', emoji: '🧦' }, { en: 'glasses', ko: '안경', emoji: '👓' },
  { en: 'ring', ko: '반지', emoji: '💍' }, { en: 'watch', ko: '손목시계', emoji: '⌚' },
  { en: 'money', ko: '돈', emoji: '💰' }, { en: 'robot', ko: '로봇', emoji: '🤖' },
  { en: 'doll', ko: '인형', emoji: '🧸' }, { en: 'puzzle', ko: '퍼즐', emoji: '🧩' },

  // 탈것
  { en: 'car', ko: '자동차', emoji: '🚗' }, { en: 'bus', ko: '버스', emoji: '🚌' },
  { en: 'train', ko: '기차', emoji: '🚆' }, { en: 'airplane', ko: '비행기', emoji: '✈️' },
  { en: 'ship', ko: '배', emoji: '🚢' }, { en: 'boat', ko: '보트', emoji: '🛶' },
  { en: 'bike', ko: '자전거', emoji: '🚲' }, { en: 'taxi', ko: '택시', emoji: '🚕' },
  { en: 'truck', ko: '트럭', emoji: '🚚' }, { en: 'rocket', ko: '로켓', emoji: '🚀' },
  { en: 'helicopter', ko: '헬리콥터', emoji: '🚁' }, { en: 'ambulance', ko: '구급차', emoji: '🚑' },
  { en: 'tractor', ko: '트랙터', emoji: '🚜' }, { en: 'scooter', ko: '킥보드', emoji: '🛴' },

  // 장소
  { en: 'house', ko: '집', emoji: '🏠' }, { en: 'school', ko: '학교', emoji: '🏫' },
  { en: 'hospital', ko: '병원', emoji: '🏥' }, { en: 'store', ko: '가게', emoji: '🏪' },
  { en: 'castle', ko: '성', emoji: '🏰' }, { en: 'tent', ko: '텐트', emoji: '⛺' },
  { en: 'bridge', ko: '다리', emoji: '🌉' }, { en: 'garden', ko: '정원', emoji: '🌷' },
  { en: 'playground', ko: '놀이터', emoji: '🛝' }, { en: 'museum', ko: '박물관', emoji: '🏛️' },
  { en: 'park', ko: '공원', emoji: '🎠' }, { en: 'farm', ko: '농장', emoji: '🏡' },

  // 색깔
  { en: 'red', ko: '빨강', emoji: '🔴' }, { en: 'blue', ko: '파랑', emoji: '🔵' },
  { en: 'yellow', ko: '노랑', emoji: '🟡' }, { en: 'green', ko: '초록', emoji: '🟢' },
  { en: 'purple', ko: '보라', emoji: '🟣' }, { en: 'black', ko: '검정', emoji: '⚫' },
  { en: 'white', ko: '하양', emoji: '⚪' }, { en: 'brown', ko: '갈색', emoji: '🟤' },

  // 움직임
  { en: 'run', ko: '달리다', emoji: '🏃' }, { en: 'walk', ko: '걷다', emoji: '🚶' },
  { en: 'jump', ko: '뛰다', emoji: '🤸' }, { en: 'swim', ko: '수영하다', emoji: '🏊' },
  { en: 'sleep', ko: '자다', emoji: '😴' }, { en: 'eat', ko: '먹다', emoji: '😋' },
  { en: 'drink', ko: '마시다', emoji: '🧋' }, { en: 'read', ko: '읽다', emoji: '📖' },
  { en: 'write', ko: '쓰다', emoji: '✍️' }, { en: 'sing', ko: '노래하다', emoji: '🎤' },
  { en: 'dance', ko: '춤추다', emoji: '💃' }, { en: 'draw', ko: '그리다', emoji: '🎨' },
  { en: 'cook', ko: '요리하다', emoji: '🍳' }, { en: 'wash', ko: '씻다', emoji: '🧼' },
  { en: 'laugh', ko: '웃다', emoji: '😂' }, { en: 'cry', ko: '울다', emoji: '😢' },
  { en: 'smile', ko: '미소짓다', emoji: '😊' }, { en: 'think', ko: '생각하다', emoji: '🤔' },

  // 숫자
  { en: 'one', ko: '하나', emoji: '1️⃣' }, { en: 'two', ko: '둘', emoji: '2️⃣' },
  { en: 'three', ko: '셋', emoji: '3️⃣' }, { en: 'four', ko: '넷', emoji: '4️⃣' },
  { en: 'five', ko: '다섯', emoji: '5️⃣' }, { en: 'six', ko: '여섯', emoji: '6️⃣' },
  { en: 'seven', ko: '일곱', emoji: '7️⃣' }, { en: 'eight', ko: '여덟', emoji: '8️⃣' },
  { en: 'nine', ko: '아홉', emoji: '9️⃣' }, { en: 'ten', ko: '열', emoji: '🔟' },

  // 그 밖에
  { en: 'music', ko: '음악', emoji: '🎵' }, { en: 'game', ko: '게임', emoji: '🎮' },
  { en: 'movie', ko: '영화', emoji: '🎬' }, { en: 'picture', ko: '그림', emoji: '🖼️' },
  { en: 'letter', ko: '편지', emoji: '✉️' }, { en: 'map', ko: '지도', emoji: '🗺️' },
  { en: 'birthday', ko: '생일', emoji: '🎂' }, { en: 'crown', ko: '왕관', emoji: '👑' },
  { en: 'magic', ko: '마법', emoji: '🪄' }, { en: 'dream', ko: '꿈', emoji: '💭' },
];
