import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewPropTypes } from 'react-native';
import { colors } from '../../theme/tokens';

const SkeletonLoader = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  shimmerColor = colors.skeleton,
  shimmerDuration = 1500,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: shimmerDuration,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: shimmerDuration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [shimmerAnim, shimmerDuration]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: shimmerColor,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonText = ({ lines = 3, lastLineWidth = '60%', style }) => {
  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLoader
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={14}
          style={index > 0 ? styles.textLine : undefined}
        />
      ))}
    </View>
  );
};

export const SkeletonCard = ({ style }) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={50} height={50} borderRadius={25} />
        <View style={styles.cardHeaderText}>
          <SkeletonLoader width="60%" height={16} />
          <SkeletonLoader width="40%" height={12} style={styles.mt8} />
        </View>
      </View>
      <SkeletonText lines={2} style={styles.mt16} />
    </View>
  );
};

export const SkeletonListItem = ({ style }) => {
  return (
    <View style={[styles.listItem, style]}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.listItemContent}>
        <SkeletonLoader width="70%" height={14} />
        <SkeletonLoader width="40%" height={12} style={styles.mt8} />
      </View>
    </View>
  );
};

export const SkeletonForm = ({ fields = 4, style }) => {
  return (
    <View style={[styles.form, style]}>
      {Array.from({ length: fields }).map((_, index) => (
        <View key={index} style={styles.formField}>
          <SkeletonLoader width="30%" height={12} />
          <SkeletonLoader width="100%" height={44} style={styles.mt8} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonTable = ({ rows = 5, columns = 4, style }) => {
  return (
    <View style={[styles.table, style]}>
      <View style={styles.tableHeader}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonLoader
            key={index}
            width={`${90 / columns}%`}
            height={16}
            style={index > 0 ? styles.ml8 : undefined}
          />
        ))}
      </View>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={rowIndex} style={[styles.tableRow, rowIndex > 0 ? styles.mt8 : styles.mt16]}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLoader
              key={colIndex}
              width={`${90 / columns}%`}
              height={14}
              style={colIndex > 0 ? styles.ml8 : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export const SkeletonStats = ({ count = 3, style }) => {
  return (
    <View style={[styles.stats, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.statItem}>
          <SkeletonLoader width={60} height={32} borderRadius={8} />
          <SkeletonLoader width={40} height={12} style={styles.mt8} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonChart = ({ style }) => {
  return (
    <View style={[styles.chart, style]}>
      <View style={styles.chartBars}>
        {[60, 80, 45, 90, 70, 55, 85].map((height, index) => (
          <SkeletonLoader
            key={index}
            width={20}
            height={`${height}%`}
            borderRadius={4}
            style={index > 0 ? styles.ml4 : undefined}
          />
        ))}
      </View>
      <SkeletonLoader width="100%" height={1} style={styles.mt16} />
      <View style={styles.chartLabels}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
          <SkeletonLoader
            key={index}
            width={20}
            height={10}
            style={index > 0 ? styles.ml4 : undefined}
          />
        ))}
      </View>
    </View>
  );
};

export const SkeletonAvatar = ({ size = 50, style }) => {
  return (
    <SkeletonLoader
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
};

export const SkeletonButton = ({ width = 120, height = 44, style }) => {
  return <SkeletonLoader width={width} height={height} borderRadius={8} style={style} />;
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  textContainer: {
    width: '100%',
  },
  textLine: {
    marginTop: 8,
  },
  card: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  form: {
    padding: 16,
  },
  formField: {
    marginBottom: 16,
  },
  table: {
    padding: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  chart: {
    padding: 16,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  ml4: { marginLeft: 4 },
  ml8: { marginLeft: 8 },
});

export default SkeletonLoader;
