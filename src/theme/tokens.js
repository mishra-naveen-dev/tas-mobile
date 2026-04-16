export const colors = {
    primary: '#DC2626',       // Red
    primaryDark: '#991B1B',   // Dark Red
    secondary: '#EF4444',     // Light Red
    success: '#22C55E',       // Green
    warning: '#F59E0B',        // Amber
    danger: '#DC2626',        // Red
    
    background: '#F8F9FA',    // Light Grayish White
    surface: '#FFFFFF',       // Pure White
    
    textDark: '#1F2937',      // Dark Gray
    textMuted: '#6B7280',     // Gray
    
    border: '#E5E7EB',        // Soft Border Color
    
    // Gradients
    gradientPrimary: ['#DC2626', '#991B1B'],
    gradientSecondary: ['#EF4444', '#DC2626'],
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
        bold: '700',
    }
};

export const shadows = {
    soft: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    medium: {
        shadowColor: '#991B1B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    floating: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    }
};
