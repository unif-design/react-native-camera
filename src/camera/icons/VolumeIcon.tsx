import Svg, { Path, Line } from 'react-native-svg';

type Props = { on: boolean; size: number; color: string };

export function VolumeIcon({ on, size, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 喇叭主体 */}
      <Path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill={color}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {on ? (
        // 声波两道
        <Path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        // 关:斜杠
        <Line
          x1={16}
          y1={8}
          x2={21}
          y2={16}
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}
