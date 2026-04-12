import React from 'react';
import { View } from 'react-native';

interface AppIconProps {
  size?: number;
}

/** Height ratios for the five waveform bars (0-1). */
const BAR_RATIOS = [0.38, 0.68, 1, 0.58, 0.32];

/** Bar colors — identical to the launcher icon. */
const BAR_COLORS = ['#A3B8E8', '#C8D8F4', '#FFFFFF', '#BBC9EF', '#96ABDF'];

export function AppIcon({ size = 100 }: AppIconProps): React.JSX.Element {
  const s = size;
  const barWidth = s * 0.065;
  const barGap   = s * 0.046;
  const maxBarHeight = s * 0.52;

  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: s * 0.22,
        backgroundColor: '#1565C0',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Single depth circle — #1976D2 */}
      <View
        style={{
          position: 'absolute',
          width: s * 0.92,
          height: s * 0.92,
          borderRadius: s * 0.46,
          backgroundColor: '#1976D2',
        }}
      />

      {/* Waveform bars */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: barGap,
          zIndex: 1,
        }}
      >
        {BAR_RATIOS.map((ratio, i) => (
          <View
            key={i}
            style={{
              width: barWidth,
              height: maxBarHeight * ratio,
              borderRadius: barWidth / 2,
              backgroundColor: BAR_COLORS[i],
            }}
          />
        ))}
      </View>
    </View>
  );
}
