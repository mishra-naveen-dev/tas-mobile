import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ScrollView,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
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

const ApplyAllowanceScreen = ({ navigation, route }) => {
    const initialDistance = route.params?.distance || 0;

    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [data, setData] = useState({
        travel_date: new Date().toISOString().split('T')[0],
        from_location: '',
        to_location: '',
        total_distance: initialDistance.toString(),
        reason: '',
    });

    const updateData = (key, value) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!data.from_location || !data.to_location || !data.total_distance) {
            Alert.alert("Error", "Please fill out all required location and distance fields.");
            return;
        }

        try {
            setIsLoading(true);

            const payload = {
                travel_date: data.travel_date,
                from_location: data.from_location,
                to_location: data.to_location,
                total_distance: parseFloat(data.total_distance),
                reason: data.reason
            };

            await api.post('/allowance/requests/', payload);

            Alert.alert("Success", "Allowance Request submitted successfully!", [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || "Failed to submit allowance request.";
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Claim Allowance</Text>
                <View style={{ width: 40 }} />
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
                            <Icon name="file-text" size={20} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Travel Details</Text>
                        </View>

                        <InputField
                            icon="calendar"
                            placeholder="Travel Date (YYYY-MM-DD)"
                            value={data.travel_date}
                            onChangeText={(v) => updateData('travel_date', v)}
                        />

                        <InputField
                            icon="map-pin"
                            placeholder="From Location"
                            value={data.from_location}
                            onChangeText={(v) => updateData('from_location', v)}
                        />

                        <InputField
                            icon="map"
                            placeholder="To Location"
                            value={data.to_location}
                            onChangeText={(v) => updateData('to_location', v)}
                        />

                        <InputField
                            icon="navigation"
                            placeholder="Total Distance (km)"
                            value={data.total_distance}
                            onChangeText={(v) => updateData('total_distance', v)}
                            keyboardType="decimal-pad"
                        />

                        <InputField
                            icon="edit-3"
                            placeholder="Reason / Purpose of Travel"
                            value={data.reason}
                            onChangeText={(v) => updateData('reason', v)}
                        />
                    </GlassCard>
                )}

                {!hasError && (
                    <PrimaryButton
                        title="Submit Claim"
                        onPress={handleSubmit}
                        loading={isLoading}
                        style={styles.submitBtn}
                        disabled={isLoading}
                    />
                )}
            </ScrollView>

            <LoadingOverlay visible={isLoading} message="Submitting claim..." />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: spacing.md, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.sm },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    scrollContent: { padding: spacing.lg, paddingBottom: 160 },
    card: { marginBottom: spacing.lg },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark, marginLeft: spacing.sm },
    submitBtn: { marginTop: spacing.sm }
});

export default ApplyAllowanceScreen;
