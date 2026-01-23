import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './admin.css';

// Types
export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    time: string;
    isRead: boolean;
    link?: string;
}

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Icons
const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const CheckAllIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const InfoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

const SuccessIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const WarningIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);

const ErrorIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
);

// Sample Data
const SAMPLE_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        type: 'success',
        title: 'Ödeme Başarılı',
        message: 'Ahmet Yılmaz premium üyelik satın aldı.',
        time: '2 dakika önce',
        isRead: false,
    },
    {
        id: '2',
        type: 'warning',
        title: 'Yüksek Kaynak Kullanımı',
        message: 'Sunucu CPU kullanımı %85 seviyesine ulaştı.',
        time: '15 dakika önce',
        isRead: false,
    },
    {
        id: '3',
        type: 'error',
        title: 'API Hatası',
        message: 'Live score API bağlantısında kopma yaşandı.',
        time: '45 dakika önce',
        isRead: true,
    },
    {
        id: '4',
        type: 'info',
        title: 'Günlük Rapor Hazır',
        message: 'Dünkü işlemlerin raporu oluşturuldu.',
        time: '2 saat önce',
        isRead: true,
    },
    {
        id: '5',
        type: 'success',
        title: 'Yeni Kullanıcı',
        message: 'Mehmet Demir sisteme kayıt oldu.',
        time: '3 saat önce',
        isRead: true,
    }
];

export function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [notifications, setNotifications] = useState<Notification[]>(SAMPLE_NOTIFICATIONS);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const filteredNotifications = activeTab === 'all'
        ? notifications
        : notifications.filter(n => !n.isRead);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    };

    const markAsRead = (id: string) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, isRead: true } : n
        ));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <SuccessIcon />;
            case 'warning': return <WarningIcon />;
            case 'error': return <ErrorIcon />;
            default: return <InfoIcon />;
        }
    };

    // Use portal to render outside the current DOM hierarchy (avoids overflow:hidden issues)
    return createPortal(
        <>
            {isOpen && <div className="admin-notifications-overlay" />}
            <div
                ref={panelRef}
                className={`admin-notifications-panel ${isOpen ? 'open' : ''}`}
            >
                <div className="notifications-header">
                    <div className="notifications-title-row">
                        <h3>Bildirimler</h3>
                        <button className="close-btn" onClick={onClose}>
                            <CloseIcon />
                        </button>
                    </div>

                    <div className="notifications-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            Tümü
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
                            onClick={() => setActiveTab('unread')}
                        >
                            Okunmamış
                            {unreadCount > 0 && <span className="count-badge">{unreadCount}</span>}
                        </button>
                    </div>

                    {unreadCount > 0 && (
                        <button className="mark-read-btn" onClick={markAllRead}>
                            <CheckAllIcon /> Tümünü Okundu İşaretle
                        </button>
                    )}
                </div>

                <div className="notifications-list">
                    {filteredNotifications.length === 0 ? (
                        <div className="empty-notifications">
                            <div className="empty-icon">🔔</div>
                            <p>Bildirim bulunmuyor</p>
                            <span>{activeTab === 'unread' ? 'Okunmamış bildiriminiz yok.' : 'Henüz hiç bildirim almadınız.'}</span>
                        </div>
                    ) : (
                        filteredNotifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`notification-item ${!notification.isRead ? 'unread' : ''} ${notification.type}`}
                                onClick={() => markAsRead(notification.id)}
                            >
                                <div className="notification-icon">
                                    {getIcon(notification.type)}
                                </div>
                                <div className="notification-content">
                                    <h4 className="notification-title">{notification.title}</h4>
                                    <p className="notification-message">{notification.message}</p>
                                    <span className="notification-time">{notification.time}</span>
                                </div>
                                {!notification.isRead && <div className="unread-dot" />}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
