export const colors = {
    primary: '#4361EE',       // Vibrant Blue
    primaryDark: '#3A0CA3',   // Deep Blue
    secondary: '#F72585',     // Vibrant Pink/Red
    success: '#4CC9F0',       // Light Blue/Cyan
    warning: '#F8961E',       // Orange
    danger: '#F94144',        // Red
    error: '#F94144',         // Red (alternative)
    
    background: '#F8F9FA',    // Light Grayish White
    surface: '#FFFFFF',       // Pure White
    white: '#FFFFFF',        // White
    
    textDark: '#2B2D42',      // Almost Black
    text: '#2B2D42',        // Default text
    textMuted: '#8D99AE',     // Gray
    
    border: '#EDF2F4',        // Soft Border Color
    
    // Gradients
    gradientPrimary: ['#4361EE', '#3A0CA3'],
    gradientSecondary: ['#F72585', '#7209B7'],
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
    fontFamily: 'System', // Can be customized later
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    medium: {
        shadowColor: '#3A0CA3',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    floating: {
        shadowColor: '#4361EE',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    }
};
