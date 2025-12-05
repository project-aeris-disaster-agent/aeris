import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, Loader2, AlertCircle, Info } from 'lucide-react';
import { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'loading' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // Auto-dismiss after this many ms (0 = no auto-dismiss)
}

interface NotificationProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onDismiss }: NotificationProps) {
  const { id, type, message, duration = 5000 } = notification;

  useEffect(() => {
    if (duration > 0 && type !== 'loading') {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, type, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    loading: <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />,
    info: <Info className="w-5 h-5 text-cyan-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
  };

  const colors = {
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    loading: 'border-cyan-500/30 bg-cyan-500/10',
    info: 'border-cyan-500/30 bg-cyan-500/10',
    warning: 'border-yellow-500/30 bg-yellow-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl ${colors[type]} shadow-lg`}
    >
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <p className="flex-1 text-white/90 text-sm font-medium">{message}</p>
      {type !== 'loading' && (
        <button
          onClick={() => onDismiss(id)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4 text-white/60 hover:text-white/90" />
        </button>
      )}
    </motion.div>
  );
}

interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationItem
              notification={notification}
              onDismiss={onDismiss}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

