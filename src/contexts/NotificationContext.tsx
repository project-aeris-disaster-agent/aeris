import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Notification, NotificationType } from '@/components/Notification';
import { NotificationContainer } from '@/components/Notification';

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, duration?: number) => string;
  dismissNotification: (id: string) => void;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showLoading: (message: string) => string;
  showInfo: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (type: NotificationType, message: string, duration: number = 5000): string => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type,
        message,
        duration: type === 'loading' ? 0 : duration, // Loading notifications don't auto-dismiss
      };

      setNotifications((prev) => [...prev, notification]);
      return id;
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number) => showNotification('success', message, duration),
    [showNotification]
  );

  const showError = useCallback(
    (message: string, duration?: number) => showNotification('error', message, duration),
    [showNotification]
  );

  const showLoading = useCallback(
    (message: string) => showNotification('loading', message, 0),
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => showNotification('info', message, duration),
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => showNotification('warning', message, duration),
    [showNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        dismissNotification,
        showSuccess,
        showError,
        showLoading,
        showInfo,
        showWarning,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

