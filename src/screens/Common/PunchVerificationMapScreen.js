import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../../theme/tokens';
import { fmtDistanceMeters, fmtTime } from '../../utils/geoVerification';

const PIN_COLORS = {
    branch: '#7C3AED',
    punchIn: '#059669',
    punchOut: '#DC2626',
    customer: '#2563EB',
};

const Pin = ({ color, icon }) => (
    <View style={[p.pin, { borderColor: color }]}>
        <View style={[p.pinCore, { backgroundColor: color }]}>
            <Icon name={icon} size={12} color="#fff" />
        </View>
    </View>
);
const p = StyleSheet.create({
    pin: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    pinCore: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

const midpoint = (a, b) => ({
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
});

const DistanceLabel = ({ at, text }) => (
    <Marker coordinate={at} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={dl.pill}><Text style={dl.text}>{text}</Text></View>
    </Marker>
);
const dl = StyleSheet.create({
    pill: { backgroundColor: 'rgba(15,23,42,0.85)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    text: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

const PunchVerificationMapScreen = ({ route, navigation }) => {
    const { session } = route.params || {};
    const mapRef = useRef(null);

    const branch = session?.branch;
    const punchIn = session?.punch_in;
    const punchOut = session?.punch_out;
    const activities = session?.activities || [];

    const branchCoord = branch?.latitude != null && branch?.longitude != null
        ? { latitude: branch.latitude, longitude: branch.longitude } : null;
    const punchInCoord = punchIn ? { latitude: punchIn.latitude, longitude: punchIn.longitude } : null;
    const punchOutCoord = punchOut ? { latitude: punchOut.latitude, longitude: punchOut.longitude } : null;

    // Cheap, small-N computations (one session's worth of activities) — no
    // memoization needed; plain consts recomputed each render are simpler
    // and avoid the "new object literal every render" memo-dependency trap.
    const customerLines = activities
        .filter(a => a.customer_latitude != null && a.customer_longitude != null && a.latitude != null && a.longitude != null)
        .map(a => ({
            id: a.id,
            customer: { latitude: a.customer_latitude, longitude: a.customer_longitude },
            activity: { latitude: a.latitude, longitude: a.longitude },
            distance: a.distance_from_customer,
            name: a.customer_name,
            time: a.created_at,
        }));

    const allCoords = [];
    if (branchCoord) allCoords.push(branchCoord);
    if (punchInCoord) allCoords.push(punchInCoord);
    if (punchOutCoord) allCoords.push(punchOutCoord);
    customerLines.forEach(l => { allCoords.push(l.customer); allCoords.push(l.activity); });

    const initialRegion = allCoords[0]
        ? { ...allCoords[0], latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 10, longitudeDelta: 10 };

    if (!session) {
        return (
            <SafeAreaView style={s.container} edges={['top']}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <Icon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Map Verification</Text>
                    <View style={{ width: 38 }} />
                </View>
                <View style={s.centered}>
                    <Icon name="map" size={44} color={colors.border} />
                    <Text style={s.emptyText}>No session data to show on the map.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Map Verification</Text>
                <View style={{ width: 38 }} />
            </View>

            <MapView
                ref={mapRef}
                style={s.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion}
                onMapReady={() => {
                    if (allCoords.length > 1) {
                        mapRef.current?.fitToCoordinates(allCoords, {
                            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                            animated: true,
                        });
                    }
                }}
            >
                {branchCoord && punchInCoord && (
                    <>
                        <Polyline coordinates={[branchCoord, punchInCoord]} strokeColor={PIN_COLORS.branch} strokeWidth={2} lineDashPattern={[6, 4]} />
                        <DistanceLabel at={midpoint(branchCoord, punchInCoord)} text={fmtDistanceMeters(punchIn.distance_from_branch)} />
                    </>
                )}

                {customerLines.map(l => (
                    <React.Fragment key={l.id}>
                        <Polyline coordinates={[l.customer, l.activity]} strokeColor={PIN_COLORS.customer} strokeWidth={2} lineDashPattern={[6, 4]} />
                        <DistanceLabel at={midpoint(l.customer, l.activity)} text={fmtDistanceMeters(l.distance)} />
                        <Marker coordinate={l.customer}>
                            <Pin color={PIN_COLORS.customer} icon="user" />
                            <Callout tooltip>
                                <View style={s.callout}>
                                    <Text style={s.calloutTitle}>{l.name || 'Customer'}</Text>
                                    <Text style={s.calloutSub}>Registered location</Text>
                                </View>
                            </Callout>
                        </Marker>
                        <Marker coordinate={l.activity}>
                            <Pin color={PIN_COLORS.customer} icon="map-pin" />
                            <Callout tooltip>
                                <View style={s.callout}>
                                    <Text style={s.calloutTitle}>Activity — {fmtTime(l.time)}</Text>
                                    <Text style={s.calloutSub}>{fmtDistanceMeters(l.distance)} from customer</Text>
                                </View>
                            </Callout>
                        </Marker>
                    </React.Fragment>
                ))}

                {branchCoord && (
                    <Marker coordinate={branchCoord}>
                        <Pin color={PIN_COLORS.branch} icon="briefcase" />
                        <Callout tooltip>
                            <View style={s.callout}>
                                <Text style={s.calloutTitle}>{branch.name}</Text>
                                <Text style={s.calloutSub}>Assigned Branch</Text>
                            </View>
                        </Callout>
                    </Marker>
                )}
                {punchInCoord && (
                    <Marker coordinate={punchInCoord}>
                        <Pin color={PIN_COLORS.punchIn} icon="log-in" />
                        <Callout tooltip>
                            <View style={s.callout}>
                                <Text style={s.calloutTitle}>Punch In — {fmtTime(punchIn.punched_at)}</Text>
                                <Text style={s.calloutSub}>{fmtDistanceMeters(punchIn.distance_from_branch)} from branch</Text>
                            </View>
                        </Callout>
                    </Marker>
                )}
                {punchOutCoord && (
                    <Marker coordinate={punchOutCoord}>
                        <Pin color={PIN_COLORS.punchOut} icon="log-out" />
                        <Callout tooltip>
                            <View style={s.callout}>
                                <Text style={s.calloutTitle}>Punch Out — {fmtTime(punchOut.punched_at)}</Text>
                                <Text style={s.calloutSub}>{fmtDistanceMeters(punchOut.distance_from_branch)} from branch</Text>
                            </View>
                        </Callout>
                    </Marker>
                )}
            </MapView>

            <View style={s.legend}>
                <LegendItem color={PIN_COLORS.branch} label="Branch" />
                <LegendItem color={PIN_COLORS.punchIn} label="Punch In" />
                <LegendItem color={PIN_COLORS.punchOut} label="Punch Out" />
                <LegendItem color={PIN_COLORS.customer} label="Customer / Activity" />
            </View>
        </SafeAreaView>
    );
};

const LegendItem = ({ color, label }) => (
    <View style={s.legendItem}>
        <View style={[s.legendDot, { backgroundColor: color }]} />
        <Text style={s.legendText}>{label}</Text>
    </View>
);

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: '700', color: '#fff' },
    map: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.md },

    callout: { backgroundColor: '#fff', borderRadius: 8, padding: 8, minWidth: 140, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },
    calloutTitle: { fontSize: 12, fontWeight: '700', color: colors.textDark },
    calloutSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    legend: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: colors.surface,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 11, color: colors.textMuted },
});

export default PunchVerificationMapScreen;
