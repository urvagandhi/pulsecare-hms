import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  AlertTriangle,
  CreditCard,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/store/hooks';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';

export interface NotificationItem {
  _id?: string;
  id?: string;
  title: string;
  message: string;
  timestamp?: string;
  createdAt?: string;
  type: 'appointment' | 'inventory' | 'billing' | 'system';
  read: boolean;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function NotificationDropdown() {
  const user = useAppSelector((s) => s.auth.user);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from Backend DB (MongoDB)
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await api.get<{ data: NotificationItem[] }>('/notifications');
      if (Array.isArray(data?.data)) {
        setNotifications(data.data);
      }
    } catch {
      // Offline fallback: load from localStorage if available
      try {
        const cached = localStorage.getItem(`pulsecare_notifs_${user._id}`);
        if (cached) setNotifications(JSON.parse(cached));
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?._id]);

  // Sync to local cache
  useEffect(() => {
    if (user?._id && notifications.length > 0) {
      try {
        localStorage.setItem(`pulsecare_notifs_${user._id}`, JSON.stringify(notifications));
      } catch {
        // ignore
      }
    }
  }, [notifications, user?._id]);

  // Click outside and ESC key listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Real-time multi-device Socket.io listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Cross-device sync: another device marked as read
    const handleUpdated = (payload: { id: string; read: boolean }) => {
      setNotifications((prev) =>
        prev.map((n) => ((n._id || n.id) === payload.id ? { ...n, read: payload.read } : n))
      );
    };

    // Cross-device sync: all read
    const handleAllRead = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    // Cross-device sync: deleted
    const handleDeleted = (payload: { id: string }) => {
      setNotifications((prev) => prev.filter((n) => (n._id || n.id) !== payload.id));
    };

    // Cross-device sync: cleared
    const handleCleared = () => {
      setNotifications([]);
    };

    // New real-time clinical notifications
    const handleNewAppointment = (data: any) => {
      const item: NotificationItem = {
        _id: `temp-${Date.now()}`,
        title: 'Appointment Alert',
        message: data?.reason || `Appointment status updated to ${data?.status || 'changed'}.`,
        createdAt: new Date().toISOString(),
        type: 'appointment',
        read: false,
      };
      setNotifications((prev) => [item, ...prev]);
    };

    const handleNewInventory = (data: any) => {
      const item: NotificationItem = {
        _id: `temp-${Date.now()}`,
        title: 'Inventory Alert',
        message: data?.name ? `${data.name} is running low on stock!` : 'Item stock alert triggered.',
        createdAt: new Date().toISOString(),
        type: 'inventory',
        read: false,
      };
      setNotifications((prev) => [item, ...prev]);
    };

    socket.on('notification:updated', handleUpdated);
    socket.on('notification:all-read', handleAllRead);
    socket.on('notification:deleted', handleDeleted);
    socket.on('notification:cleared', handleCleared);
    socket.on('appointment:statusChanged', handleNewAppointment);
    socket.on('inventory:low-stock', handleNewInventory);
    socket.on('pharmacy:low-stock', handleNewInventory);

    return () => {
      socket.off('notification:updated', handleUpdated);
      socket.off('notification:all-read', handleAllRead);
      socket.off('notification:deleted', handleDeleted);
      socket.off('notification:cleared', handleCleared);
      socket.off('appointment:statusChanged', handleNewAppointment);
      socket.off('inventory:low-stock', handleNewInventory);
      socket.off('pharmacy:low-stock', handleNewInventory);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id?: string) => {
    if (!id) return;
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => ((n._id || n.id) === id ? { ...n, read: true } : n))
    );
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // gracefully keep optimistic state
    }
  };

  const deleteNotification = async (id?: string) => {
    if (!id) return;
    // Optimistic UI update
    setNotifications((prev) => prev.filter((n) => (n._id || n.id) !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch {
      // gracefully keep optimistic state
    }
  };

  const markAllAsRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.patch('/notifications/read-all');
    } catch {
      // gracefully keep optimistic state
    }
  };

  const clearAll = async () => {
    // Optimistic UI update
    setNotifications([]);
    try {
      await api.delete('/notifications');
    } catch {
      // gracefully keep optimistic state
    }
  };

  const displayedNotifications =
    filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'appointment':
        return <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'inventory':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'billing':
        return <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Info className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        aria-expanded={isOpen}
        className={`relative rounded-full text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors ${
          isOpen ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : ''
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 min-w-4 h-4 px-1 p-0 flex items-center justify-center text-[9px] bg-emerald-600 hover:bg-emerald-600 text-white font-bold rounded-full border-2 border-white dark:border-slate-900 shadow-sm animate-in fade-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Floating Dropdown Panel - 100% Solid Opaque */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10 z-50 overflow-hidden flex flex-col max-h-[520px]"
          style={{ opacity: 1 }}
        >
          {/* Header with Solid Background */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Notifications
              </h3>
              {unreadCount > 0 ? (
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">All read</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1 rounded-md hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  title="Clear all notifications"
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills with Solid Background */}
          {notifications.length > 0 && (
            <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  filter === 'unread'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Unread ({unreadCount})
              </button>
              {loading && <Loader2 className="w-3 h-3 text-emerald-600 animate-spin ml-auto" />}
            </div>
          )}

          {/* Notification Items List with Solid Opaque Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[360px] bg-white dark:bg-slate-900 scrollbar-thin">
            {displayedNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2 bg-white dark:bg-slate-900">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <BellOff className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  {filter === 'unread'
                    ? "You've read all your clinical updates."
                    : 'All notifications have been cleared.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const notifId = notif._id || notif.id;
                return (
                  <div
                    key={notifId}
                    onClick={() => markAsRead(notifId)}
                    className={`p-3.5 flex items-start gap-3 transition-colors group cursor-pointer ${
                      !notif.read
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/80'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {/* Category icon */}
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      {renderIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            !notif.read
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-semibold text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatTimeAgo(notif.createdAt || notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                        {notif.message}
                      </p>
                    </div>

                    {/* Actions (Mark Read / Delete) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notifId);
                          }}
                          title="Mark as read"
                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notifId);
                        }}
                        title="Delete notification"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Unread green dot */}
                    {!notif.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
