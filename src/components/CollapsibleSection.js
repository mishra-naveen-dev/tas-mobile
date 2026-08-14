import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

/**
 * Expand/collapse card used to organize the Punch & Activity Verification
 * screen into named sections (Overview, Branch Verification, GPS &
 * Location, ...) — the employee expands only what they need instead of
 * scrolling past a wall of technical detail.
 */
const CollapsibleSection = ({ title, icon, badge, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <View style={s.card}>
            <TouchableOpacity style={s.header} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
                {icon ? <Icon name={icon} size={18} color={colors.primary} style={s.headerIcon} /> : null}
                <Text style={s.title}>{title}</Text>
                {badge ? <View style={s.badgeSlot}>{badge}</View> : null}
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {open && <View style={s.body}>{children}</View>}
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, ...shadows.sm, overflow: 'hidden',
    },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    },
    headerIcon: { marginRight: 8 },
    title: { flex: 1, fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark },
    badgeSlot: { marginRight: 8 },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});

export default CollapsibleSection;
