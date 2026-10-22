/**
 * VAPID 키 한 쌍을 만든다.
 *   npm run keys
 *
 * 둘 다 Worker 시크릿에 넣는다 (wrangler secret put). 앱은 공개키를
 * Worker 의 /health 에서 받아 가므로 빌드에 박을 필요가 없다.
 * 개인키는 절대 저장소에 커밋하거나 KV 에 넣지 말 것.
 */
import { generateVapidKeys, serializeVapidKeys } from 'web-push-browser';

const keys = await serializeVapidKeys(await generateVapidKeys());

console.log('\n=== VAPID 키가 만들어졌습니다 ===\n');
console.log('1) 공개키 — 공개돼도 되는 값입니다. 아래 명령으로 넣으세요:\n');
console.log('   npx wrangler secret put VAPID_PUBLIC_KEY\n');
console.log(keys.publicKey);
console.log('\n2) 개인키 — 비밀입니다. 커밋하거나 KV 에 넣지 마세요.');
console.log('   아래 명령으로 넣고, 이 화면은 닫으세요:\n');
console.log('   npx wrangler secret put VAPID_PRIVATE_KEY\n');
console.log(keys.privateKey);
console.log('\n3) 알림 암호도 같은 방식으로 넣습니다 (폰 앱 설정에 똑같이 입력):\n');
console.log('   npx wrangler secret put PASSPHRASE');
console.log('');
