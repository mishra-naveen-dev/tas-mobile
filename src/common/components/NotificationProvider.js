import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../../theme/tokens';
import { logger } from '../../core/monitoring/Logger';

const NotificationContext = createContext(null);

export const NotificationTypes = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export const NotificationDuration = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 8000,
};

export const NotificationPosition = {
  TOP: 'top',
  BOTTOM: 'bottom',
};

const Notification = ({ notification, onDismiss }) => {
  const fadeAnim = new Animated.Value(0);
  const translateY = new Animated.Value(-100);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }),
    ]).start();

    if (notification.duration !== Infinity) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration || NotificationDuration.MEDIUM);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(notification.id);
    });
  };

  const getConfig = () => {
    switch (notification.type) {
      case NotificationTypes.SUCCESS:
        return {
          bgColor: colors.success,
          icon: 'check-circle',
        };
      case NotificationTypes.ERROR:
        return {
          bgColor: colors.danger,
          icon: 'alert-circle',
        };
      case NotificationTypes.WARNING:
        return {
          bgColor: colors.warning,
          icon: 'alert-triangle',
        };
      case NotificationTypes.INFO:
      default:
        return {
          bgColor: colors.info,
          icon: 'info',
        };
    }
  };

  const config = getConfig();

  return (
    <Animated.View
      style={[
        styles.notification,
        { backgroundColor: config.bgColor, opacity: fadeAnim, transform: [{ translateY }] },
      ]}
    >
      <Icon name={config.icon} size={20} color="#FFFFFF" style={styles.icon} />
      <Text style={styles.message}>{notification.message}</Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
        <Icon name="x" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);

  const addNotification = useCallback((message, type = NotificationTypes.INFO, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
      id,
      message,
      type,
      duration: options.duration ?? NotificationDuration.MEDIUM,
      persistent: options.persistent ?? false,
    };

    setNotifications(prev => [...prev, notification]);
    logger.info('Notification added', { type, message });

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((message, options = {}) => {
    return addNotification(message, NotificationTypes.SUCCESS, options);
  }, [addNotification]);

  const error = useCallback((message, options = {}) => {
    return addNotification(message, NotificationTypes.ERROR, { ...options, duration: NotificationDuration.LONG });
  }, [addNotification]);

  const warning = useCallback((message, options = {}) => {
    return addNotification(message, NotificationTypes.WARNING, options);
  }, [addNotification]);

  const info = useCallback((message, options = {}) => {
    return addNotification(message, NotificationTypes.INFO, options);
  }, [addNotification]);

  // Badge count management
  const incrementBadge = useCallback(() => {
    setBadgeCount(prev => prev + 1);
  }, []);

  const clearBadge = useCallback(() => {
    setBadgeCount(0);
  }, []);

  const value = {
    notifications,
    badgeCount,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    incrementBadge,
    clearBadge,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            notification={notification}
            onDismiss={removeNotification}
          />
        ))}
      </View>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.md,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});

export default NotificationContext;
