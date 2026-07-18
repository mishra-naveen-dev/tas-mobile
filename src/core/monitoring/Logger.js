import { Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_STORAGE_KEY = '@app_error_logs';
const MAX_LOGS = 100;

class Logger {
  constructor() {
    this.logs = [];
    this.isEnabled = __DEV__;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(log) {
    this.listeners.forEach(callback => {
      try {
        callback(log);
      } catch (e) {
        console.error('Error in logger listener:', e);
      }
    });
  }

  getDeviceInfo() {
    return {
      platform: Platform.OS,
      platformVersion: Platform.Version,
      dimensions: Dimensions.get('window'),
      timestamp: new Date().toISOString(),
    };
  }

  formatLog(level, message, data = null, context = {}) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      data,
      context,
      device: this.getDeviceInfo(),
      timestamp: new Date().toISOString(),
    };
  }

  async saveLog(log) {
    try {
      const existingLogs = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      
      logs.push(log);
      if (logs.length > MAX_LOGS) {
        logs.shift();
      }
      
      await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  }

  async log(level, message, data = null, context = {}) {
    if (!this.isEnabled && level === 'debug') {
      return;
    }

    const log = this.formatLog(level, message, data, context);
    this.logs.push(log);
    
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }

    // Console output — dev builds only. Logs are still persisted to
    // AsyncStorage (below) regardless, for in-app log viewing/export.
    if (__DEV__) {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

      switch (level) {
        case 'error':
          console.error(formattedMessage, data || '', context || {});
          break;
        case 'warn':
          console.warn(formattedMessage, data || '', context || {});
          break;
        default:
          console.log(formattedMessage, data || '', context || {});
      }
    }

    // Notify listeners
    this.notifyListeners(log);

    // Save to storage
    await this.saveLog(log);
  }

  debug(message, data = null, context = {}) {
    this.log('debug', message, data, context);
  }

  info(message, data = null, context = {}) {
    this.log('info', message, data, context);
  }

  warn(message, data = null, context = {}) {
    this.log('warn', message, data, context);
  }

  error(error, context = {}) {
    const message = error instanceof Error ? error.message : String(error);
    const data = error instanceof Error ? { name: error.name, stack: error.stack } : error;
    this.log('error', message, data, context);
  }

  async getLogs() {
    try {
      const storedLogs = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      return storedLogs ? JSON.parse(storedLogs) : this.logs;
    } catch (error) {
      console.error('Failed to get logs:', error);
      return this.logs;
    }
  }

  async clearLogs() {
    try {
      await AsyncStorage.removeItem(LOG_STORAGE_KEY);
      this.logs = [];
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  async getLogsByLevel(level) {
    const logs = await this.getLogs();
    return logs.filter(log => log.level === level);
  }

  async getLogsByDate(startDate, endDate) {
    const logs = await this.getLogs();
    return logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }
}

export const logger = new Logger();
export default logger;

// Convenience functions
export const logError = (error, context = {}) => logger.error(error, context);
export const logInfo = (message, data = null, context = {}) => logger.info(message, data, context);
export const logWarn = (message, data = null, context = {}) => logger.warn(message, data, context);
export const logDebug = (message, data = null, context = {}) => logger.debug(message, data, context);
