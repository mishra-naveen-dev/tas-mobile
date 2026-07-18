import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Linking, Image, Modal, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DeviceInfo from 'react-native-device-info';

import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import LocationService from '../../services/LocationService';
import { serverStatus } from '../../utils/serverStatus';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

const SUPPORT_EMAIL = 'naveen@armanindia.com';

const FAQS = [
  { q: 'How do I Punch In?', a: 'Go to the Punch tab and tap the large location button. Your GPS location is captured automatically, then fill in the visit details and submit.' },
  { q: 'How do I Update Collection?', a: 'From My Collections, select a customer and tap "Update Collection". This opens the Collection Visit screen where you punch in and record the outcome together.' },
  { q: 'Why is GPS required?', a: 'GPS confirms you actually visited the customer location — it is required for punches, collection updates, and route tracking, and protects both you and the company with an accurate record.' },
  { q: 'How can I sync offline data?', a: 'The app automatically retries failed requests once your connection is back. If something still looks out of date, pull down on the screen to refresh.' },
  { q: 'How do I report an issue?', a: 'Use the "Report Technical Issue" button below — it opens your email app with your device and account details pre-filled so the IT team can help faster.' },
  { q: 'Why am I unable to login?', a: 'Double-check your username and password. If you’ve forgotten your password or your account seems locked, contact IT Support using the button below.' },
  { q: 'How does Route Tracking work?', a: 'Once you punch in, the app records your route in the background at regular intervals until you punch out, so your travel path is available for review.' },
];

const FEATURES = [
  'GPS Tracking',
  'Route Tracking',
  'Collection Management',
  'Offline Support',
  'Synchronization',
  'Attendance',
  'Punch Management',
  'Secure Login',
];

const fmtDateTime = (d) => {
  if (!d) return 'Unknown';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const HelpSupportScreen = ({ navigation }) => {
  const { user } = useAuth();

  const [profile, setProfile] = useState(user || null);
  const [appInfo, setAppInfo] = useState({ version: '', buildNumber: '', lastUpdated: null });
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [legalModal, setLegalModal] = useState(null); // 'privacy' | 'terms' | null
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getUserProfile();
        setProfile(res.data);
      } catch (e) {
        // Fall back to whatever's already in AuthContext — still enough
        // to build a useful diagnostic email.
      }
    })();

    (async () => {
      try {
        const version = DeviceInfo.getVersion();
        const buildNumber = DeviceInfo.getBuildNumber();
        const lastUpdated = await DeviceInfo.getLastUpdateTime();
        setAppInfo({ version, buildNumber, lastUpdated });
      } catch (e) {
        // Non-critical — the card just shows blanks.
      }
    })();
  }, []);

  const buildDiagnosticBody = useCallback(async () => {
    let gpsStatus = 'Unknown';
    try {
      gpsStatus = (await LocationService.checkPermission()) ? 'Enabled' : 'Disabled';
    } catch (e) {
      // leave as Unknown
    }

    let deviceName = 'Unknown';
    let manufacturer = 'Unknown';
    try {
      deviceName = await DeviceInfo.getDeviceName();
      manufacturer = await DeviceInfo.getManufacturer();
    } catch (e) {
      // best-effort
    }

    const p = profile || user || {};
    const employeeName = p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.username || 'Unknown');
    const now = new Date();

    return [
      `Employee Name: ${employeeName}`,
      `Employee ID: ${p.employee_id || ''}`,
      `Branch: ${p.branch_name || ''}`,
      `Mobile Number: ${p.phone || ''}`,
      '',
      'Issue Category:',
      '',
      'Describe your issue below:',
      '',
      '',
      '-----------------------------------------',
      'Diagnostic Information (auto-generated — do not remove)',
      '-----------------------------------------',
      `App Version: ${appInfo.version || 'Unknown'}`,
      `Build Number: ${appInfo.buildNumber || 'Unknown'}`,
      `Android Version: ${Platform.OS === 'android' ? Platform.Version : Platform.OS}`,
      `Device Name: ${deviceName}`,
      `Device Model: ${DeviceInfo.getModel()}`,
      `Manufacturer: ${manufacturer}`,
      `Logged-in User: ${employeeName}`,
      `Employee ID: ${p.employee_id || 'Unknown'}`,
      `Branch: ${p.branch_name || 'Unknown'}`,
      `GPS Status: ${gpsStatus}`,
      `Internet Status: ${serverStatus._online ? 'Online' : 'Offline'}`,
      `Timestamp: ${fmtDateTime(now)}`,
    ].join('\n');
  }, [profile, user, appInfo]);

  const openSupportEmail = useCallback(async (subject) => {
    setSendingReport(true);
    try {
      const body = await buildDiagnosticBody();
      const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
      }
    } finally {
      setSendingReport(false);
    }
  }, [buildDiagnosticBody]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: Application Information */}
        <View style={styles.card}>
          <View style={styles.appRow}>
            <View style={styles.appIconWrap}>
              <Icon name="smartphone" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appName}>Travel Allowance System (TAS)</Text>
              <Text style={styles.cardMeta}>Version {appInfo.version || '—'}{appInfo.buildNumber ? ` (Build ${appInfo.buildNumber})` : ''}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.cardMetaSmall}>Last Updated: {fmtDateTime(appInfo.lastUpdated)}</Text>
        </View>

        {/* Section 2: Company Information */}
        <View style={styles.card}>
          <View style={styles.companyRow}>
            <Image source={require('../../image/namra-logo.png')} style={styles.companyLogo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>Namra Finance Ltd.</Text>
            </View>
          </View>
          <Text style={styles.companyDescription}>
            Namra Finance Ltd. is a wholly owned subsidiary of Arman Financial Services Ltd.,
            which manages the Microfinance business of the group.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.copyrightText}>© {new Date().getFullYear()} Namra Finance Ltd.</Text>
          <Text style={styles.copyrightText}>All Rights Reserved.</Text>
        </View>

        {/* Section 3: IT Technical Support */}
        <View style={[styles.card, styles.supportCard]}>
          <View style={styles.appRow}>
            <View style={[styles.appIconWrap, { backgroundColor: colors.infoLight }]}>
              <Icon name="headphones" size={22} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appName}>IT Technical Support</Text>
            </View>
          </View>
          <Text style={styles.supportSubtitle}>
            For any application issue, login problem, GPS issue, collection issue, or technical
            assistance, please contact the IT Technical Support team.
          </Text>
          <TouchableOpacity
            style={styles.emailRow}
            onPress={() => openSupportEmail('TAS Mobile Support Request')}
            disabled={sendingReport}
          >
            <Icon name="mail" size={16} color={colors.primary} />
            <Text style={styles.emailText}>{SUPPORT_EMAIL}</Text>
            {sendingReport && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />}
          </TouchableOpacity>
        </View>

        {/* Section 4: Quick Help */}
        <Text style={styles.sectionLabel}>Quick Help</Text>
        <View style={styles.card}>
          {FAQS.map((f, i) => {
            const open = expandedFaq === i;
            return (
              <View key={f.q} style={i > 0 ? styles.faqRowBorder : null}>
                <TouchableOpacity style={styles.faqRow} onPress={() => setExpandedFaq(open ? null : i)}>
                  <Text style={styles.faqQuestion}>{f.q}</Text>
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {open && <Text style={styles.faqAnswer}>{f.a}</Text>}
              </View>
            );
          })}
        </View>

        {/* Section 5: Report a Problem */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={() => openSupportEmail('TAS Mobile Support Request — Technical Issue')}
          disabled={sendingReport}
        >
          {sendingReport ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="alert-triangle" size={18} color="#fff" />
              <Text style={styles.reportBtnText}>Report Technical Issue</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Section 6: Application Features */}
        <Text style={styles.sectionLabel}>Application Features</Text>
        <View style={styles.card}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Icon name="check-circle" size={16} color={colors.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Section 7: Legal */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.legalRow} onPress={() => setLegalModal('privacy')}>
            <Text style={styles.legalText}>Privacy Policy</Text>
            <Icon name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.faqRowBorder} />
          <TouchableOpacity style={styles.legalRow} onPress={() => setLegalModal('terms')}>
            <Text style={styles.legalText}>Terms & Conditions</Text>
            <Icon name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.faqRowBorder} />
          <View style={styles.legalRow}>
            <Text style={styles.legalText}>Application Version</Text>
            <Text style={styles.legalValue}>{appInfo.version || '—'}</Text>
          </View>
          <View style={styles.faqRowBorder} />
          <View style={styles.legalRow}>
            <Text style={styles.legalText}>Copyright</Text>
            <Text style={styles.legalValue}>© {new Date().getFullYear()} Namra Finance Ltd.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!legalModal} transparent animationType="fade" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{legalModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}</Text>
              <TouchableOpacity onPress={() => setLegalModal(null)}>
                <Icon name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>
              The full {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'} for TAS has not
              been published in-app yet. Please contact Namra Finance Ltd. or the IT Technical Support
              team above for the current document.
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setLegalModal(null)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.sizes.lg, fontWeight: 'bold', color: colors.text },
  content: { padding: spacing.md, paddingBottom: 60 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg || 16, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  supportCard: { borderLeftWidth: 4, borderLeftColor: colors.info },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  appIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  appName: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },
  cardMetaSmall: { fontSize: typography.sizes.xs, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.background, marginVertical: spacing.sm },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  companyLogo: { width: 48, height: 48, marginRight: spacing.sm },
  companyName: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  companyDescription: { fontSize: typography.sizes.sm, color: colors.textMuted, lineHeight: 20 },
  copyrightText: { fontSize: typography.sizes.xs, color: colors.textMuted },
  supportSubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  emailRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md, gap: 8 },
  emailText: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '600' },
  sectionLabel: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.xs, textTransform: 'uppercase' },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  faqRowBorder: { borderTopWidth: 1, borderTopColor: colors.background, marginTop: spacing.xs, paddingTop: spacing.xs },
  faqQuestion: { flex: 1, fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  faqAnswer: { fontSize: typography.sizes.sm, color: colors.textMuted, paddingBottom: spacing.sm, lineHeight: 20 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.danger, borderRadius: 12, paddingVertical: spacing.md, marginBottom: spacing.md },
  reportBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.sizes.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  featureText: { fontSize: typography.sizes.sm, color: colors.text },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  legalText: { fontSize: typography.sizes.sm, color: colors.text, fontWeight: '600' },
  legalValue: { fontSize: typography.sizes.sm, color: colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  modalBody: { fontSize: typography.sizes.sm, color: colors.textMuted, lineHeight: 20 },
  modalCloseBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: '700' },
});

export default HelpSupportScreen;
