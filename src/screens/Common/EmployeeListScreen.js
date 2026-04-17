import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';

const EmployeeListScreen = ({ navigation }) => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/organization/users/?role=EMPLOYEE');
            setEmployees(res.data?.results || res.data || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderEmployee = ({ item }) => (
        <TouchableOpacity
            style={styles.employeeCard}
            onPress={() => navigation.navigate('EmployeeTracking', { employeeId: item.id })}
        >
            <View style={styles.employeeAvatar}>
                <Text style={styles.avatarText}>
                    {(item.first_name || 'E').charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>
                    {item.first_name} {item.last_name || ''}
                </Text>
                <Text style={styles.employeeDetail}>ID: {item.employee_id}</Text>
                {item.designation && (
                    <Text style={styles.employeeDetail}>{item.designation}</Text>
                )}
            </View>
            <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success : colors.textMuted }]} />
                <Text style={styles.statusText}>
                    {item.is_active ? 'Active' : 'Inactive'}
                </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Employees"
                subtitle={`${employees.length} employees`}
                navigation={navigation}
            />

            <FlatList
                data={employees}
                keyExtractor={(item, index) => item.id ? `emp_${item.id}` : `emp-${index}`}
                renderItem={renderEmployee}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="users" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>No employees found</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    employeeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        elevation: 2,
    },
    employeeAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    employeeInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    employeeName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    employeeDetail: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    statusContainer: {
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginBottom: 4,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
});

export default EmployeeListScreen;
