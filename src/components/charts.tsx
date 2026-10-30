import { useState } from 'react';
import { StyleSheet, View, Text as RNText, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { fontSize, spacing, useTheme } from '@/constants/theme';
import { formatDecimal } from '@/lib/format';

/** 图表统一规范：细描边、弱化网格、直接标注数值，单序列不带图例。 */

function useContainerWidth() {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return { w, onLayout };
}

/* ------------------------------ 折线趋势图 ------------------------------ */

export interface TrendPoint {
  x: string; // 日期标签
  y: number;
}

export function TrendChart({
  data,
  color,
  unit,
  height = 180,
}: {
  data: TrendPoint[];
  color: string;
  unit: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const { w, onLayout } = useContainerWidth();

  const padTop = 18;
  const padBottom = 24;
  const padLeft = 6;
  const padRight = 6;
  const plotW = w - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const ys = data.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const lo = minY - span * 0.25;
  const hi = maxY + span * 0.25;

  const xAt = (i: number) =>
    data.length <= 1 ? padLeft + plotW / 2 : padLeft + (i / (data.length - 1)) * plotW;
  const yAt = (y: number) => padTop + (1 - (y - lo) / (hi - lo)) * plotH;

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.y).toFixed(1)}`).join(' ');

  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const last = data[data.length - 1];
  const labelIdx = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {ticks.map((t, i) => (
            <Line
              key={i}
              x1={padLeft}
              y1={yAt(t)}
              x2={w - padRight}
              y2={yAt(t)}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}
          {labelIdx.map((i) => (
            <SvgText
              key={`x-${i}`}
              x={xAt(i)}
              y={height - 4}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            >
              {data[i].x}
            </SvgText>
          ))}
          <Line
            x1={padLeft}
            y1={yAt(lo)}
            x2={w - padRight}
            y2={yAt(lo)}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <Circle key={i} cx={xAt(i)} cy={yAt(d.y)} r={4} fill={color} stroke={colors.surface} strokeWidth={2} />
          ))}
          {last && (
            <SvgText
              x={xAt(data.length - 1)}
              y={Math.max(padTop + 10, yAt(last.y) - 10)}
              fontSize={12}
              fontWeight="700"
              fill={colors.text}
              textAnchor="end"
            >
              {formatDecimal(last.y, 1)}
            </SvgText>
          )}
        </Svg>
      )}
    </View>
  );
}

/* ------------------------------ 近 7 天柱状 ------------------------------ */

export function WeekBars({
  data,
  color,
  height = 130,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
  valueLabel?: (n: number) => string;
}) {
  const { colors } = useTheme();
  const { w, onLayout } = useContainerWidth();

  const padBottom = 20;
  const padTop = 16;
  const plotH = height - padTop - padBottom;
  const maxV = Math.max(...data.map((d) => d.value), 1);

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {data.map((d, i) => {
            const slot = w / data.length;
            const barW = Math.min(26, slot * 0.5);
            const h = d.value > 0 ? Math.max(4, (d.value / maxV) * plotH) : 0;
            const x = slot * i + (slot - barW) / 2;
            const y = padTop + plotH - h;
            return (
              <SvgG key={i}>
                <Rect x={x} y={y} width={barW} height={h} rx={4} fill={color} opacity={d.value > 0 ? 1 : 0.15} />
                {d.value > 0 && valueLabel ? (
                  <SvgText x={x + barW / 2} y={y - 5} fontSize={9} fill={colors.textSecondary} textAnchor="middle">
                    {valueLabel(d.value)}
                  </SvgText>
                ) : null}
                <SvgText x={slot * i + slot / 2} y={height - 4} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                  {d.label}
                </SvgText>
              </SvgG>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

function SvgG({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------ 三大营养素条 ------------------------------ */

export function MacroBar({
  protein,
  carbs,
  fat,
  colors: macroColors,
}: {
  protein: number;
  carbs: number;
  fat: number;
  colors: { protein: string; carbs: string; fat: string };
}) {
  const { colors } = useTheme();
  const total = protein + carbs + fat || 1;

  const items = [
    { key: 'protein', label: '蛋白质', value: protein, color: macroColors.protein },
    { key: 'carbs', label: '碳水', value: carbs, color: macroColors.carbs },
    { key: 'fat', label: '脂肪', value: fat, color: macroColors.fat },
  ];

  return (
    <View style={styles.macroWrap}>
      <View style={[styles.macroBar, { backgroundColor: colors.surfaceAlt }]}>
        {items.map((it) => (
          <View
            key={it.key}
            style={{ width: `${(it.value / total) * 100}%`, backgroundColor: it.color, height: 14, borderRadius: 7 }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {items.map((it) => (
          <View key={it.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: it.color }]} />
            <RNText style={[styles.legendText, { color: colors.textSecondary }]}>
              {it.label} {formatDecimal(it.value, 0)}g
            </RNText>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------ 环形进度（剩余热量） ------------------------------ */

export function RingProgress({
  value,
  max,
  color,
  size = 168,
  strokeWidth = 15,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
}) {
  const { colors } = useTheme();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* 底环 */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {pct > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * pct} ${circumference}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
        <SvgText x={center} y={center} textAnchor="middle" fontSize={30} fontWeight="800" fill={color}>
          {label}
        </SvgText>
        {sublabel ? (
          <SvgText x={center} y={center + 20} textAnchor="middle" fontSize={11} fill={colors.textMuted}>
            {sublabel}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  macroWrap: { gap: spacing.sm },
  macroBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    gap: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: fontSize.xs, fontWeight: '500' },
});
