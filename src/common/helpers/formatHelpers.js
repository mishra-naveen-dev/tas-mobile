export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '';
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
};

export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined) return '';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatDistance = (km) => {
  if (km === null || km === undefined) return '';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(2)} km`;
};

export const formatDuration = (minutes) => {
  if (!minutes) return '0 min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
};

export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined) return '';
  return `${Number(value).toFixed(decimals)}%`;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};

export const formatEmployeeId = (id) => {
  if (!id) return '';
  return `EMP${String(id).padStart(5, '0')}`;
};

export const formatAddress = (address) => {
  if (!address) return '';
  // Limit to first 50 characters with ellipsis
  return address.length > 50 ? `${address.slice(0, 50)}...` : address;
};

export const formatInitials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

export const abbreviateNumber = (num) => {
  if (num === null || num === undefined) return '';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return String(num);
};

export const formatCoordinate = (value, type = 'lat') => {
  if (value === null || value === undefined) return '';
  const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  return `${Math.abs(value).toFixed(6)}° ${direction}`;
};
