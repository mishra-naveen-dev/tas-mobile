import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { DATE_FORMAT } from '../constants';

export const formatDate = (date, formatStr = DATE_FORMAT.DISPLAY) => {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '';
  return format(parsed, formatStr);
};

export const formatTime = (date) => {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '';
  return format(parsed, DATE_FORMAT.TIME);
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '';
  return format(parsed, DATE_FORMAT.DATETIME);
};

export const formatRelative = (date) => {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '';
  return formatDistanceToNow(parsed, { addSuffix: true });
};

export const isToday = (date) => {
  if (!date) return false;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  const today = new Date();
  return (
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear()
  );
};

export const isYesterday = (date) => {
  if (!date) return false;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    parsed.getDate() === yesterday.getDate() &&
    parsed.getMonth() === yesterday.getMonth() &&
    parsed.getFullYear() === yesterday.getFullYear()
  );
};

export const getDateRange = (range) => {
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  let start = new Date(today);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

export const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
};

export const getWeekDays = () => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
};

export const isDateInRange = (date, start, end) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  return d >= s && d <= e;
};

export const getDaysBetween = (start, end) => {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  const diffTime = Math.abs(e - s);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
