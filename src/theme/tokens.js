export const colors = {
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    primaryLight: '#DBEAFE',

    secondary: '#DC2626',

    success: '#059669',
    successLight: '#D1FAE5',

    error: '#DC2626',
    errorLight: '#FEE2E2',

    warning: '#D97706',
    warningLight: '#FEF3C7',

    danger: '#DC2626',
    dangerLight: '#FEE2E2',

    info: '#0891B2',
    infoLight: '#CFFAFE',

    background: '#FFF5F5',
    surface: '#FFFFFF',

    text: '#1F2937',
    textDark: '#1F2937',
    textMedium: '#4B5563',
    textMuted: '#9CA3AF',
    textLight: '#D1D5DB',

    border: '#FECACA',
    divider: '#FFF5F5',

    overlay: 'rgba(0, 0, 0, 0.5)',

    skeleton: '#FECACA',

    punchBlue: '#2563EB',
    punchBlueLight: '#DBEAFE',
};

export const typography = {
    fontFamily: 'System',
    sizes: {
        xs: 13,
        sm: 15,
        md: 17,
        base: 18,
        lg: 20,
        xl: 22,
        xxl: 24,
        xxxl: 28,
        display: 32,
    },
    weights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
    },
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },
};

export const spacing = {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
};

export const borderRadius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

export const shadows = {
    none: {},
    xs: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    sm: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    xl: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 8,
    },
};

export const theme = {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
};

export default theme;
