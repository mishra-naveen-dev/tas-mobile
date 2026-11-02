/**
 * Where a notification should take the user when tapped — ONE place, so the
 * real-time in-app toast (App.jsx's SSEClient handler), the Notifications
 * list screen, and a tapped OS-level push (PushNotificationService) all
 * agree instead of drifting into three separate per-type switches.
 *
 * Keyed on notification_type first (matches what every call site already
 * has) - action_url (sent by the backend, apps.organization.services.
 * notify_user) is accepted for forward-compatibility but not required yet,
 * since every type handled today already has an explicit target below.
 */
import { Alert, Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import api from '../api/api';

// Opens the newest release's download link (the same flow as UpdatePrompt's
// "Update Now"). Asks for the latest rather than the notified version: an
// old notification may point at a version the phone already has.
export async function openLatestRelease() {
    try {
        const res = await api.checkMobileRelease(parseInt(DeviceInfo.getBuildNumber(), 10));
        const latest = res.data?.latest;
        if (!res.data?.update_available || !latest) {
            Alert.alert('Up to date', 'You already have the latest version of the app.');
            return;
        }
        const dl = await api.getMobileReleaseDownloadUrl(latest.version_code);
        if (!dl.data?.download_url) throw new Error('No download link');
        await Linking.openURL(dl.data.download_url);
    } catch {
        Alert.alert('Update', 'Could not open the update link. Please check your internet and try again.');
    }
}
export function navigateForNotification(navigationRef, payload) {
    // Needs no screen, so it works even before navigation is ready (cold start).
    if (payload?.notification_type === 'APP_UPDATE_AVAILABLE') {
        openLatestRelease();
        return;
    }
    if (!navigationRef?.current) return;
    const nav = navigationRef.current;
    const type = payload?.notification_type;

    switch (type) {
        case 'CUSTOMER_ASSIGNED':
            // Only employees receive this, so EmployeeTabs/EmployeeCollections
            // (the real registered route names — see RootNavigator.js) is
            // always the right target.
            if (payload.collection_id) {
                nav.navigate('EmployeeTabs', {
                    screen: 'EmployeeCollections',
                    params: { collectionId: payload.collection_id },
                });
            } else {
                nav.navigate('EmployeeTabs', { screen: 'EmployeeCollections' });
            }
            return;
        case 'PUNCH_INACTIVITY':
        case 'DAILY_PUNCH_REMINDER':
            nav.navigate('EmployeeTabs', { screen: 'EmployeePunch' });
            return;
        default:
            // Unmapped type — do nothing rather than guess a target. Every
            // type handled above is employee-only; a manager/admin role tab
            // stack may not even have an 'EmployeeTabs' route, so a blind
            // fallback here risks a bad navigate() for the wrong role.
            return;
    }
}
