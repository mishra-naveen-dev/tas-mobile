export const colors = {
    primary: '#DC2626',
    primaryDark: '#991B1B',
    primaryLight: '#FEE2E2',
    
    secondary: '#EF4444',
    
    success: '#10B981',
    successLight: '#D1FAE5',
    
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    
    info: '#2563EB',
    infoLight: '#DBEAFE',
    
    background: '#F5F7FA',
    surface: '#FFFFFF',
    
    textDark: '#1E293B',
    textMedium: '#64748B',
    textMuted: '#94A3B8',
    textLight: '#CBD5E1',
    
    border: '#E2E8F0',
    divider: '#F1F5F9',
    
    overlay: 'rgba(0, 0, 0, 0.5)',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
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
