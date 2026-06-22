import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import MasterSearchInput from '../../components/MasterSearchInput';

const CreateUserScreen = ({ navigation }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        employee_id: '',
        role: 'EMPLOYEE',
        grade_name: '',
        department_name: '',
        designation: '',
        territory: '',
        reporting_group: '',
        travel_mode: '',
    });
    const [loading, setLoading] = useState(false);

    const roles = [
        { id: 'EMPLOYEE', label: 'Employee', color: colors.success },
        { id: 'ADMIN', label: 'Admin', color: colors.primary },
        { id: 'SUPER_ADMIN', label: 'Super Admin', color: colors.warning },
    ];

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const validateForm = () => {
        if (!formData.username.trim()) {
            Alert.alert('Error', 'Username is required');
            return false;
        }
        if (!formData.email.trim()) {
            Alert.alert('Error', 'Email is required');
            return false;
        }
        if (!formData.first_name.trim()) {
            Alert.alert('Error', 'First name is required');
            return false;
        }
        if (!formData.employee_id.trim()) {
            Alert.alert('Error', 'Employee ID is required');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setLoading(true);
        try {
            await api.createUser(formData);
            Alert.alert('Success', 'User created successfully. Default password: Temp@123', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to create user';
            Alert.alert('Error', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Create User"
                subtitle="Add new user to organization"
                navigation={navigation}
            />

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Basic Info */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>User Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter username"
                            value={formData.username}
                            onChangeText={(v) => handleChange('username', v)}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter email"
                            value={formData.email}
                            onChangeText={(v) => handleChange('email', v)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                            <Text style={styles.label}>First Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="First name"
                                value={formData.first_name}
                                onChangeText={(v) => handleChange('first_name', v)}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Last name"
                                value={formData.last_name}
                                onChangeText={(v) => handleChange('last_name', v)}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Employee ID *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., EMP001"
                            value={formData.employee_id}
                            onChangeText={(v) => handleChange('employee_id', v)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter phone number"
                            value={formData.phone}
                            onChangeText={(v) => handleChange('phone', v)}
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                {/* Role Selection */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Role Selection</Text>
                    <View style={styles.roleContainer}>
                        {roles.map((role) => (
                            <TouchableOpacity
                                key={role.id}
                                style={[
                                    styles.roleCard,
                                    formData.role === role.id && styles.roleCardActive,
                                    { borderColor: formData.role === role.id ? role.color : colors.border },
                                ]}
                                onPress={() => handleChange('role', role.id)}
                            >
                                <View style={[styles.roleDot, { backgroundColor: role.color }]} />
                                <Text style={[
                                    styles.roleLabel,
                                    formData.role === role.id && { color: role.color },
                                ]}>
                                    {role.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Role & Designation */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Role & Designation</Text>

                    <MasterSearchInput
                        categoryKey="grade"
                        label="Grade"
                        value={formData.grade_name}
                        onChange={(v) => handleChange('grade_name', v)}
                        userRole="SUPER_ADMIN"
                    />
                    <MasterSearchInput
                        categoryKey="department"
                        label="Department"
                        value={formData.department_name}
                        onChange={(v) => handleChange('department_name', v)}
                        userRole="SUPER_ADMIN"
                    />
                    <MasterSearchInput
                        categoryKey="designation"
                        label="Designation"
                        value={formData.designation}
                        onChange={(v) => handleChange('designation', v)}
                        userRole="SUPER_ADMIN"
                    />
                    <MasterSearchInput
                        categoryKey="reporting_group"
                        label="Reporting Group"
                        value={formData.reporting_group}
                        onChange={(v) => handleChange('reporting_group', v)}
                        userRole="SUPER_ADMIN"
                    />
                    <MasterSearchInput
                        categoryKey="travel_mode"
                        label="Travel Mode"
                        value={formData.travel_mode}
                        onChange={(v) => handleChange('travel_mode', v)}
                        userRole="SUPER_ADMIN"
                    />
                    <MasterSearchInput
                        categoryKey="territory"
                        label="Territory"
                        value={formData.territory}
                        onChange={(v) => handleChange('territory', v)}
                        userRole="SUPER_ADMIN"
                        style={{ marginBottom: 0 }}
                    />
                </View>

                {/* Password info */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Temporary Password</Text>
                    <View style={styles.passwordInfo}>
                        <Icon name="info" size={16} color={colors.info} />
                        <Text style={styles.passwordInfoText}>
                            A temporary password "Temp@123" will be assigned. User will be prompted to change it on first login.
                        </Text>
                    </View>
                </View>

                <PrimaryButton
                    title="Create User"
                    onPress={handleSubmit}
                    loading={loading}
                    style={styles.submitBtn}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    formCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: typography.sizes.md,
        color: colors.textDark,
    },
    row: {
        flexDirection: 'row',
    },
    roleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    roleCard: {
        flex: 1,
        minWidth: 90,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderWidth: 2,
        borderRadius: 8,
        backgroundColor: colors.background,
    },
    roleCardActive: {
        backgroundColor: colors.background,
    },
    roleDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: spacing.xs,
    },
    roleLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMuted,
    },
    passwordInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.infoLight,
        padding: spacing.md,
        borderRadius: 8,
    },
    passwordInfoText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.info,
        marginLeft: spacing.sm,
    },
    submitBtn: {
        marginTop: spacing.md,
    },
});

export default CreateUserScreen;
