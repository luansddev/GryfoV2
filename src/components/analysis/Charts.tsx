import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { fmtInt } from './format';

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/* ------------------------------------------------------------------ */
/* AnimatedBar – barra horizontal que "cresce" da esquerda             */
/* ------------------------------------------------------------------ */
export function AnimatedBar({
  pct,
  color,
  height = 10,
  delay = 0,
  track = '#eef2f7',
}: {
  pct: number;
  color: string;
  height?: number;
  delay?: number;
  track?: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pct, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const width = pct > 0 ? Math.max(clampPct(pct), 2) : 0;

  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2, backgroundColor: track }]}>
      <View style={{ width: `${width}%`, height: '100%' }}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: color, borderRadius: height / 2 }, animatedStyle]}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* DonutChart – rosca com valor central                               */
/* ------------------------------------------------------------------ */
export interface DonutSegment {
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  size = 150,
  thickness = 22,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
}) {
  const chartSize = Math.round(size);
  const r = (chartSize - thickness) / 2;
  const c = chartSize / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter(s => s.value > 0);
  const gap = visible.length > 1 ? 3 : 0;

  const rotation = useSharedValue(-120);
  const opacity = useSharedValue(0);
  useEffect(() => {
    rotation.value = -120;
    opacity.value = 0;
    rotation.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 500 });
  }, [total, rotation, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  let cumulative = 0;

  return (
    <View style={{ width: chartSize, height: chartSize, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <Svg width={chartSize} height={chartSize}>
          <G rotation={-90} origin={`${c}, ${c}`}>
            <Circle cx={c} cy={c} r={r} stroke="#eef2f7" strokeWidth={thickness} fill="none" />
            {total > 0 &&
              visible.map((seg, i) => {
                const fraction = seg.value / total;
                const length = Math.max(fraction * circumference - gap, 0.5);
                const offset = -cumulative * circumference;
                cumulative += fraction;
                return (
                  <Circle
                    key={i}
                    cx={c}
                    cy={c}
                    r={r}
                    stroke={seg.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${length} ${circumference}`}
                    strokeDashoffset={offset}
                    fill="none"
                  />
                );
              })}
          </G>
        </Svg>
      </Animated.View>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text
          style={styles.donutValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {centerValue}
        </Text>
        <Text style={styles.donutLabel} numberOfLines={1}>
          {centerLabel}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* CompareRow – duas barras: local × estado                            */
/* ------------------------------------------------------------------ */
export function CompareRow({
  icon,
  label,
  color,
  cityValue,
  stateValue,
  max,
  format,
  cityLabel = 'Local',
  delay = 0,
}: {
  icon: string;
  label: string;
  color: string;
  cityValue: number;
  stateValue: number;
  max: number;
  format: (n: number) => string;
  cityLabel?: string;
  delay?: number;
}) {
  const safeMax = max > 0 ? max : 1;
  const higher = cityValue > stateValue * 1.15;
  const lower = cityValue < stateValue * 0.85;

  return (
    <View style={styles.compareRow}>
      <View style={styles.compareHeader}>
        <View style={[styles.compareIcon, { backgroundColor: `${color}1A` }]}>
          <FontAwesome6 name={icon as any} size={12} color={color === '#cbd5e1' ? '#64748b' : color} />
        </View>
        <Text style={styles.compareLabel}>{label}</Text>
        {(higher || lower) && (
          <View style={[styles.compareTag, { backgroundColor: higher ? '#fee2e2' : '#dcfce7' }]}>
            <FontAwesome6 name={higher ? 'arrow-up' : 'arrow-down'} size={9} color={higher ? '#dc2626' : '#16a34a'} />
            <Text style={[styles.compareTagText, { color: higher ? '#dc2626' : '#16a34a' }]}>
              {higher ? 'acima' : 'abaixo'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.compareLine}>
        <View style={styles.compareWhoCol}>
          <FontAwesome6 name="location-dot" size={10} color={color} style={styles.compareWhoIcon} />
          <Text style={styles.compareWho} numberOfLines={1}>{cityLabel || 'Local'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <AnimatedBar pct={(cityValue / safeMax) * 100} color={color} height={12} delay={delay} />
        </View>
        <Text style={styles.compareValue}>{format(cityValue)}</Text>
      </View>
      <View style={styles.compareLine}>
        <View style={styles.compareWhoCol}>
          <FontAwesome6 name="map" size={9} color="#94a3b8" style={styles.compareWhoIcon} />
          <Text style={[styles.compareWho, { color: '#94a3b8' }]}>SP</Text>
        </View>
        <View style={{ flex: 1 }}>
          <AnimatedBar pct={(stateValue / safeMax) * 100} color="#cbd5e1" height={12} delay={delay + 120} />
        </View>
        <Text style={[styles.compareValue, { color: '#94a3b8' }]}>{format(stateValue)}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* PositionGauge – escala verde→vermelho com marcador da cidade        */
/* ------------------------------------------------------------------ */
export function PositionGauge({ position, outOf }: { position: number; outOf: number }) {
  const [width, setWidth] = useState(0);
  const pct = outOf > 1 ? (position - 1) / (outOf - 1) : 0.5;
  const x = useSharedValue(0);

  useEffect(() => {
    if (width > 0) {
      x.value = 0;
      x.value = withDelay(250, withTiming(pct * (width - 22), { duration: 1100, easing: Easing.out(Easing.cubic) }));
    }
  }, [width, pct, x]);

  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View>
      <View
        style={styles.gaugeWrap}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <LinearGradient
          colors={['#22c55e', '#facc15', '#f97316', '#ef4444']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gaugeBar}
        />
        {width > 0 && (
          <Animated.View style={[styles.gaugeMarker, markerStyle]}>
            <View style={styles.gaugeMarkerDot} />
          </Animated.View>
        )}
      </View>
      <View style={styles.gaugeLabels}>
        <Text style={styles.gaugeLabelText}>Menos ocorrências</Text>
        <Text style={styles.gaugeLabelText}>Mais ocorrências</Text>
      </View>
      <Text style={styles.gaugeRank}>
        <Text style={styles.gaugeRankStrong}>{fmtInt(position)}ª</Text> de {fmtInt(outOf)} cidades
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: { width: '100%', overflow: 'hidden' },
  barFill: { flex: 1, transformOrigin: 'left center' },

  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  donutValue: {
    fontFamily: 'texgyB',
    fontSize: 22,
    color: '#0f172a',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 26,
  },
  donutLabel: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 14,
  },

  compareRow: { gap: 8 },
  compareHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  compareLabel: { fontFamily: 'texgyB', fontSize: 14, color: '#1e293b', flex: 1 },
  compareTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  compareTagText: { fontFamily: 'texgyB', fontSize: 11 },
  compareLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareWhoCol: { width: 58, flexDirection: 'row', alignItems: 'center', gap: 5 },
  compareWhoIcon: { width: 11, textAlign: 'center' },
  compareWho: { fontFamily: 'texgyB', fontSize: 11, color: '#334155' },
  compareValue: { minWidth: 48, textAlign: 'right', fontFamily: 'texgyB', fontSize: 13, color: '#0f172a' },

  gaugeWrap: { height: 26, justifyContent: 'center' },
  gaugeBar: { height: 12, borderRadius: 6 },
  gaugeMarker: { position: 'absolute', left: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  gaugeMarkerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0f172a' },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  gaugeLabelText: { fontFamily: 'texgyR', fontSize: 11, color: '#94a3b8' },
  gaugeRank: { fontFamily: 'texgyR', fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 10 },
  gaugeRankStrong: { fontFamily: 'texgyB', color: '#0f172a' },
});
