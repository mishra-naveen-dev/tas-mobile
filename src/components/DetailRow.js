import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';

/** A single label/value line — the basic building block of every
 * verification detail section (Punch Information, Branch Verification,
 * GPS & Location, ...). Human-readable label on the left, value on the
 * right; `mono` renders the value in a fixed-width style for coordinates. */
const DetailRow = ({ label, value, mono, valueColor }) => (
    <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.value, mono && s.mono, valueColor && { color: valueColor }]} numberOfLines={2}>
            {value == null || value === '' ? '—' : value}
        </Text>
    </View>
);

const s = StyleSheet.create({
    row: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingVertical: 6, gap: spacing.sm,
    },
    label: { fontSize: typography.sizes.sm, color: colors.textMuted, flexShrink: 0 },
    value: { fontSize: typography.sizes.sm, color: colors.textDark, fontWeight: '600', textAlign: 'right', flex: 1 },
    mono: { fontFamily: 'monospace', fontWeight: '400' },
});

export default DetailRow;
