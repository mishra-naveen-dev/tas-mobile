import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, typography } from '../theme/tokens';

const AuthGuard = ({ children, fallback = null }) => {
    const auth = useAuth();

    if (!auth.isAuthenticated) {
        return fallback || (
            <View style={styles.container}>
                <Text style={styles.message}>Please log in to continue</Text>
            </View>
        );
    }

    return children;
};

const RoleGuard = ({ children, allowedRoles, fallback = null }) => {
    const auth = useAuth();

    if (!auth.isAuthenticated) {
        return fallback || (
            <View style={styles.container}>
                <Text style={styles.message}>Please log in to continue</Text>
            </View>
        );
    }

    if (allowedRoles && !allowedRoles.includes(auth.role)) {
        return fallback || (
            <View style={styles.container}>
                <Text style={styles.message}>Access denied. Insufficient permissions.</Text>
            </View>
        );
    }

    return children;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 20,
    },
    message: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        textAlign: 'center',
    },
});

export { AuthGuard, RoleGuard };
export default AuthGuard;
