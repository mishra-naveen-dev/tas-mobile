export const isRequired = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

export const isEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isPhone = (phone) => {
  if (!phone) return false;
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

export const isMinLength = (value, min) => {
  if (!value) return false;
  return String(value).length >= min;
};

export const isMaxLength = (value, max) => {
  if (!value) return true;
  return String(value).length <= max;
};

export const isMinValue = (value, min) => {
  if (value === null || value === undefined || value === '') return true;
  return Number(value) >= min;
};

export const isMaxValue = (value, max) => {
  if (value === null || value === undefined || value === '') return true;
  return Number(value) <= max;
};

export const isNumeric = (value) => {
  if (!value) return false;
  return /^\d+$/.test(value);
};

export const isAlpha = (value) => {
  if (!value) return false;
  return /^[a-zA-Z]+$/.test(value);
};

export const isAlphaNumeric = (value) => {
  if (!value) return false;
  return /^[a-zA-Z0-9]+$/.test(value);
};

export const isUrl = (value) => {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const isDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

export const isFutureDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return date > new Date();
};

export const isPastDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return date < new Date();
};

export const isPincode = (value) => {
  if (!value) return false;
  return /^\d{6}$/.test(value);
};

export const isVehicleNumber = (value) => {
  if (!value) return false;
  const vehicleRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/i;
  return vehicleRegex.test(value);
};

export const isUPI = (value) => {
  if (!value) return false;
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(value);
};

export const isChequeNumber = (value) => {
  if (!value) return false;
  return /^\d{6,12}$/.test(value);
};

export const validateForm = (data, rules) => {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach(field => {
    const fieldRules = Array.isArray(rules[field]) ? rules[field] : [rules[field]];
    const value = data[field];

    for (const rule of fieldRules) {
      const result = rule.validate(value, data);
      if (!result) {
        errors[field] = rule.message;
        isValid = false;
        break;
      }
    }
  });

  return { isValid, errors };
};

// Validation Rule Factory
export const required = (message = 'This field is required') => ({
  validate: isRequired,
  message,
});

export const email = (message = 'Invalid email address') => ({
  validate: isEmail,
  message,
});

export const phone = (message = 'Invalid phone number') => ({
  validate: isPhone,
  message,
});

export const minLength = (min, message) => ({
  validate: (value) => isMinLength(value, min),
  message: message || `Minimum ${min} characters required`,
});

export const maxLength = (max, message) => ({
  validate: (value) => isMaxLength(value, max),
  message: message || `Maximum ${max} characters allowed`,
});

export const minValue = (min, message) => ({
  validate: (value) => isMinValue(value, min),
  message: message || `Value must be at least ${min}`,
});

export const maxValue = (max, message) => ({
  validate: (value) => isMaxValue(value, max),
  message: message || `Value must be at most ${max}`,
});

export const pattern = (regex, message) => ({
  validate: (value) => !value || regex.test(value),
  message,
});
