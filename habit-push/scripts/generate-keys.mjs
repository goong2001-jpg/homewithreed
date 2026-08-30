/**
 * VAPID 키 한 쌍을 만든다.
 *   npm run keys
 *
 * 공개키는 앱 빌드에, 개인키는 Worker 시크릿에 넣는다.
 * 개인키는 절대 저장소에 커밋하지 말 것.
 */
import { generateVapidKeys, serializeVapidKeys } from 'web-push-browser';

const keys = await serializeVapidKeys(await generateVapidKeys());

console.log('\n=== VAPID 키가 만들어졌습니다 ===\n');
console.log('1) 공개키 — 공개돼도 되는 값입니다.');
console.log('   · habit-push/wrangler.toml 의 VAPID_PUBLIC_KEY 에 넣으세요');
console.log('   · GitHub 저장소 변수 VAPID_PUBLIC_KEY 에도 같은 값을 넣으세요\n');
console.log(keys.publicKey);
console.log('\n2) 개인키 — 비밀입니다. 커밋하지 마세요.');
console.log('   아래 명령으로 넣고, 이 화면은 닫으세요:\n');
console.log('   npx wrangler secret put VAPID_PRIVATE_KEY\n');
console.log(keys.privateKey);
console.log('');
