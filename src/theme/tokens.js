export const colors = {
    // Primary Colors - RED
    primary: '#DC2626',       // Bright Red
    primaryDark: '#B91C1C',   // Dark Red
    primaryLight: '#FCA5A5',   // Light Red
    
    // Secondary Colors - WHITE/GRAY
    secondary: '#FFFFFF',     // Pure White
    secondaryDark: '#F3F4F6',  // Light Gray
    
    // Status Colors
    success: '#16A34A',       // Green
    successLight: '#DCFCE7',   // Light Green
    warning: '#F59E0B',       // Amber
    warningLight: '#FEF3C7',  // Light Amber
    info: '#0EA5E9',          // Sky Blue
    infoLight: '#E0F2FE',     // Light Sky Blue
    danger: '#DC2626',        // Red (same as primary)
    dangerLight: '#FEE2E2',   // Light Red
    error: '#DC2626',         // Red (same as primary)
    
    // Background & Surface
    background: '#F9FAFB',    // Very Light Gray
    surface: '#FFFFFF',       // Pure White
    white: '#FFFFFF',         // White
    
    // Text Colors
    textDark: '#111827',      // Almost Black
    text: '#111827',          // Default text
    textMuted: '#6B7280',    // Gray
    textLight: '#9CA3AF',    // Light Gray
    textWhite: '#FFFFFF',     // White text
    
    // Border Colors
    border: '#E5E7EB',        // Light Border
    borderDark: '#D1D5DB',    // Darker Border
    
    // Additional
    overlay: 'rgba(0, 0, 0, 0.5)',  // Modal Overlay
    shadow: '#000000',        // Shadow color
    
    // Red variants for UI elements
    red50: '#FEF2F2',
    red100: '#FEE2E2',
    red200: '#FECACA',
    red300: '#FCA5A5',
    red400: '#F87171',
    red500: '#EF4444',
    red600: '#DC2626',
    red700: '#B91C1C',
    red800: '#991B1B',
    red900: '#7F1D1D',
    
    // Gradient colors
    gradientPrimary: ['#DC2626', '#B91C1C'],
    gradientSecondary: ['#EF4444', '#DC2626'],
    gradientDanger: ['#F87171', '#DC2626'],
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const typography = {
    fontFamily: 'System',
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
    },
    weights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    }
};

export const shadows = {
    soft: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    medium: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    floating: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 8,
    }
};

export default { colors, spacing, typography, shadows };
