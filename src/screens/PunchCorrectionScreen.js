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

const PunchCorrectionScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({
        punch_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        location_address: '',
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
        if (!data.punch_time.trim()) {
            Alert.alert("Error", "Please enter correct time.");
            return;
        }
        if (!data.location_address.trim()) {
            Alert.alert("Error", "Please enter location address.");
            return;
        }
        if (!data.reason.trim()) {
            Alert.alert("Error", "Please enter reason for correction.");
            return;
        }

        setLoading(true);

        try {
            const payload = {
                requested_time: data.punch_time.trim(),
                location: data.location_address.trim(),
                reason: data.reason.trim()
            };

            await api.post('/attendance/corrections/', payload);

            Alert.alert("Success", "Punch Correction submitted successfully!", [
                { 
                    text: 'OK', 
                    onPress: () => {
                        // Reset form
                        setData({
                            punch_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
                            location_address: '',
                            reason: '',
                        });
                        handleGoBack();
                    }
                }
            ]);

        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || "Failed to submit correction.";
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
                    <Text style={styles.headerTitle}>Punch Correction</Text>
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
                            autoCapitalize="words"
                        />

                        <InputField
                            icon="edit-3"
                            placeholder="Reason for Override"
                            value={data.reason}
                            onChangeText={(v) => updateData('reason', v)}
                            multiline={true}
                            numberOfLines={3}
                        />
                    </GlassCard>

                    <View style={styles.buttonContainer}>
                        <PrimaryButton
                            title="Submit Request"
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
        justifyContent: 'space-between',
        alignItems: 'center',
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
    placeholder: {
        width: 44,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
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
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginLeft: spacing.sm,
    },
    description: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
        lineHeight: 20,
    },
    buttonContainer: {
        marginTop: spacing.sm,
    }
});

export default PunchCorrectionScreen;
