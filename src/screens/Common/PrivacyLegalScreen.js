import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, spacing } from '../../theme/tokens';

const ROWS = [
    { type: 'TERMS', title: 'Terms & Conditions', icon: 'file-text' },
    { type: 'PRIVACY', title: 'Privacy Policy', icon: 'shield' },
    { type: 'LOCATION_TRACKING', title: 'Location & Tracking Notice', icon: 'map-pin' },
    { type: 'MY', title: 'My Acknowledgements', icon: 'check-circle' },
];

const PrivacyLegalScreen = ({ navigation }) => (
    <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Privacy & Legal" navigation={navigation} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {ROWS.map((r) => (
                <TouchableOpacity key={r.type} style={styles.row} activeOpacity={0.7}
                    onPress={() => navigation.navigate('LegalDocument', { docType: r.type })}>
                    <Icon name={r.icon} size={20} color={colors.primary} />
                    <Text style={styles.text}>{r.title}</Text>
                    <Icon name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            ))}
        </ScrollView>
    </SafeAreaView>
);

export default PrivacyLegalScreen;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
    text: { flex: 1, marginLeft: spacing.md, color: colors.textPrimary, fontWeight: '600' },
});
