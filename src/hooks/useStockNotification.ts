import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProducts } from './useProducts';
import { StockNotification, Product } from '../types';

const STORAGE_KEY = 'siprems-stock-notifications';
const NOTIFICATION_COOLDOWN_HOURS = 24;

// Threshold defaults
const DEFAULT_REORDER_POINT = 100;
const CRITICAL_THRESHOLD_MULTIPLIER = 0.5;
const MIN_CRITICAL_STOCK = 10;

interface NotificationState {
    notifications: StockNotification[];
    lastChecked: Record<string, string>; // productId -> timestamp
}

function getStoredState(): NotificationState {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to parse notification state:', e);
    }
    return { notifications: [], lastChecked: {} };
}

function saveState(state: NotificationState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save notification state:', e);
    }
}

function isWithinCooldown(lastCheckedTime: string | undefined): boolean {
    if (!lastCheckedTime) return false;
    const lastChecked = new Date(lastCheckedTime).getTime();
    const now = Date.now();
    const cooldownMs = NOTIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000;
    return now - lastChecked < cooldownMs;
}

function determineSeverity(stock: number, reorderPoint: number): 'warning' | 'critical' | null {
    const criticalThreshold = reorderPoint * CRITICAL_THRESHOLD_MULTIPLIER;

    if (stock < criticalThreshold || stock < MIN_CRITICAL_STOCK) {
        return 'critical';
    } else if (stock < reorderPoint) {
        return 'warning';
    }
    return null;
}

export function useStockNotification() {
    const { data: products = [], isLoading } = useProducts();
    const [state, setState] = useState<NotificationState>(getStoredState);

    // Generate notifications based on current product stock
    const generateNotifications = useCallback((productList: Product[]) => {
        setState(prevState => {
            const newNotifications: StockNotification[] = [...prevState.notifications];
            const newLastChecked: Record<string, string> = { ...prevState.lastChecked };
            let hasChanges = false;

            productList.forEach(product => {
                const reorderPoint = (product as any).reorder_point || DEFAULT_REORDER_POINT;
                const severity = determineSeverity(product.stock, reorderPoint);

                if (severity) {
                    // Check if we already have an unread notification for this product
                    const existingUnread = newNotifications.find(
                        n => n.productId === product.id && !n.isRead
                    );

                    // Check cooldown
                    if (!existingUnread && !isWithinCooldown(newLastChecked[product.id])) {
                        const notification: StockNotification = {
                            id: `notif-${product.id}-${Date.now()}`,
                            productId: product.id,
                            productName: product.name,
                            currentStock: product.stock,
                            threshold: reorderPoint,
                            severity,
                            createdAt: new Date().toISOString(),
                            isRead: false,
                        };
                        newNotifications.unshift(notification);
                        newLastChecked[product.id] = new Date().toISOString();
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                // Keep only last 50 notifications
                const trimmedNotifications = newNotifications.slice(0, 50);
                const newState = { notifications: trimmedNotifications, lastChecked: newLastChecked };
                saveState(newState);
                return newState;
            }

            return prevState;
        });
    }, []);

    // Check for low stock products when products data changes
    useEffect(() => {
        if (!isLoading && products.length > 0) {
            generateNotifications(products);
        }
    }, [products, isLoading, generateNotifications]);

    // Mark notification as read
    const markAsRead = useCallback((notificationId: string) => {
        setState(prevState => {
            const newNotifications = prevState.notifications.map(n =>
                n.id === notificationId ? { ...n, isRead: true } : n
            );
            const newState = { ...prevState, notifications: newNotifications };
            saveState(newState);
            return newState;
        });
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(() => {
        setState(prevState => {
            const newNotifications = prevState.notifications.map(n => ({ ...n, isRead: true }));
            const newState = { ...prevState, notifications: newNotifications };
            saveState(newState);
            return newState;
        });
    }, []);

    // Clear all notifications
    const clearAll = useCallback(() => {
        const newState = { notifications: [], lastChecked: {} };
        saveState(newState);
        setState(newState);
    }, []);

    // Computed values
    const unreadCount = useMemo(() =>
        state.notifications.filter(n => !n.isRead).length,
        [state.notifications]
    );

    const criticalCount = useMemo(() =>
        state.notifications.filter(n => !n.isRead && n.severity === 'critical').length,
        [state.notifications]
    );

    return {
        notifications: state.notifications,
        unreadCount,
        criticalCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        isLoading,
    };
}
