import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Keyboard } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../api/api';
import { colors, typography, spacing } from '../theme/tokens';

/**
 * Employee picker backed by GET /organization/users/autocomplete/ — searched in
 * the database as you type (name or employee ID), at most 10 suggestions, and
 * only people the signed-in user may already see. Nothing is preloaded.
 *
 * value: the selected employee row ({id, employee_id, name, designation, branch}) or null.
 * onSelect(row | null): called on pick / clear.
 */
const EmployeeSearchInput = ({ value, onSelect, placeholder = 'Search employee name or ID', excludeId, style }) => {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (value || q.length < 2) {
            setOptions([]);
            return undefined;
        }
        let live = true;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.employeeAutocomplete(q);
                if (live) setOptions((res.data?.results || []).filter((o) => o.id !== excludeId));
            } catch {
                if (live) setOptions([]);
            } finally {
                if (live) setLoading(false);
            }
        }, 300);
        return () => { live = false; clearTimeout(timer); };
    }, [query, value, excludeId]);

    const pick = (row) => {
        Keyboard.dismiss();
        setQuery('');
        setOptions([]);
        onSelect(row);
    };

    if (value) {
        return (
            <View style={[styles.selected, style]}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName} numberOfLines={1}>{value.name} ({value.employee_id})</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                        {[value.designation || value.role, value.branch && `Branch: ${value.branch}`].filter(Boolean).join(' · ')}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => onSelect(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Icon name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={style}>
            <View style={styles.inputRow}>
                <Icon name="search" size={16} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            {query.trim().length >= 2 && !loading && options.length === 0 && (
                <Text style={styles.hint}>No matching employee</Text>
            )}
            {options.length > 0 && (
                <View style={styles.list}>
                    {options.map((o) => (
                        <TouchableOpacity key={o.id} style={styles.option} onPress={() => pick(o)}>
                            <Text style={styles.optionName} numberOfLines={1}>{o.name}</Text>
                            <Text style={styles.meta} numberOfLines={1}>
                                {[o.employee_id, o.designation || o.role, o.branch && `Branch: ${o.branch}`].filter(Boolean).join(' · ')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    inputRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border, borderRadius: 12,
        paddingHorizontal: spacing.sm, height: 46,
    },
    input: { flex: 1, marginLeft: spacing.xs, fontSize: typography.sizes.sm, color: colors.text, paddingVertical: 0 },
    hint: { marginTop: 6, marginLeft: 4, fontSize: typography.sizes.xs, color: colors.textMuted },
    list: {
        marginTop: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        borderRadius: 12, overflow: 'hidden',
    },
    option: { paddingHorizontal: spacing.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    optionName: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.text },
    meta: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    selected: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight,
        borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 8,
    },
    selectedName: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.primaryDark },
});

export default EmployeeSearchInput;
