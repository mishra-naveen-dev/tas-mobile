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
export function navigateForNotification(navigationRef, payload) {
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
