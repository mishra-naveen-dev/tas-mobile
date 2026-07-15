import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const ICONS_BY_TYPE = {
  CUSTOMER_ASSIGNED: 'user-plus',
  ALLOWANCE_APPROVED: 'check-circle',
  ALLOWANCE_REJECTED: 'x-circle',
  ALLOWANCE_REQUEST: 'file-text',
  CORRECTION_REQUEST: 'file-text',
  CORRECTION_APPROVED: 'check-circle',
  CORRECTION_REJECTED: 'x-circle',
  CORRECTION_WINDOW_OPEN: 'clock',
  CORRECTION_WINDOW_CLOSING: 'alert-triangle',
  PROFILE_UPDATE: 'user',
  PROFILE_UPDATE_APPROVED: 'check-circle',
  PROFILE_UPDATE_REJECTED: 'x-circle',
  PUNCH_INACTIVITY: 'alert-circle',
  DEVICE_APPROVED: 'smartphone',
  DEVICE_REJECTED: 'smartphone',
  MASTER_DATA_REQUEST: 'file-text',
  MASTER_DATA_APPROVED: 'check-circle',
  MASTER_DATA_REJECTED: 'x-circle',
  GENERAL: 'bell',
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const NotificationRow = ({ item, onPress }) => (
  <TouchableOpacity
    style={[styles.row, !item.is_read && styles.rowUnread]}
    onPress={() => onPress(item)}
    activeOpacity={0.7}
  >
    <View style={[styles.iconWrap, !item.is_read && styles.iconWrapUnread]}>
      <Icon
        name={ICONS_BY_TYPE[item.notification_type] || 'bell'}
        size={16}
        color={item.is_read ? colors.textMuted : colors.primary}
      />
    </View>
    <View style={styles.rowBody}>
      <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.time}>{fmtTime(item.created_at)}</Text>
    </View>
    {!item.is_read && <View style={styles.unreadDot} />}
  </TouchableOpacity>
);

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res?.data?.results || res?.data || []);
    } catch {
      // leave whatever was already loaded — a transient failure here
      // shouldn't blank out a list the user was already looking at
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePress = async (item) => {
    if (!item.is_read) {
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      api.markNotificationRead(item.id).catch(() => {});
    }

    // Only employees are ever sent CUSTOMER_ASSIGNED notifications, so the
    // EmployeeTabs/EmployeeCollections target is always valid for them; the
    // try/catch is just a safety net rather than something expected to fire.
    try {
      if (item.related_type === 'CollectionRecord' && item.related_id) {
        navigation.navigate('EmployeeTabs', {
          screen: 'EmployeeCollections',
          params: { collectionId: item.related_id },
        });
      } else if (item.related_type === 'CollectionRecordBulkAssignment') {
        navigation.navigate('EmployeeTabs', { screen: 'EmployeeCollections' });
      } else if (item.related_type === 'AttendancePunch') {
        navigation.navigate('EmployeeTabs', { screen: 'EmployeePunch' });
      }
    } catch {
      // Recipient's role doesn't have this tab (shouldn't happen for this
      // notification type) — the notification is still marked read above.
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      load();
    }
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      {loading ? (
        <View style={{ padding: spacing.md }}>
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <NotificationRow item={item} onPress={handlePress} />}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Icon name="bell-off" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
  markAllText: { fontSize: typography.sizes.xs, fontWeight: '700', color: colors.primary, width: 90, textAlign: 'right' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  emptyContainer: { flexGrow: 1 },
  emptyText: { marginTop: spacing.md, fontSize: typography.sizes.sm, color: colors.textMuted },
  listContent: { paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowUnread: { backgroundColor: colors.primaryLight },
  iconWrap: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  iconWrapUnread: { backgroundColor: '#fff' },
  rowBody: { flex: 1 },
  title: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textDark },
  titleUnread: { fontWeight: '800' },
  message: { fontSize: typography.sizes.xs, color: colors.textMedium, marginTop: 2 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});

export default NotificationsScreen;
