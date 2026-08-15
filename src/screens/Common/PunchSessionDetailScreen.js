import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { parseApiError } from '../../core/error/AppErrorHandler';
import CollapsibleSection from '../../components/CollapsibleSection';
import DetailRow from '../../components/DetailRow';
import {
    geoStatusInfo, gpsAccuracyTier, ACCURACY_TIER_COLOR,
    fmtDurationSeconds, fmtDistanceMeters, fmtTime, fmtDate, fmtCoord,
} from '../../utils/geoVerification';

const GeoBadge = ({ status, small }) => {
    const info = geoStatusInfo(status);
    return (
        <View style={[b.badge, { backgroundColor: `${info.color}18` }, small && b.badgeSmall]}>
            <Icon name={info.icon} size={small ? 10 : 12} color={info.color} />
            <Text style={[b.text, { color: info.color }, small && b.textSmall]}>{info.label}</Text>
        </View>
    );
};
const b = StyleSheet.create({
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    badgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
    text: { fontSize: 11, fontWeight: '700' },
    textSmall: { fontSize: 10 },
});

// ─── GPS & Location block (shared by punch-in / punch-out) ────────────────────
const LocationBlock = ({ title, punch }) => {
    if (!punch) {
        return (
            <View style={{ marginBottom: spacing.md }}>
                <Text style={ld.blockTitle}>{title}</Text>
                <Text style={ld.emptyText}>Not recorded.</Text>
            </View>
        );
    }
    const gc = punch.gps_capture_details;
    const tier = gpsAccuracyTier(punch.accuracy);
    return (
        <View style={{ marginBottom: spacing.md }}>
            <Text style={ld.blockTitle}>{title}</Text>
            <DetailRow label="Latitude" value={fmtCoord(punch.latitude)} mono />
            <DetailRow label="Longitude" value={fmtCoord(punch.longitude)} mono />
            <DetailRow label="Address" value={punch.address} />
            <DetailRow
                label="GPS Accuracy"
                value={punch.accuracy != null ? `${Math.round(punch.accuracy)} m${tier ? ` (${tier})` : ''}` : '—'}
                valueColor={tier ? ACCURACY_TIER_COLOR[tier] : undefined}
            />
            <DetailRow label="Captured Date" value={fmtDate(punch.punched_at)} />
            <DetailRow label="Captured Time" value={fmtTime(punch.punched_at)} />
            <DetailRow label="Location Source" value={gc?.gps_provider || 'Unknown'} />
            <DetailRow label="Network Status" value={gc?.network_status || 'Unknown'} />
            <DetailRow label="Device" value={gc?.device_id || 'Unknown'} />
        </View>
    );
};
const ld = StyleSheet.create({
    blockTitle: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.primary, marginBottom: 4, marginTop: 6 },
    emptyText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontStyle: 'italic' },
});

// ─── Activity (Collection/Visit) full detail ───────────────────────────────────
const ActivityDetail = ({ activity }) => {
    const isCollection = activity.activity_type === 'Collection';
    const punchD = activity.punch_details;
    const tier = gpsAccuracyTier(activity.gps_status ? punchD?.accuracy : null);

    return (
        <View style={ad.wrap}>
            <DetailRow label="Customer" value={activity.customer_name} />
            <DetailRow label="Loan ID" value={activity.loan_id} />
            {isCollection ? (
                <>
                    <DetailRow label="Collection Status" value={activity.status_display} />
                    <DetailRow label="Collected Amount" value={activity.collected_amount != null ? `₹${Number(activity.collected_amount).toLocaleString('en-IN')}` : '—'} />
                    <DetailRow label="Payment Mode" value={punchD?.payment_method} />
                    {punchD?.upi_ref ? <DetailRow label="UPI Reference" value={punchD.upi_ref} /> : null}
                    {punchD?.cheque_no ? <DetailRow label="Cheque Number" value={punchD.cheque_no} /> : null}
                </>
            ) : (
                <>
                    <DetailRow label="Visit Type" value={activity.status_display} />
                    <DetailRow label="Visit Reason" value={activity.visit_reason} />
                    <DetailRow label="Visit Duration" value={activity.visit_duration_seconds ? fmtDurationSeconds(activity.visit_duration_seconds) : '—'} />
                </>
            )}
            <DetailRow label="Activity Date" value={fmtDate(activity.created_at)} />
            <DetailRow label="Activity Time" value={fmtTime(activity.created_at)} />
            <DetailRow label="Remarks" value={activity.remarks} />

            <Text style={ad.subheading}>Location Verification</Text>
            <DetailRow label="Activity Latitude" value={fmtCoord(activity.latitude)} mono />
            <DetailRow label="Activity Longitude" value={fmtCoord(activity.longitude)} mono />
            <DetailRow label="Captured Address" value={activity.location_address} />
            <DetailRow label="Customer Latitude" value={fmtCoord(activity.customer_latitude)} mono />
            <DetailRow label="Customer Longitude" value={fmtCoord(activity.customer_longitude)} mono />
            <DetailRow label="Distance From Customer" value={fmtDistanceMeters(activity.distance_from_customer)} />
            <DetailRow label="Distance From Branch" value={fmtDistanceMeters(activity.distance_from_branch)} />
            <DetailRow
                label="GPS Accuracy"
                value={punchD?.accuracy != null ? `${Math.round(punchD.accuracy)} m${tier ? ` (${tier})` : ''}` : '—'}
                valueColor={tier ? ACCURACY_TIER_COLOR[tier] : undefined}
            />
            <View style={{ marginTop: 4 }}><GeoBadge status={activity.geo_status} /></View>

            {punchD?.travel_type === 'WITH_EMPLOYEE' && (
                <>
                    <Text style={ad.subheading}>Travel With</Text>
                    <DetailRow label="Companion" value={punchD.companion_name} />
                    <DetailRow label="Companion Phone" value={punchD.companion_phone} />
                </>
            )}

            {activity.photos?.length > 0 && (
                <>
                    <Text style={ad.subheading}>Photos / Documents</Text>
                    <View style={ad.photoRow}>
                        {activity.photos.map(p => (
                            <Image key={p.id} source={{ uri: p.image }} style={ad.photo} />
                        ))}
                    </View>
                </>
            )}
        </View>
    );
};
const ad = StyleSheet.create({
    wrap: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
    subheading: { fontSize: typography.sizes.xs, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm, marginBottom: 2, textTransform: 'uppercase' },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    photo: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.border },
});

// ─── Timeline row ───────────────────────────────────────────────────────────────
const ACTIVITY_ICON = { Collection: 'dollar-sign', Visit: 'home' };

const TimelineRow = ({ activity, isLast, expanded, onToggle }) => (
    <View style={tl.row}>
        <View style={tl.rail}>
            <View style={[tl.dot, { backgroundColor: geoStatusInfo(activity.geo_status).color }]}>
                <Icon name={ACTIVITY_ICON[activity.activity_type] || 'map-pin'} size={12} color="#fff" />
            </View>
            {!isLast && <View style={tl.line} />}
        </View>
        <TouchableOpacity style={tl.content} onPress={onToggle} activeOpacity={0.7}>
            <View style={tl.topRow}>
                <Text style={tl.time}>{fmtTime(activity.created_at)}</Text>
                <Text style={tl.type}>{activity.activity_type}</Text>
                <View style={{ flex: 1 }} />
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </View>
            <Text style={tl.customer}>{activity.customer_name} {activity.loan_id ? `· ${activity.loan_id}` : ''}</Text>
            <View style={tl.metaRow}>
                {activity.collected_amount != null && (
                    <Text style={tl.metaText}>₹{Number(activity.collected_amount).toLocaleString('en-IN')}</Text>
                )}
                <Text style={tl.metaText}>{fmtDistanceMeters(activity.distance_from_customer)} from customer</Text>
                <Text style={tl.metaText}>Since punch-in: {fmtDurationSeconds(activity.time_since_punch_in_seconds)}</Text>
            </View>
            <GeoBadge status={activity.geo_status} small />
            {expanded && <ActivityDetail activity={activity} />}
        </TouchableOpacity>
    </View>
);
const tl = StyleSheet.create({
    row: { flexDirection: 'row' },
    rail: { alignItems: 'center', width: 28 },
    dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
    content: { flex: 1, paddingBottom: spacing.md },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    time: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },
    type: { fontSize: typography.sizes.xs, fontWeight: '700', color: colors.primary, backgroundColor: colors.primaryLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    customer: { fontSize: typography.sizes.sm, color: colors.textDark, marginTop: 2 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2, marginBottom: 4 },
    metaText: { fontSize: 11, color: colors.textMuted },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const PunchSessionDetailScreen = ({ route, navigation }) => {
    const { punchId } = route.params || {};
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            setHasError(false);
            if (isRefresh) setIsRefreshing(true); else setIsLoading(true);
            const res = await api.getPunchSessionDetail(punchId);
            setSession(res.data);
        } catch (err) {
            setHasError(true);
            setErrorMsg(parseApiError(err).message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [punchId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (isLoading) {
        return (
            <SafeAreaView style={s.container} edges={['top']}>
                <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
            </SafeAreaView>
        );
    }

    if (hasError && !session) {
        return (
            <SafeAreaView style={s.container} edges={['top']}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <Icon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Punch Details</Text>
                    <View style={{ width: 38 }} />
                </View>
                <View style={s.centered}>
                    <Icon name="wifi-off" size={44} color={colors.danger} />
                    <Text style={s.errorTxt}>{errorMsg || 'Could not load data'}</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={() => fetchData()}>
                        <Icon name="refresh-cw" size={14} color="#fff" />
                        <Text style={s.retryTxt}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const punchIn = session.punch_in;
    const punchOut = session.punch_out;
    const branch = session.branch;
    const employee = punchIn?.employee_details;

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={s.headerTitle}>Punch & Activity Details</Text>
                    <Text style={s.headerSub}>{fmtDate(punchIn?.punched_at)}</Text>
                </View>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchData(true)} colors={[colors.primary]} />}
            >
                {/* ── Employee ── */}
                <View style={s.employeeCard}>
                    <View style={s.employeeIcon}><Icon name="user" size={20} color={colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.employeeName}>
                            {employee ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username : '—'}
                        </Text>
                        <Text style={s.employeeId}>Employee ID: {employee?.employee_id || '—'}</Text>
                    </View>
                    <TouchableOpacity
                        style={s.mapBtn}
                        onPress={() => navigation.navigate('PunchVerificationMap', { session })}
                    >
                        <Icon name="map" size={14} color="#fff" />
                        <Text style={s.mapBtnText}>View on Map</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Overview ── */}
                <CollapsibleSection title="Overview" icon="info" defaultOpen badge={<GeoBadge status={session.geo_status} small />}>
                    <DetailRow label="Punch Status" value={session.is_open ? 'Active (not punched out)' : 'Completed'} />
                    <DetailRow label="Tracking Status" value={session.is_open ? 'Currently tracking' : 'Ended'} />
                    <DetailRow label="Branch" value={branch?.name || 'Not assigned'} />
                    <DetailRow label="Total Working Duration" value={fmtDurationSeconds(session.duration_seconds)} />
                    <DetailRow label="Customer Activities" value={session.activities.length} />
                    <DetailRow label="Collections" value={session.activities.filter(a => a.activity_type === 'Collection').length} />
                    <DetailRow label="Visits" value={session.activities.filter(a => a.activity_type === 'Visit').length} />
                    <DetailRow
                        label="GPS Exceptions"
                        value={session.activities.filter(a => a.geo_status && a.geo_status !== 'VERIFIED').length}
                    />
                </CollapsibleSection>

                {/* ── Punch Information ── */}
                <CollapsibleSection title="Punch Information" icon="clock">
                    <Text style={ld.blockTitle}>Punch In</Text>
                    <DetailRow label="Time" value={fmtTime(punchIn?.punched_at)} />
                    <DetailRow label="Date" value={fmtDate(punchIn?.punched_at)} />
                    <View style={{ marginTop: 2, marginBottom: 6 }}><GeoBadge status={punchIn?.geo_status} small /></View>
                    <Text style={ld.blockTitle}>Punch Out</Text>
                    {punchOut ? (
                        <>
                            <DetailRow label="Time" value={fmtTime(punchOut.punched_at)} />
                            <DetailRow label="Date" value={fmtDate(punchOut.punched_at)} />
                            <View style={{ marginTop: 2 }}><GeoBadge status={punchOut.geo_status} small /></View>
                        </>
                    ) : (
                        <Text style={ld.emptyText}>Not punched out yet.</Text>
                    )}
                </CollapsibleSection>

                {/* ── Branch Verification ── */}
                <CollapsibleSection title="Branch Verification" icon="briefcase">
                    {branch ? (
                        <>
                            <DetailRow label="Branch Name" value={branch.name} />
                            <DetailRow label="Branch Code" value={branch.code} />
                            <DetailRow label="Branch Address" value={branch.address} />
                            <DetailRow label="Branch Latitude" value={fmtCoord(branch.latitude)} mono />
                            <DetailRow label="Branch Longitude" value={fmtCoord(branch.longitude)} mono />
                            <DetailRow label="Punch Latitude" value={fmtCoord(punchIn?.latitude)} mono />
                            <DetailRow label="Punch Longitude" value={fmtCoord(punchIn?.longitude)} mono />
                            <DetailRow label="Distance From Branch" value={fmtDistanceMeters(punchIn?.distance_from_branch)} />
                            <DetailRow label="Allowed Branch Radius" value={punchIn?.branch_radius_m != null ? `${punchIn.branch_radius_m} m` : '—'} />
                            <View style={{ marginTop: 4 }}><GeoBadge status={punchIn?.geo_status} /></View>
                        </>
                    ) : (
                        <Text style={ld.emptyText}>No branch assigned to this employee.</Text>
                    )}
                </CollapsibleSection>

                {/* ── GPS & Location ── */}
                <CollapsibleSection title="GPS & Location Details" icon="map-pin">
                    <LocationBlock title="Punch In Location" punch={punchIn} />
                    <LocationBlock title="Punch Out Location" punch={punchOut} />
                </CollapsibleSection>

                {/* ── Customer Activities & Timeline ── */}
                <CollapsibleSection title="Customer Activities" icon="activity" defaultOpen>
                    {session.activities.length === 0 ? (
                        <Text style={ld.emptyText}>No customer activities recorded in this session.</Text>
                    ) : (
                        session.activities.map((a, i) => (
                            <TimelineRow
                                key={a.id}
                                activity={a}
                                isLast={i === session.activities.length - 1}
                                expanded={expandedId === a.id}
                                onToggle={() => setExpandedId(v => v === a.id ? null : a.id)}
                            />
                        ))
                    )}
                </CollapsibleSection>
            </ScrollView>
        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    errorTxt: { fontSize: typography.sizes.sm, color: colors.danger, marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.lg },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    retryTxt: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: '600' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.sizes.md, fontWeight: '700', color: '#fff' },
    headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

    scroll: { padding: spacing.md, paddingBottom: 100 },

    employeeCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm, gap: spacing.sm,
    },
    employeeIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    employeeName: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark },
    employeeId: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 1 },
    mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
    mapBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

export default PunchSessionDetailScreen;
