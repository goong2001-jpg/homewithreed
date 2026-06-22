import React, { useState } from 'react';
import { AvatarItem } from '../types';
import BgRemoveImg from './BgRemoveImg';

type AvatarMood = 'idle' | 'happy' | 'sad' | 'thinking';

interface Props {
  items: AvatarItem[];
  mood: AvatarMood;
  size?: 'small' | 'large';
}

const ASSET_BASE = `${process.env.PUBLIC_URL}/avatar/`;

/** 이미지가 있으면 배경 제거 후 표시, 없거나 로딩 실패 시 이모지로 자동 대체 */
function AssetImg({ item, fontSize, imgStyle }: {
  item: AvatarItem; fontSize: number; imgStyle?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (item.image && !failed) {
    return (
      <BgRemoveImg
        src={ASSET_BASE + item.image}
        bgRemoval={item.bgRemoval ?? 'none'}
        onError={() => setFailed(true)}
        style={{ display: 'block', ...imgStyle }}
      />
    );
  }
  return <span style={{ fontSize, lineHeight: 1 }}>{item.emoji}</span>;
}

function Face({ mood, scale = 1 }: { mood: AvatarMood; scale?: number }) {
  const s = scale;
  const cx = 60 * s, cy = 44 * s, r = 28 * s;

  const eyes: Record<AvatarMood, React.ReactNode> = {
    idle: (
      <>
        <ellipse cx={49*s} cy={42*s} rx={5*s} ry={5.5*s} fill="white" />
        <ellipse cx={71*s} cy={42*s} rx={5*s} ry={5.5*s} fill="white" />
        <circle cx={50*s} cy={43*s} r={3*s} fill="#3a3a3a" />
        <circle cx={72*s} cy={43*s} r={3*s} fill="#3a3a3a" />
        <circle cx={51.2*s} cy={41.8*s} r={1.2*s} fill="white" />
        <circle cx={73.2*s} cy={41.8*s} r={1.2*s} fill="white" />
      </>
    ),
    happy: (
      <>
        <path d={`M ${44*s} ${42*s} Q ${50*s} ${36*s} ${56*s} ${42*s}`} stroke="#3a3a3a" strokeWidth={2.5*s} fill="none" strokeLinecap="round" />
        <path d={`M ${64*s} ${42*s} Q ${70*s} ${36*s} ${76*s} ${42*s}`} stroke="#3a3a3a" strokeWidth={2.5*s} fill="none" strokeLinecap="round" />
        <text x={47*s} y={38*s} fontSize={9*s} textAnchor="middle">⭐</text>
        <text x={71*s} y={38*s} fontSize={9*s} textAnchor="middle">⭐</text>
      </>
    ),
    sad: (
      <>
        <ellipse cx={49*s} cy={43*s} rx={5*s} ry={5.5*s} fill="white" />
        <ellipse cx={71*s} cy={43*s} rx={5*s} ry={5.5*s} fill="white" />
        <circle cx={50*s} cy={44*s} r={3*s} fill="#3a3a3a" />
        <circle cx={72*s} cy={44*s} r={3*s} fill="#3a3a3a" />
        <ellipse cx={48*s} cy={50*s} rx={3*s} ry={4*s} fill="#aaddff" opacity={0.7} />
        <ellipse cx={70*s} cy={50*s} rx={3*s} ry={4*s} fill="#aaddff" opacity={0.7} />
        <path d={`M ${46*s} ${39*s} L ${50*s} ${42*s}`} stroke="#3a3a3a" strokeWidth={2*s} strokeLinecap="round" />
        <path d={`M ${74*s} ${39*s} L ${70*s} ${42*s}`} stroke="#3a3a3a" strokeWidth={2*s} strokeLinecap="round" />
      </>
    ),
    thinking: (
      <>
        <ellipse cx={49*s} cy={42*s} rx={5*s} ry={5.5*s} fill="white" />
        <ellipse cx={71*s} cy={42*s} rx={5*s} ry={3*s} fill="white" />
        <circle cx={50*s} cy={43*s} r={3*s} fill="#3a3a3a" />
        <circle cx={72*s} cy={42*s} r={2*s} fill="#3a3a3a" />
        <path d={`M ${47*s} ${38*s} L ${53*s} ${40*s}`} stroke="#3a3a3a" strokeWidth={2*s} strokeLinecap="round" />
        <path d={`M ${67*s} ${37*s} L ${73*s} ${39*s}`} stroke="#3a3a3a" strokeWidth={2*s} strokeLinecap="round" />
      </>
    ),
  };

  const mouths: Record<AvatarMood, React.ReactNode> = {
    idle: <path d={`M ${50*s} ${56*s} Q ${60*s} ${63*s} ${70*s} ${56*s}`} stroke="#c77" strokeWidth={2.5*s} fill="none" strokeLinecap="round" />,
    happy: (
      <>
        <path d={`M ${46*s} ${56*s} Q ${60*s} ${70*s} ${74*s} ${56*s}`} stroke="#c44" strokeWidth={2.5*s} fill="#ff8fa8" strokeLinecap="round" />
        <ellipse cx={60*s} cy={60*s} rx={8*s} ry={4*s} fill="#ff8fa8" />
      </>
    ),
    sad: <path d={`M ${50*s} ${60*s} Q ${60*s} ${53*s} ${70*s} ${60*s}`} stroke="#c77" strokeWidth={2.5*s} fill="none" strokeLinecap="round" />,
    thinking: <path d={`M ${53*s} ${58*s} Q ${62*s} ${60*s} ${70*s} ${57*s}`} stroke="#c77" strokeWidth={2.5*s} fill="none" strokeLinecap="round" />,
  };

  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="#FFDBAC" />
      <circle cx={cx} cy={cy - 2*s} r={29*s} fill="#FFDBAC" />
      {/* 볼터치 */}
      <ellipse cx={38*s} cy={52*s} rx={7*s} ry={5*s} fill="#ffb3ba" opacity={0.5} />
      <ellipse cx={82*s} cy={52*s} rx={7*s} ry={5*s} fill="#ffb3ba" opacity={0.5} />
      {/* 코 */}
      <ellipse cx={60*s} cy={51*s} rx={2.5*s} ry={1.5*s} fill="#e8a87c" />
      {eyes[mood]}
      {mouths[mood]}
    </>
  );
}

const OUTFIT_COLORS: Record<string, { body: string; trim: string }> = {
  outfit_princess: { body: '#FFB3DE', trim: '#FF69B4' },
  outfit_superhero: { body: '#6B48FF', trim: '#FFD700' },
  outfit_unicorn: { body: '#C8A4FF', trim: '#FF9FF3' },
  default: { body: '#FFB3DE', trim: '#FF69B4' },
};

const HAIR_COLORS: Record<string, string> = {
  hat_crown: '#2c1810',
  hat_wizard: '#1a237e',
  hat_flower: '#4a3728',
  hat_star: '#6d4c41',
  default: '#4a3728',
};

export default function Avatar({ items, mood, size = 'large' }: Props) {
  const equipped = items.filter(i => i.equipped);
  const bg = equipped.find(i => i.category === 'background');
  const hat = equipped.find(i => i.category === 'hat');
  const acc = equipped.find(i => i.category === 'accessory');
  const outfit = equipped.find(i => i.category === 'outfit');
  const specials = equipped.filter(i => i.category === 'special');
  const fullAvatar = specials.find(i => i.fullImage);
  // 전체 그림이 아닌 special 조각들(왕관/목걸이/날개 등)은 그림 레이어로 덧씌움
  const specialLayers = specials.filter(i => !i.fullImage && i.image);

  const isSmall = size === 'small';
  const W = isSmall ? 70 : 130;
  const H = isSmall ? 95 : 175;
  const s = isSmall ? 0.54 : 1;

  const [fullFailed, setFullFailed] = useState(false);

  const outfitColors = outfit ? (OUTFIT_COLORS[outfit.id] || OUTFIT_COLORS.default) : OUTFIT_COLORS.default;
  const hairColor = hat ? (HAIR_COLORS[hat.id] || '#4a3728') : '#4a3728';

  // ✨ 전설의 아바타(다이아 요정) 착용 시: 그림 한 장으로 전체 교체
  if (fullAvatar && fullAvatar.image && !fullFailed) {
    return (
      <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
        {bg && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: isSmall ? 12 : 20,
            background: 'linear-gradient(160deg,#fbc2eb,#a6c1ee)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isSmall ? 36 : 60, zIndex: 0,
          }}>{bg.emoji}</div>
        )}
        <BgRemoveImg
          src={ASSET_BASE + fullAvatar.image}
          bgRemoval={fullAvatar.bgRemoval ?? 'none'}
          onError={() => setFullFailed(true)}
          style={{ position: 'relative', zIndex: 1, width: W, height: H, objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: W,
      height: H,
      flexShrink: 0,
    }}>
      {/* 배경 */}
      {bg && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: isSmall ? 12 : 20,
          background: 'linear-gradient(160deg,#ffecd2,#fcb69f)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isSmall ? 36 : 60,
          zIndex: 0,
        }}>
          {bg.emoji}
        </div>
      )}

      <svg
        width={W} height={H}
        viewBox={`0 0 120 ${isSmall ? 175 : 175}`}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* 머리카락 (뒷면) */}
        <ellipse cx={60*s} cy={20*s} rx={30*s} ry={22*s} fill={hairColor} />
        <ellipse cx={35*s} cy={50*s} rx={10*s} ry={20*s} fill={hairColor} />
        <ellipse cx={85*s} cy={50*s} rx={10*s} ry={20*s} fill={hairColor} />

        <Face mood={mood} scale={s} />

        {/* 머리카락 앞머리 */}
        <ellipse cx={60*s} cy={16*s} rx={27*s} ry={10*s} fill={hairColor} />
        <ellipse cx={40*s} cy={22*s} rx={9*s} ry={6*s} fill={hairColor} />
        <ellipse cx={80*s} cy={22*s} rx={9*s} ry={6*s} fill={hairColor} />

        {/* 모자 */}
        {hat && (
          <text x={60*s} y={10*s} fontSize={isSmall ? 20 : 28} textAnchor="middle">{hat.emoji}</text>
        )}

        {/* 목 */}
        <rect x={53*s} y={70*s} width={14*s} height={12*s} rx={4*s} fill="#FFDBAC" />

        {/* 몸통 (드레스/옷) */}
        <path
          d={`M ${28*s} ${82*s} Q ${30*s} ${78*s} ${42*s} ${76*s} L ${78*s} ${76*s} Q ${90*s} ${78*s} ${92*s} ${82*s} L ${98*s} ${140*s} Q ${60*s} ${148*s} ${22*s} ${140*s} Z`}
          fill={outfitColors.body}
        />
        {/* 옷 장식선 */}
        <path
          d={`M ${60*s} ${76*s} L ${60*s} ${148*s}`}
          stroke={outfitColors.trim} strokeWidth={2*s} opacity={0.4}
        />
        <path
          d={`M ${28*s} ${100*s} Q ${60*s} ${106*s} ${92*s} ${100*s}`}
          stroke={outfitColors.trim} strokeWidth={2.5*s} fill="none" opacity={0.5}
        />

        {/* 왼팔 */}
        <path
          d={`M ${36*s} ${80*s} Q ${16*s} ${88*s} ${14*s} ${112*s} Q ${18*s} ${120*s} ${28*s} ${116*s} Q ${32*s} ${100*s} ${44*s} ${92*s} Z`}
          fill={outfitColors.body}
        />
        {/* 왼손 */}
        <ellipse cx={20*s} cy={118*s} rx={9*s} ry={7*s} fill="#FFDBAC" />

        {/* 오른팔 */}
        <path
          d={`M ${84*s} ${80*s} Q ${104*s} ${88*s} ${106*s} ${112*s} Q ${102*s} ${120*s} ${92*s} ${116*s} Q ${88*s} ${100*s} ${76*s} ${92*s} Z`}
          fill={outfitColors.body}
        />
        {/* 오른손 */}
        <ellipse cx={100*s} cy={118*s} rx={9*s} ry={7*s} fill="#FFDBAC" />

        {/* 치마 주름 */}
        <path d={`M ${32*s} ${120*s} Q ${40*s} ${148*s} ${50*s} ${148*s}`} stroke={outfitColors.trim} strokeWidth={1.5*s} fill="none" opacity={0.4} />
        <path d={`M ${88*s} ${120*s} Q ${80*s} ${148*s} ${70*s} ${148*s}`} stroke={outfitColors.trim} strokeWidth={1.5*s} fill="none" opacity={0.4} />

        {/* 다리 */}
        <rect x={42*s} y={143*s} width={14*s} height={26*s} rx={7*s} fill="#FFDBAC" />
        <rect x={64*s} y={143*s} width={14*s} height={26*s} rx={7*s} fill="#FFDBAC" />

        {/* 신발 */}
        <ellipse cx={49*s} cy={168*s} rx={12*s} ry={6*s} fill="#FF6B9D" />
        <ellipse cx={71*s} cy={168*s} rx={12*s} ry={6*s} fill="#FF6B9D" />

        {/* 액세서리 */}
        {acc && (
          <text x={60*s} y={78*s} fontSize={isSmall ? 14 : 18} textAnchor="middle">{acc.emoji}</text>
        )}
      </svg>

      {/* 💎 전설 조각 레이어 (왕관/목걸이/날개 등) — 그림이 있으면 아바타 위에 겹쳐 표시 */}
      {specialLayers.map(item => (
        <div key={item.id} style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <AssetImg
            item={item}
            fontSize={isSmall ? 22 : 40}
            imgStyle={{ width: W, height: H, objectFit: 'contain' }}
          />
        </div>
      ))}
    </div>
  );
}
