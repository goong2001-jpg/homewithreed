import React from 'react';
import { isStandalone, platform } from '../push/register';

/**
 * 설치 안내.
 *
 * 아이폰에서는 "먼저 설치 → 그 다음 설정" 순서가 중요하다.
 * 사파리 탭과 홈 화면 앱은 저장소가 완전히 분리돼 있어서, 사파리에서 아무리
 * 설정해도 홈 화면 앱에는 하나도 안 넘어간다. 푸시 구독도 홈 화면 앱 안에서만 만들어진다.
 */
export default function InstallGuide() {
  const p = platform();
  const installed = isStandalone();

  return (
    <div className="scroll settings">
      <div className="settings-inner">
        {installed ? (
          <div className="card">
            <h2>✅ 설치 완료</h2>
            <p className="desc">
              홈 화면 앱으로 실행 중이에요. 이제 설정에서 알림을 켜면 정해진 시간에
              친구들이 카톡을 보내줍니다.
            </p>
          </div>
        ) : (
          <div className="card">
            <h2>📱 폰에 설치하기</h2>
            <p className="desc">
              홈 화면에 추가하면 앱처럼 열리고, 알림도 받을 수 있어요.
            </p>

            {p === 'ios' && (
              <>
                <div className="guide-step">
                  <span className="n">1</span>
                  <span>
                    <b>사파리(Safari)</b>로 이 페이지를 열어요. 크롬이나 카톡 안에서 열면
                    설치가 안 돼요.
                  </span>
                </div>
                <div className="guide-step">
                  <span className="n">2</span>
                  <span>
                    아래쪽 <b>공유 버튼</b>(네모에 화살표 ⬆️)을 눌러요.
                  </span>
                </div>
                <div className="guide-step">
                  <span className="n">3</span>
                  <span>
                    메뉴를 내려서 <b>홈 화면에 추가</b>를 눌러요.
                  </span>
                </div>
                <div className="guide-step">
                  <span className="n">4</span>
                  <span>
                    홈 화면에 생긴 <b>아이콘으로 다시 열어요.</b> 그 안에서 설정과 알림을
                    켜야 해요.
                  </span>
                </div>

                <div className="notice warn">
                  ⚠️ 아이폰은 <b>사파리에서 한 설정이 홈 화면 앱으로 넘어가지 않아요.</b>
                  <br />
                  아이 이름·친구·시간표는 꼭 <b>홈 화면 앱 안에서</b> 설정해 주세요. 이미
                  사파리에서 설정했다면, 설정 → 백업 내보내기로 파일을 저장한 뒤 홈 화면
                  앱에서 불러오면 그대로 옮겨집니다.
                  <br />
                  <br />
                  알림은 <b>iOS 16.4 이상</b>에서만 됩니다.
                </div>
              </>
            )}

            {p === 'android' && (
              <>
                <div className="guide-step">
                  <span className="n">1</span>
                  <span>
                    <b>크롬(Chrome)</b>으로 이 페이지를 열어요.
                  </span>
                </div>
                <div className="guide-step">
                  <span className="n">2</span>
                  <span>
                    오른쪽 위 <b>⋮ 메뉴</b>를 눌러요.
                  </span>
                </div>
                <div className="guide-step">
                  <span className="n">3</span>
                  <span>
                    <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요.
                  </span>
                </div>
                <div className="guide-step">
                  <span className="n">4</span>
                  <span>홈 화면 아이콘으로 열고, 설정에서 알림을 켜요.</span>
                </div>
              </>
            )}

            {p === 'other' && (
              <p className="desc">
                주소창 오른쪽의 설치 아이콘을 누르거나, 브라우저 메뉴에서 &ldquo;앱
                설치&rdquo;를 고르면 됩니다. 알림은 폰에서 쓸 때 가장 잘 동작해요.
              </p>
            )}
          </div>
        )}

        <div className="card">
          <h2>🔔 알림이 안 오면</h2>
          <p className="desc">
            아래를 차례로 확인해 보세요.
          </p>
          <div className="guide-step">
            <span className="n">1</span>
            <span>홈 화면 아이콘으로 열었는지 (사파리 탭은 알림이 안 와요)</span>
          </div>
          <div className="guide-step">
            <span className="n">2</span>
            <span>설정에서 알림 스위치가 켜져 있는지</span>
          </div>
          <div className="guide-step">
            <span className="n">3</span>
            <span>폰 설정 → 알림에서 이 앱이 허용돼 있는지</span>
          </div>
          <div className="guide-step">
            <span className="n">4</span>
            <span>방해 금지 모드나 집중 모드가 켜져 있지 않은지</span>
          </div>
        </div>
      </div>
    </div>
  );
}
