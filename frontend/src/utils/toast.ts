/**
 * Toast Notification Service
 * Simple toast service for user feedback
 * TODO: Replace with actual toast library (react-hot-toast, etc.)
 */

export const toast = {
  success: (message: string) => {
    console.log('✅', message);
    // TODO: Replace with actual toast library (react-hot-toast, etc.)
    alert(`✅ ${message}`);
  },
  error: (message: string, error?: unknown) => {
    console.error('❌', message, error);
    alert(`❌ ${message}`);
  },
  warning: (message: string) => {
    console.warn('⚠️', message);
    alert(`⚠️ ${message}`);
  }
};
