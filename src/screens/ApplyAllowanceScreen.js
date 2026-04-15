import React, { useState, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    Alert, 
    ScrollView, 
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';

const ApplyAllowanceScreen = ({ navigation, route }) => {
    const initialDistance = route.params?.distance || 0;

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({
        travel_date: new Date().toISOString().split('T')[0],
        from_location: '',
        to_location: '',
        total_distance: initialDistance ? initialDistance.toString() : '',
        reason: '',
    });

    // Use useCallback to prevent re-creation on each render
    const updateData = useCallback((key, value) => {
        setData(prevData => {
            if (prevData[key] === value) return prevData;
            return { ...prevData, [key]: value };
        });
    }, []);

    const handleGoBack = () => {
        const state = navigation.getState();
        if (state && state.routes.length <= 1) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
            });
        } else {
            navigation.goBack();
        }
    };

    const handleSubmit = async () => {
        if (!data.from_location.trim()) {
            Alert.alert("Error", "Please enter from location.");
            return;
        }
        if (!data.to_location.trim()) {
            Alert.alert("Error", "Please enter to location.");
            return;
        }
        if (!data.total_distance || parseFloat(data.total_distance) <= 0) {
            Alert.alert("Error", "Please enter valid distance.");
            return;
        }

        setLoading(true);

        try {
            const payload = {
                travel_date: data.travel_date,
                from_location: data.from_location.trim(),
                to_location: data.to_location.trim(),
                total_distance: parseFloat(data.total_distance),
                reason: data.reason.trim()
            };

            await api.post('/allowance/requests/', payload);

            Alert.alert("Success", "Allowance Request submitted successfully!", [
                { 
                    text: 'OK', 
                    onPress: handleGoBack
                }
            ]);

        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || "Failed to submit allowance request.";
            Alert.alert("Submission Failed", errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        onPress={handleGoBack}
                        style={styles.backBtn}
                    >
                        <Icon name="arrow-left" size={24} color={colors.textDark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Claim Allowance</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                >
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
                            autoCapitalize="words"
                        />

                        <InputField
                            icon="map"
                            placeholder="To Location"
                            value={data.to_location}
                            onChangeText={(v) => updateData('to_location', v)}
                            autoCapitalize="words"
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
                            multiline={true}
                            numberOfLines={3}
                        />
                    </GlassCard>

                    <View style={styles.buttonContainer}>
                        <PrimaryButton
                            title="Submit Claim"
                            onPress={handleSubmit}
                            loading={loading}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardAvoid: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: Platform.OS === 'android' ? spacing.md : spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    placeholder: {
        width: 44,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl * 2,
        flexGrow: 1,
    },
    card: {
        marginBottom: spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginLeft: spacing.sm,
    },
    buttonContainer: {
        marginTop: spacing.sm,
    }
});

export default ApplyAllowanceScreen;
