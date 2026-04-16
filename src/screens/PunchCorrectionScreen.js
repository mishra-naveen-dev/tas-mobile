import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ErrorView from '../components/ErrorView';
import { SkeletonForm } from '../components/SkeletonComponents';
import { colors, typography, spacing } from '../theme/tokens';

const PunchCorrectionScreen = ({ navigation }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [data, setData] = useState({
        punch_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        location_address: '',
        reason: '',
    });

    const updateData = (key, value) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!data.punch_time || !data.location_address || !data.reason) {
            Alert.alert("Error", "Please fill out all fields.");
            return;
        }

        try {
            setIsLoading(true);

            const payload = {
                requested_time: data.punch_time,
                location: data.location_address,
                reason: data.reason
            };

            await api.post('/attendance/corrections/', payload);

            Alert.alert("Success", "Punch Correction submitted successfully!", [
                { text: 'OK', onPress: () => {
                    setData({
                        punch_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
                        location_address: '',
                        reason: '',
                    });
                }}
            ]);

        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || "Failed to submit correction.";
            Alert.alert("Submission Failed", errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(() => {
        setIsRefreshing(false);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Punch Correction</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            >
                {hasError ? (
                    <ErrorView onRetry={() => setHasError(false)} style={{ marginTop: spacing.xxl }} />
                ) : (
                    <GlassCard style={styles.card}>
                        <View style={styles.sectionHeader}>
                            <Icon name="clock" size={20} color={colors.warning} />
                            <Text style={styles.sectionTitle}>Correction Request</Text>
                        </View>

                        <Text style={styles.description}>
                            Use this form if your device failed to log your location, or you forgot to punch out before losing internet access.
                        </Text>

                        <InputField
                            icon="calendar"
                            placeholder="Correct Time (YYYY-MM-DD HH:MM)"
                            value={data.punch_time}
                            onChangeText={(v) => updateData('punch_time', v)}
                        />

                        <InputField
                            icon="map-pin"
                            placeholder="Correct Location Address"
                            value={data.location_address}
                            onChangeText={(v) => updateData('location_address', v)}
                        />

                        <InputField
                            icon="edit-3"
                            placeholder="Reason for Override"
                            value={data.reason}
                            onChangeText={(v) => updateData('reason', v)}
                        />
                    </GlassCard>
                )}

                {!hasError && (
                    <PrimaryButton
                        title="Submit Request"
                        onPress={handleSubmit}
                        loading={isLoading}
                        style={styles.submitBtn}
                        disabled={isLoading}
                    />
                )}
            </ScrollView>

            <LoadingOverlay visible={isLoading} message="Submitting..." />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        padding: spacing.md, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
    },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    scrollContent: { padding: spacing.lg, paddingBottom: 160 },
    card: { marginBottom: spacing.lg },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    sectionTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark, marginLeft: spacing.sm },
    description: { fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
    submitBtn: { marginTop: spacing.sm }
});

export default PunchCorrectionScreen;
