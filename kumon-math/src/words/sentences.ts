import { Word } from './wordBank';

/**
 * 요정이 단어를 넣어 말하는 짧은 문장.
 * 단어만 외우는 데서 문장으로 넘어가는 첫걸음이다.
 * 7살이 듣고 따라 할 수 있게 3~6단어짜리 쉬운 문장만 쓴다.
 *
 * 단어마다 문장이 여러 개 있어서 볼 때마다 다른 말을 들려준다.
 * 한국어 뜻도 같이 붙여 아이가 문장의 뜻을 알 수 있게 한다.
 */
export interface Sentence { en: string; ko: string }

// ── 한국어 조사 ──────────────────────────────────────────────
/** 마지막 글자에 받침이 있는지 (한글이 아니면 없다고 본다) */
function batchim(k: string): number {
  const c = k.charCodeAt(k.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return 0;
  return c % 28;
}
const josa = (k: string, withB: string, withoutB: string) => (batchim(k) ? withB : withoutB);

/**
 * 한국어 틀의 {k...} 자리에 뜻을 넣는다.
 * {k} 그대로, {k이} 이/가, {k을} 을/를, {k은} 은/는, {k예} 이에요/예요, {k와} 과/와
 */
function fillKo(t: string, k: string): string {
  return t
    .replace(/\{k이\}/g, k + josa(k, '이', '가'))
    .replace(/\{k을\}/g, k + josa(k, '을', '를'))
    .replace(/\{k은\}/g, k + josa(k, '은', '는'))
    .replace(/\{k예\}/g, k + josa(k, '이에요', '예요'))
    .replace(/\{k와\}/g, k + josa(k, '과', '와'))
    .replace(/\{k\}/g, k);
}

// ── 영어 관사 ──────────────────────────────────────────────
/** 하나뿐이라 a 대신 the 를 쓰는 것 */
const THE = new Set(['sun', 'moon', 'earth', 'sea', 'sky']);
function withArticle(w: string): string {
  if (THE.has(w)) return `the ${w}`;
  return `${/^[aeiou]/.test(w) && w !== 'one' ? 'an' : 'a'} ${w}`;
}

/** 영어 틀: {w} 단어, {a} 관사 붙인 단어 */
type T = [string, string];
function fill(tpls: T[], word: Word): Sentence[] {
  return tpls.map(([en, ko]) => ({
    en: en.replace(/\{a\}/g, withArticle(word.en)).replace(/\{w\}/g, word.en),
    ko: fillKo(ko, word.ko),
  }));
}

const set = (s: string) => new Set(s.split(' '));

// ── 단어 묶음 ──────────────────────────────────────────────
const ANIMALS = set('dog cat rabbit bear panda lion tiger monkey pig cow horse sheep chicken duck bird owl penguin frog snake turtle fish whale dolphin shark octopus crab butterfly bee ant spider elephant giraffe zebra deer fox wolf mouse squirrel hedgehog koala alligator iguana ox otter jellyfish insect goat');
const FOOD = set('apple banana grape orange strawberry watermelon peach pear lemon cherry pineapple mango kiwi tomato carrot potato corn cucumber onion garlic egg pizza hamburger sandwich cake cookie donut olive nut');
const SOME_FOOD = set('bread cheese rice noodle candy chocolate popcorn honey soup');
SOME_FOOD.add('ice cream');
const DRINKS = set('milk juice water');
const NATURE = set('sun moon star cloud rainbow tree flower leaf rock earth volcano');
const BODY = set('eye nose mouth ear hand foot leg arm face tongue');
const MY_PEOPLE = set('mom dad family friend teacher uncle');
const JOBS = set('doctor chef farmer king queen firefighter singer astronaut');
const THINGS = set('book pencil pen crayon ruler bag cup spoon fork knife box ball balloon gift umbrella hat shirt dress ring watch robot doll puzzle map picture letter crown ax envelope net jar vase jacket vest yo-yo zipper shell phone camera key');
const HOME = set('chair clock computer television door window bed lamp');
const PAIRS = set('pants shoes socks glasses scissors underwear');
const RIDES = set('car bus train airplane ship boat bike taxi truck rocket helicopter ambulance tractor scooter van yacht');
const PLACES = set('house school hospital store castle tent bridge garden playground museum park farm beach forest mountain island igloo sea');
const COLORS = set('red blue yellow green purple black white brown');
const NUMBERS = set('one two three four five six seven eight nine ten');

const T_ANIMAL: T[] = [
  ['I see {a}.', '{k이} 보여요.'],
  ['Look at the {w}!', '{k을} 봐요!'],
  ['Hello, {w}!', '안녕, {k}!'],
  ['I like the {w}.', '나는 {k이} 좋아요.'],
  ['Where is the {w}?', '{k은} 어디 있을까?'],
  ['The {w} is my friend.', '{k은} 내 친구예요.'],
  ['Can you see the {w}?', '{k이} 보이나요?'],
  ['Let\'s draw {a}!', '{k을} 그려 봐요!'],
];
const T_FOOD: T[] = [
  ['I like the {w}.', '나는 {k이} 좋아요.'],
  ['Yummy! I eat {a}.', '냠냠! {k을} 먹어요.'],
  ['Can I have {a}?', '{k} 하나 주세요.'],
  ['The {w} is yummy!', '{k은} 맛있어요!'],
  ['I want {a}.', '{k} 먹고 싶어요.'],
  ['Look at this big {w}!', '이 커다란 {k을} 봐요!'],
  ['Mom, I want {a}!', '엄마, {k} 먹고 싶어요!'],
];
const T_SOME_FOOD: T[] = [
  ['I like {w}.', '나는 {k이} 좋아요.'],
  ['Yummy {w}!', '맛있는 {k}!'],
  ['Can I have some {w}?', '{k} 좀 주세요.'],
  ['I eat {w}.', '{k을} 먹어요.'],
  ['I want some {w}.', '{k} 먹고 싶어요.'],
];
const T_DRINK: T[] = [
  ['I drink {w}.', '{k을} 마셔요.'],
  ['Can I have some {w}?', '{k} 좀 주세요.'],
  ['I like {w}.', '나는 {k이} 좋아요.'],
  ['The {w} is cold.', '{k이} 시원해요.'],
  ['I want some {w}.', '{k} 마시고 싶어요.'],
];
const T_NATURE: T[] = [
  ['Look at the {w}!', '{k을} 봐요!'],
  ['I see {a}.', '{k이} 보여요.'],
  ['The {w} is so pretty!', '{k은} 정말 예뻐요!'],
  ['Let\'s draw {a}!', '{k을} 그려 봐요!'],
  ['Can you find the {w}?', '{k을} 찾을 수 있나요?'],
];
const T_BODY: T[] = [
  ['Touch your {w}.', '{k을} 만져 봐요.'],
  ['This is my {w}.', '이건 내 {k예}.'],
  ['Point to your {w}.', '{k을} 가리켜 봐요.'],
  ['Where is your {w}?', '{k은} 어디 있을까?'],
  ['Wash your {w}.', '{k을} 씻어요.'],
  ['Shake your {w}!', '{k을} 흔들어 봐요!'],
];
const T_MY_PEOPLE: T[] = [
  ['This is my {w}.', '우리 {k예}.'],
  ['I love my {w}.', '나는 우리 {k을} 사랑해요.'],
  ['Hi, {w}!', '안녕, {k}!'],
  ['Where is my {w}?', '우리 {k은} 어디 있을까?'],
  ['My {w} is kind.', '우리 {k은} 친절해요.'],
  ['I play with my {w}.', '나는 우리 {k와} 놀아요.'],
];
const T_JOB: T[] = [
  ['I see {a}.', '{k이} 보여요.'],
  ['I want to be {a}!', '나는 {k이} 되고 싶어요!'],
  ['The {w} is kind.', '{k은} 친절해요.'],
  ['Look at the {w}!', '{k을} 봐요!'],
];
const T_THING: T[] = [
  ['This is my {w}.', '이건 내 {k예}.'],
  ['Where is my {w}?', '내 {k은} 어디 있지?'],
  ['I have {a}.', '나는 {k이} 있어요.'],
  ['Look at my {w}!', '내 {k을} 봐요!'],
  ['I found {a}!', '{k을} 찾았어요!'],
  ['The {w} is on the table.', '{k은} 탁자 위에 있어요.'],
  ['Give me the {w}, please.', '{k을} 주세요.'],
  ['I like this {w}.', '나는 이 {k이} 좋아요.'],
];
const T_HOME: T[] = [
  ['Look at the {w}.', '{k을} 봐요.'],
  ['This is my {w}.', '이건 내 {k예}.'],
  ['Where is the {w}?', '{k은} 어디 있을까?'],
  ['Can you touch the {w}?', '{k을} 만져 볼 수 있나요?'],
  ['I see {a}.', '{k이} 보여요.'],
];
const T_PAIRS: T[] = [
  ['These are my {w}.', '이건 내 {k예}.'],
  ['Where are my {w}?', '내 {k은} 어디 있지?'],
  ['I like my {w}.', '내 {k이} 좋아요.'],
  ['Look at my {w}!', '내 {k을} 봐요!'],
  ['I found my {w}!', '내 {k을} 찾았어요!'],
];
const T_RIDE: T[] = [
  ['I see {a}.', '{k이} 보여요.'],
  ['Let\'s ride the {w}!', '{k을} 타자!'],
  ['The {w} is fast!', '{k은} 빨라요!'],
  ['Here comes the {w}!', '{k이} 와요!'],
  ['I like the {w}.', '나는 {k이} 좋아요.'],
  ['Look at the big {w}!', '커다란 {k을} 봐요!'],
];
const T_PLACE: T[] = [
  ['Let\'s go to the {w}!', '{k}에 가자!'],
  ['I see {a}.', '{k이} 보여요.'],
  ['I like the {w}.', '나는 {k이} 좋아요.'],
  ['Where is the {w}?', '{k은} 어디 있어요?'],
  ['The {w} is big.', '{k은} 커요.'],
];
const T_COLOR: T[] = [
  ['I like {w}.', '나는 {k이} 좋아요.'],
  ['My favorite color is {w}.', '내가 제일 좋아하는 색은 {k예}.'],
  ['I see something {w}.', '{k}색 물건이 보여요.'],
  ['Find something {w}!', '{k}색 물건을 찾아봐요!'],
];
/** 색깔마다 그 색인 것 */
const COLOR_THING: Record<string, [string, string]> = {
  red: ['apple', '사과'], blue: ['sky', '하늘'], yellow: ['banana', '바나나'],
  green: ['leaf', '나뭇잎'], purple: ['grape', '포도'], black: ['night', '밤하늘'],
  white: ['snow', '눈'], brown: ['bear', '곰'],
};
/** 숫자를 셀 때 쓰는 말 (한 개, 두 개 …) */
const COUNT_KO: Record<string, string> = {
  one: '한', two: '두', three: '세', four: '네', five: '다섯',
  six: '여섯', seven: '일곱', eight: '여덟', nine: '아홉', ten: '열',
};

/** 묶음 틀로 만들기 어려운 단어는 문장을 따로 적어 둔다 */
const SPECIAL: Record<string, T[]> = {
  // 움직임
  run: [['I can run fast!', '나는 빨리 달릴 수 있어요!'], ['Let\'s run!', '같이 달리자!'], ['Run, run, run!', '달려, 달려, 달려!'], ['The dog can run.', '강아지는 달릴 수 있어요.']],
  walk: [['Let\'s walk together.', '같이 걸어요.'], ['I walk to school.', '나는 학교에 걸어가요.'], ['Walk slowly, please.', '천천히 걸어요.'], ['I can walk like a duck!', '오리처럼 걸을 수 있어요!']],
  jump: [['I can jump high!', '높이 뛸 수 있어요!'], ['Jump, jump, jump!', '폴짝, 폴짝, 폴짝!'], ['The frog can jump.', '개구리는 뛸 수 있어요.'], ['Let\'s jump together!', '같이 뛰자!']],
  swim: [['I can swim!', '나는 수영할 수 있어요!'], ['The fish can swim.', '물고기는 헤엄칠 수 있어요.'], ['Let\'s swim in the sea.', '바다에서 수영하자.'], ['I like to swim.', '수영하는 게 좋아요.']],
  sleep: [['I want to sleep.', '자고 싶어요.'], ['Time to sleep!', '잘 시간이에요!'], ['Good night, sleep well.', '잘 자요, 푹 자요.'], ['The cat likes to sleep.', '고양이는 자는 걸 좋아해요.']],
  eat: [['Let\'s eat!', '먹자!'], ['I eat an apple.', '나는 사과를 먹어요.'], ['I like to eat pizza.', '피자 먹는 게 좋아요.'], ['Time to eat!', '먹을 시간이에요!']],
  drink: [['I drink milk.', '우유를 마셔요.'], ['Drink some water.', '물을 마셔요.'], ['Let\'s drink juice!', '주스 마시자!'], ['I want to drink water.', '물 마시고 싶어요.']],
  read: [['I can read!', '나는 읽을 수 있어요!'], ['Let\'s read a book.', '같이 책 읽자.'], ['Mom, read to me, please.', '엄마, 읽어 주세요.'], ['I like to read.', '읽는 게 좋아요.']],
  write: [['I can write my name.', '내 이름을 쓸 수 있어요.'], ['Let\'s write a letter.', '편지를 쓰자.'], ['I write with a pencil.', '연필로 써요.'], ['Can you write it?', '쓸 수 있어요?']],
  sing: [['I can sing!', '나는 노래할 수 있어요!'], ['Let\'s sing a song!', '노래하자!'], ['The bird can sing.', '새는 노래할 수 있어요.'], ['I like to sing.', '노래하는 게 좋아요.']],
  dance: [['Let\'s dance!', '춤추자!'], ['I can dance!', '나는 춤출 수 있어요!'], ['Dance with me!', '나랑 춤춰요!'], ['I like to dance.', '춤추는 게 좋아요.']],
  draw: [['I can draw a cat.', '고양이를 그릴 수 있어요.'], ['Let\'s draw a picture!', '그림 그리자!'], ['I like to draw.', '그리는 게 좋아요.'], ['Draw a big sun!', '커다란 해를 그려요!']],
  cook: [['Dad can cook.', '아빠는 요리할 수 있어요.'], ['Let\'s cook together!', '같이 요리하자!'], ['I like to cook.', '요리하는 게 좋아요.'], ['I cook an egg.', '달걀을 요리해요.']],
  wash: [['Wash your hands.', '손을 씻어요.'], ['I wash my face.', '나는 얼굴을 씻어요.'], ['Let\'s wash the dog!', '강아지를 씻기자!'], ['Wash, wash, wash!', '싹싹 씻어요!']],
  laugh: [['Ha ha! I laugh.', '하하! 웃어요.'], ['Don\'t make me laugh!', '웃기지 마!'], ['We laugh together.', '우리 같이 웃어요.'], ['I laugh a lot.', '나는 많이 웃어요.']],
  cry: [['Don\'t cry.', '울지 마.'], ['The baby is crying.', '아기가 울어요.'], ['I cry when I am sad.', '슬플 때 울어요.']],
  smile: [['Smile, please!', '웃어 주세요!'], ['Look at my smile!', '내 미소를 봐요!'], ['Smile and say cheese!', '치즈~ 하고 웃어요!'], ['I smile at you.', '너를 보고 웃어요.']],
  think: [['Let me think.', '생각해 볼게요.'], ['I think so!', '나도 그렇게 생각해요!'], ['Think, think, think!', '생각, 생각, 생각!'], ['What do you think?', '어떻게 생각해요?']],
  yawn: [['I yawn. I am sleepy.', '하품해요. 졸려요.'], ['The cat can yawn.', '고양이도 하품해요.'], ['Big yawn!', '크게 하품!']],
  // 날씨 · 자연
  rain: [['I see the rain.', '비가 와요.'], ['I like the rain.', '나는 비가 좋아요.'], ['Rain, rain, go away!', '비야, 비야, 그만 와!']],
  snow: [['I like the snow.', '나는 눈이 좋아요.'], ['Let\'s play in the snow!', '눈에서 놀자!'], ['The snow is white.', '눈은 하얘요.']],
  thunder: [['I hear thunder!', '천둥소리가 들려요!'], ['Boom! It is thunder.', '쾅! 천둥이에요.'], ['I am not scared of thunder.', '나는 천둥이 무섭지 않아요.']],
  lightning: [['I see lightning!', '번개가 보여요!'], ['Look! Lightning!', '봐요! 번개예요!'], ['Lightning is bright.', '번개는 밝아요.']],
  fire: [['The fire is hot!', '불은 뜨거워요!'], ['Don\'t touch the fire.', '불을 만지지 마요.'], ['I see a big fire.', '큰 불이 보여요.']],
  // 몸
  tooth: [['I lost a tooth!', '이가 빠졌어요!'], ['My tooth is wiggly.', '이가 흔들흔들해요.'], ['Look at my tooth.', '내 이를 봐요.']],
  brain: [['Use your brain!', '머리를 써 봐요!'], ['My brain is smart.', '내 뇌는 똑똑해요.'], ['I think with my brain.', '나는 뇌로 생각해요.']],
  heart: [['I love you with my heart.', '마음을 다해 사랑해요.'], ['Put your hand on your heart.', '가슴에 손을 얹어요.'], ['My heart goes thump!', '내 심장이 쿵쿵 뛰어요!']],
  bone: [['The dog likes the bone.', '강아지는 뼈를 좋아해요.'], ['I have strong bones.', '나는 뼈가 튼튼해요.'], ['Look at this bone!', '이 뼈를 봐요!']],
  thumb: [['Thumbs up!', '최고!'], ['Show me your thumb.', '엄지를 보여 줘요.'], ['Wiggle your thumb!', '엄지를 꼼지락꼼지락!']],
  // 사람
  baby: [['The baby is cute.', '아기는 귀여워요.'], ['The baby is sleeping.', '아기가 자고 있어요.'], ['Shh! The baby is here.', '쉿! 아기가 있어요.']],
  boy: [['He is a boy.', '그 아이는 남자아이예요.'], ['The boy can run fast.', '남자아이가 빨리 달려요.'], ['I see a boy.', '남자아이가 보여요.']],
  girl: [['I am a girl.', '나는 여자아이예요.'], ['The girl can dance.', '여자아이가 춤을 춰요.'], ['I see a girl.', '여자아이가 보여요.']],
  police: [['The police are here.', '경찰이 왔어요.'], ['Call the police!', '경찰을 불러요!'], ['I want to be a police officer.', '나는 경찰이 되고 싶어요.']],
  elf: [['I see an elf!', '요정이 보여요!'], ['The elf can do magic.', '요정은 마법을 부려요.'], ['Hello, little elf!', '안녕, 꼬마 요정!']],
  // 그 밖에
  up: [['Look up!', '위를 봐요!'], ['Stand up, please.', '일어나요.'], ['Jump up high!', '높이 뛰어올라요!'], ['Hands up!', '손 들어!']],
  quiet: [['Be quiet, please.', '조용히 해 주세요.'], ['Shh! Be quiet.', '쉿! 조용히.'], ['The room is quiet.', '방이 조용해요.']],
  question: [['I have a question.', '질문이 있어요.'], ['Ask me a question!', '나한테 질문해 봐요!'], ['Good question!', '좋은 질문이에요!']],
  magic: [['It is magic!', '마법이에요!'], ['I can do magic!', '나는 마법을 부릴 수 있어요!'], ['Magic, magic, pop!', '수리수리, 펑!']],
  music: [['I like music.', '나는 음악이 좋아요.'], ['Let\'s play music!', '음악을 틀자!'], ['I dance to the music.', '음악에 맞춰 춤춰요.']],
  dream: [['I have a dream.', '나는 꿈이 있어요.'], ['Sweet dreams!', '좋은 꿈 꿔요!'], ['I had a funny dream.', '재미있는 꿈을 꿨어요.']],
  birthday: [['Happy birthday!', '생일 축하해요!'], ['Today is my birthday.', '오늘은 내 생일이에요.'], ['I want a birthday cake!', '생일 케이크 먹고 싶어요!']],
  money: [['I have money.', '나는 돈이 있어요.'], ['Save your money.', '돈을 모아요.'], ['I put money in my bank.', '저금통에 돈을 넣어요.']],
  game: [['Let\'s play a game!', '게임하자!'], ['I won the game!', '내가 게임에서 이겼어요!'], ['This game is fun.', '이 게임 재미있어요.']],
  movie: [['Let\'s watch a movie!', '영화 보자!'], ['I like this movie.', '이 영화 좋아요.'], ['The movie is funny.', '영화가 재미있어요.']],
  zombie: [['Oh no, a zombie!', '으악, 좀비다!'], ['Run! A zombie!', '도망가! 좀비야!'], ['I am a zombie!', '나는 좀비다!']],
  zero: [['I have zero candy.', '사탕이 하나도 없어요.'], ['Zero, one, two!', '영, 하나, 둘!'], ['Zero is nothing.', '영은 아무것도 없는 거예요.']],
  ink: [['The ink is black.', '잉크는 까매요.'], ['Oops! I spilled the ink.', '앗! 잉크를 쏟았어요.'], ['I write with ink.', '잉크로 써요.']],
  yarn: [['The cat likes yarn.', '고양이는 털실을 좋아해요.'], ['Grandma has red yarn.', '할머니는 빨간 털실이 있어요.'], ['Look at this yarn!', '이 털실을 봐요!']],
  violin: [['I play the violin.', '나는 바이올린을 켜요.'], ['Listen to the violin.', '바이올린 소리를 들어 봐요.'], ['This is my violin.', '이건 내 바이올린이에요.']],
  nest: [['The bird is in the nest.', '새가 둥지에 있어요.'], ['I see a nest in the tree.', '나무에 둥지가 보여요.'], ['Look! Eggs in the nest!', '봐요! 둥지에 알이 있어요!'], ['The nest is soft.', '둥지는 푹신해요.']],
  ring: [['Look at my ring!', '내 반지를 봐요!'], ['The ring is pretty.', '반지가 예뻐요.']],
  house: [['This is my house.', '여기는 우리 집이에요.'], ['Come to my house!', '우리 집에 놀러 와!']],
  school: [['I go to school.', '나는 학교에 가요.'], ['I like my school.', '나는 우리 학교가 좋아요.']],
  bed: [['I go to bed.', '잠자리에 들어요.'], ['Jump on the bed!', '침대에서 폴짝!']],
  hand: [['Raise your hand!', '손을 들어요!'], ['Clap your hands!', '손뼉을 쳐요!']],
  eye: [['Close your eyes.', '눈을 감아요.'], ['Open your eyes!', '눈을 떠요!']],
  sun: [['The sun is hot.', '해가 뜨거워요.'], ['Good morning, sun!', '안녕, 해님!']],
  moon: [['Good night, moon.', '잘 자, 달님.'], ['The moon is big tonight.', '오늘 밤 달이 커요.']],
  star: [['Twinkle, twinkle, little star.', '반짝반짝 작은 별.']],
  earth: [['We live on the earth.', '우리는 지구에 살아요.']],
  sea: [['The sea is blue.', '바다는 파래요.']],
  seven: [['I am seven!', '나는 일곱 살이에요!']],
};

function categoryTemplates(w: string): T[] {
  if (ANIMALS.has(w)) return T_ANIMAL;
  if (FOOD.has(w)) return T_FOOD;
  if (SOME_FOOD.has(w)) return T_SOME_FOOD;
  if (DRINKS.has(w)) return T_DRINK;
  if (BODY.has(w)) return T_BODY;
  if (MY_PEOPLE.has(w)) return T_MY_PEOPLE;
  if (JOBS.has(w)) return T_JOB;
  if (PAIRS.has(w)) return T_PAIRS;
  if (HOME.has(w)) return T_HOME;
  if (THINGS.has(w)) return T_THING;
  if (RIDES.has(w)) return T_RIDE;
  if (PLACES.has(w)) return T_PLACE;
  if (NATURE.has(w)) return T_NATURE;
  return [];
}

/** 이 단어로 요정이 할 수 있는 말 전부 */
export function sentencesFor(word: Word): Sentence[] {
  const w = word.en;
  const out: Sentence[] = fill(SPECIAL[w] ?? [], word);

  if (COLORS.has(w)) {
    const [thing, thingKo] = COLOR_THING[w];
    out.push({ en: `The ${thing} is ${w}.`, ko: `${thingKo}${josa(thingKo, '은', '는')} ${word.ko}색이에요.` });
    out.push(...fill(T_COLOR, word));
  } else if (NUMBERS.has(w)) {
    const n = COUNT_KO[w];
    const one = w === 'one';
    out.push(
      { en: `I can count to ${w}!`, ko: `${word.ko}까지 셀 수 있어요!` },
      { en: `Show me ${w} ${one ? 'finger' : 'fingers'}.`, ko: `손가락 ${n} 개를 보여 줘요.` },
      { en: `I see ${w} ${one ? 'star' : 'stars'}.`, ko: `별이 ${n} 개 보여요.` },
      { en: `Clap ${w} ${one ? 'time' : 'times'}!`, ko: `손뼉을 ${n} 번 쳐요!` },
    );
  } else {
    out.push(...fill(categoryTemplates(w), word));
  }

  // 어느 묶음에도 없는 단어도 한마디는 할 수 있게
  if (!out.length) out.push(...fill([['I see {a}.', '{k이} 보여요.'], ['Look at the {w}!', '{k을} 봐요!']], word));
  return out;
}

/** i 번째 문장 (넘치면 처음부터 다시) */
export function sentenceFor(word: Word, i = 0): Sentence {
  const all = sentencesFor(word);
  return all[((i % all.length) + all.length) % all.length];
}

/** 문장을 단어 앞·단어·단어 뒤로 나눈다 — 배운 단어만 색을 달리해서 보여주려고 */
export function splitSentence(sentence: string, en: string): [string, string, string] {
  const i = sentence.toLowerCase().indexOf(en.toLowerCase());
  if (i < 0) return [sentence, '', ''];
  return [sentence.slice(0, i), sentence.slice(i, i + en.length), sentence.slice(i + en.length)];
}
