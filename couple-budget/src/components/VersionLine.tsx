import React, { useEffect, useState } from 'react';

interface VersionInfo { version?: string | null; committedAtKst?: string | null }

/**
 * 설정 맨 아래 한 줄 — 지금 이 폰에 뜬 앱이 몇 번째 버전인지.
 * 배포 때 만들어지는 version.json 을 읽는다 (dev/version-json.mjs).
 * 못 읽으면(오프라인·개발 서버) 아무것도 그리지 않는다 — 꾸밈일 뿐이라 오류를 띄우지 않는다.
 */
export default function VersionLine() {
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${process.env.PUBLIC_URL}/version.json`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((j: VersionInfo | null) => { if (alive && j && typeof j.version === 'string') setInfo(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!info?.version) return null;
  return (
    <div style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', paddingBottom: 8 }}>
      버전 {info.version}
      {info.committedAtKst ? ` · ${info.committedAtKst}` : ''}
    </div>
  );
}
