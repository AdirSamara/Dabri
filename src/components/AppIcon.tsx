import React from 'react';
import { View } from 'react-native';

interface AppIconProps {
  size?: number;
}

/** Height ratios for the five waveform bars (0-1). */
const BAR_RATIOS = [0.38, 0.68, 1, 0.58, 0.32];

/**
 * Dabri app icon — abstract audio-waveform bars inside a rounded square.
 * Represents voice / speech in a modern, language-neutral way.
 */
export function AppIcon({ size = 100 }: AppIconProps): React.JSX.Element {
  const s = size;
  const barWidth = s * 0.09;
  const barGap = s * 0.055;
  const maxBarHeight = s * 0.48;

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
      {/* Depth layer — mid-blue circle */}
      <View
        style={{
          position: 'absolute',
          width: s * 0.92,
          height: s * 0.92,
          borderRadius: s * 0.46,
          backgroundColor: '#1976D2',
        }}
      />

      {/* Depth layer — lighter centre */}
      <View
        style={{
          position: 'absolute',
          width: s * 0.55,
          height: s * 0.55,
          borderRadius: s * 0.275,
          backgroundColor: '#1E88E5',
        }}
      />

      {/* Highlight — subtle top-right glow */}
      <View
        style={{
          position: 'absolute',
          top: -s * 0.12,
          right: -s * 0.12,
          width: s * 0.45,
          height: s * 0.45,
          borderRadius: s * 0.225,
          backgroundColor: 'rgba(255,255,255,0.07)',
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
              backgroundColor: `rgba(255,255,255,${0.65 + ratio * 0.35})`,
            }}
          />
        ))}
      </View>
    </View>
  );
}
