import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from './tokens';

export const globalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContent: {
        padding: spacing.lg,
    },
    heading: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xs,
    },
    subHeading: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.regular,
        color: colors.textMuted,
        marginBottom: spacing.lg,
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
