import React from 'react';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'danger' | 'warning' | 'info';
  pulse?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: {
    minWidth: '12px',
    height: '12px',
    fontSize: '7px',
    padding: '0 2px',
  },
  md: {
    minWidth: '14px',
    height: '14px',
    fontSize: '8px',
    padding: '0 2px',
  },
  lg: {
    minWidth: '18px',
    height: '18px',
    fontSize: '10px',
    padding: '0 3px',
  },
};

const variantColors = {
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

/**
 * A reusable notification badge component that displays a count.
 * Can be used with any icon or button to show notification counts.
 */
export function NotificationBadge({
  count,
  maxCount = 99,
  size = 'md',
  variant = 'danger',
  pulse = true,
  className = '',
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();
  const sizeStyle = sizeStyles[size];
  const backgroundColor = variantColors[variant];

  return (
    <>
      <style>{`
        @keyframes notificationBadgePulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 ${backgroundColor}b3;
          }
          50% { 
            transform: scale(1.1);
            box-shadow: 0 0 0 4px ${backgroundColor}00;
          }
        }
        .notification-badge-animate {
          animation: notificationBadgePulse 2s infinite;
        }
      `}</style>
      <span
        className={`${pulse ? 'notification-badge-animate' : ''} flex items-center justify-center font-bold text-white rounded-full ${className}`}
        style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          ...sizeStyle,
          backgroundColor,
          zIndex: 10,
        }}
      >
        {displayCount}
      </span>
    </>
  );
}

export default NotificationBadge;
