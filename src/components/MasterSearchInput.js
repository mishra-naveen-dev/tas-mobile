/**
 * MasterSearchInput (mobile)
 *
 * Modal-based searchable picker backed by /master-data/values/.
 *
 * Props:
 *   categoryKey  string — category key (e.g. 'grade', 'designation')
 *   label        string — displayed label
 *   value        string — currently selected name
 *   onChange     fn(name: string) — called on selection
 *   userRole     'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN'
 *   required     bool
 *   placeholder  string
 */
import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    FlatList,
    ActivityIndicator,
    Alert,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';
import api from '../api/api';

const DEBOUNCE_MS = 350;

const MasterSearchInput = ({
    categoryKey,
    label,
    value = '',
    onChange,
    userRole = 'EMPLOYEE',
    required = false,
    placeholder = 'Select or search...',
    style,
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createDialog, setCreateDialog] = useState(false);
    const [newName, setNewName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const debounceRef = useRef(null);

    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    const isAdmin = userRole === 'ADMIN';
    const canCreate = isSuperAdmin || isAdmin;

    const fetchOptions = useCallback(async (q = '') => {
        setLoading(true);
        try {
            const res = await api.searchMasterValues(categoryKey, q, 30);
            const data = res.data;
            setOptions(Array.isArray(data) ? data : (data?.results || []));
        } catch {
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, [categoryKey]);

    const openModal = () => {
        setQuery('');
        setModalVisible(true);
        fetchOptions('');
    };

    const handleQueryChange = (text) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchOptions(text), DEBOUNCE_MS);
    };

    const selectItem = (item) => {
        onChange(item.name);
        api.incrementMasterUsage(item.id).catch(() => {});
        setModalVisible(false);
    };

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setCreateLoading(true);
        try {
            const res = await api.createMasterValue(categoryKey, trimmed);
            const data = res.data;
            if (isSuperAdmin) {
                const created = data.value || data;
                onChange(created.name);
                Alert.alert('Created', `"${created.name}" is now available.`);
            } else {
                Alert.alert('Request Submitted', `Your request for "${trimmed}" has been submitted for approval.`);
            }
            setCreateDialog(false);
            setModalVisible(false);
        } catch (err) {
            const errData = err?.response?.data;
            if (err?.response?.status === 409) {
                const existing = errData?.existing;
                Alert.alert('Already Exists', `"${existing?.name || trimmed}" already exists. Please select it from the list.`);
            } else {
                Alert.alert('Error', errData?.error || 'Failed to submit. Please try again.');
            }
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <View style={[styles.wrapper, style]}>
            <Text style={styles.label}>
                {label}
                {required && <Text style={styles.required}> *</Text>}
            </Text>

            <TouchableOpacity style={styles.selector} onPress={openModal} activeOpacity={0.7}>
                <Text style={value ? styles.selectorValue : styles.selectorPlaceholder} numberOfLines={1}>
                    {value || placeholder}
                </Text>
                <Icon name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Search Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalSheet}
                    >
                        <SafeAreaView style={{ flex: 1 }}>
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{label}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Icon name="x" size={22} color={colors.textDark} />
                                </TouchableOpacity>
                            </View>

                            {/* Search box */}
                            <View style={styles.searchRow}>
                                <Icon name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={`Search ${label}...`}
                                    placeholderTextColor={colors.textMuted}
                                    value={query}
                                    onChangeText={handleQueryChange}
                                    autoFocus
                                />
                                {query.length > 0 && (
                                    <TouchableOpacity onPress={() => { setQuery(''); fetchOptions(''); }}>
                                        <Icon name="x-circle" size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Results */}
                            {loading ? (
                                <View style={styles.centerBox}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            ) : (
                                <FlatList
                                    data={options}
                                    keyExtractor={item => String(item.id)}
                                    keyboardShouldPersistTaps="handled"
                                    ListEmptyComponent={
                                        <View style={styles.centerBox}>
                                            <Text style={styles.emptyText}>
                                                {query ? `No results for "${query}"` : 'No values found.'}
                                            </Text>
                                        </View>
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.option, value === item.name && styles.optionSelected]}
                                            onPress={() => selectItem(item)}
                                            activeOpacity={0.6}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                value === item.name && styles.optionTextSelected,
                                            ]}>
                                                {item.name}
                                            </Text>
                                            {value === item.name && (
                                                <Icon name="check" size={16} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    ListFooterComponent={
                                        canCreate && query.trim() ? (
                                            <TouchableOpacity
                                                style={styles.createOption}
                                                onPress={() => {
                                                    setNewName(query.trim());
                                                    setCreateDialog(true);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Icon
                                                    name={isSuperAdmin ? 'plus-circle' : 'clock'}
                                                    size={16}
                                                    color={isSuperAdmin ? colors.success : colors.primary}
                                                />
                                                <Text style={[
                                                    styles.createOptionText,
                                                    { color: isSuperAdmin ? colors.success : colors.primary }
                                                ]}>
                                                    {isSuperAdmin
                                                        ? `Create "${query.trim()}"`
                                                        : `Request "${query.trim()}"`}
                                                </Text>
                                            </TouchableOpacity>
                                        ) : null
                                    }
                                />
                            )}
                        </SafeAreaView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Create / Request confirm dialog */}
            <Modal
                visible={createDialog}
                animationType="fade"
                transparent
                onRequestClose={() => !createLoading && setCreateDialog(false)}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialog}>
                        <Text style={styles.dialogTitle}>
                            {isSuperAdmin ? `Create New ${label}` : `Request New ${label}`}
                        </Text>
                        <Text style={styles.dialogBody}>
                            {isSuperAdmin
                                ? `"${newName}" will be immediately available system-wide.`
                                : `"${newName}" will be submitted for Super Admin approval.`}
                        </Text>
                        <TextInput
                            style={styles.dialogInput}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder={label}
                            placeholderTextColor={colors.textMuted}
                            editable={!createLoading}
                        />
                        <View style={styles.dialogActions}>
                            <TouchableOpacity
                                style={styles.dialogCancel}
                                onPress={() => setCreateDialog(false)}
                                disabled={createLoading}
                            >
                                <Text style={styles.dialogCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.dialogConfirm,
                                    { backgroundColor: isSuperAdmin ? colors.success : colors.primary },
                                    createLoading && { opacity: 0.6 },
                                ]}
                                onPress={handleCreate}
                                disabled={createLoading || !newName.trim()}
                            >
                                {createLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.dialogConfirmText}>
                                        {isSuperAdmin ? 'Create Now' : 'Submit Request'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    required: {
        color: colors.error,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 44,
    },
    selectorValue: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        marginRight: spacing.sm,
    },
    selectorPlaceholder: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginRight: spacing.sm,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: spacing.md,
        backgroundColor: colors.background,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
    },
    searchIcon: {
        marginRight: spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        paddingVertical: spacing.sm,
    },
    centerBox: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    optionSelected: {
        backgroundColor: colors.primaryLight || '#EEF2FF',
    },
    optionText: {
        fontSize: typography.sizes.md,
        color: colors.textDark,
        flex: 1,
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: typography.weights.semibold,
    },
    createOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: spacing.xs,
    },
    createOptionText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        marginLeft: spacing.sm,
    },
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    dialog: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.xl,
        width: '100%',
    },
    dialogTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
    dialogBody: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    dialogInput: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    dialogActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    dialogCancel: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    dialogCancelText: {
        color: colors.textMuted,
        fontSize: typography.sizes.md,
    },
    dialogConfirm: {
        flex: 2,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        alignItems: 'center',
    },
    dialogConfirmText: {
        color: '#fff',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
});

export default MasterSearchInput;
