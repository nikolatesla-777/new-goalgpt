/**
 * Member Detail Page
 * Detailed view of a single member's data
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './admin.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Types
interface MemberDetail {
    user: {
        id: string;
        email: string;
        fullName: string;
        phone: string;
        platform: string;
        createdAt: string;
        isVip: boolean;
        username: string;
    };
    ltv: {
        total: number;
        change: number;
        transactionCount: number;
    };
    subscription: {
        planName: string;
        status: string;
        expiresAt: string | null;
        startedAt: string | null;
        autoRenew: boolean;
        platform: string;
    } | null;
    segment: string;
    activity: {
        lastSeen: string | null;
        lastLoginIp: string | null;
        loginCount: number;
    };
    transactions: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        planName: string;
        platform: string;
        createdAt: string;
    }>;
    timeline: Array<{
        type: string;
        title: string;
        description: string;
        date: string;
        icon: string;
    }>;
    notes: Array<{
        type: 'warning' | 'info' | 'success';
        message: string;
    }>;
}

type TabType = 'overview' | 'financial' | 'activity' | 'security';

// Helper functions
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('tr-TR');
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Bilinmiyor';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    return `${diffDays} gün önce`;
}

function getSegmentLabel(segment: string): string {
    const labels: Record<string, string> = {
        'first_sale': 'İlk Satış',
        'active_subscriber': 'Aktif Abone',
        'trial': 'Deneme',
        'churned': 'İptal',
        'expired': 'Süresi Bitmiş',
        'new_user': 'Yeni Kullanıcı'
    };
    return labels[segment] || segment;
}

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        'active': 'Aktif',
        'trialing': 'Deneme',
        'trial': 'Deneme',
        'canceled': 'İptal',
        'expired': 'Süresi Bitmiş',
        'past_due': 'Ödeme Gecikmiş',
        'billing_error': 'Ödeme Hatası'
    };
    return labels[status] || status;
}

function getPlatformIcon(platform: string): string {
    if (platform === 'ios') return '🍎';
    if (platform === 'android') return '🤖';
    return '📱';
}

// Icons
const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);

const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

export default function MemberDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [member, setMember] = useState<MemberDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    useEffect(() => {
        async function fetchMember() {
            if (!id) return;

            try {
                setLoading(true);
                const response = await fetch(`${API_BASE}/admin/member/${id}`);
                const data = await response.json();

                if (data.success) {
                    setMember(data.data);
                } else {
                    setError(data.error || 'Failed to fetch member');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchMember();
    }, [id]);

    if (loading) {
        return (
            <div className="member-detail-page">
                <div className="admin-loading">
                    <div className="admin-spinner"></div>
                    <span>Üye bilgileri yükleniyor...</span>
                </div>
            </div>
        );
    }

    if (error || !member) {
        return (
            <div className="member-detail-page">
                <div className="admin-error-message">
                    <p>❌ {error || 'Üye bulunamadı'}</p>
                    <button onClick={() => navigate(-1)} className="admin-btn admin-btn-primary">
                        Geri Dön
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="member-detail-page">
            {/* Header */}
            <header className="member-header">
                <div className="member-header-left">
                    <button className="back-button" onClick={() => navigate(-1)}>
                        <BackIcon /> Geri Dön
                    </button>
                    <div className="member-info">
                        <div className="member-avatar">
                            {member.user.fullName?.charAt(0) || member.user.email?.charAt(0) || '?'}
                        </div>
                        <div className="member-info-text">
                            <h1>{member.user.fullName || member.user.username || 'Kullanıcı'}</h1>
                            <p className="member-email">{member.user.email}</p>
                            <div className="member-meta">
                                <span>{getPlatformIcon(member.user.platform)} {member.user.platform}</span>
                                <span>📞 {member.user.phone || '-'}</span>
                                <span>📅 {formatDate(member.user.createdAt)}</span>
                                {member.user.isVip && <span className="vip-badge">⭐ VIP</span>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="member-header-right">
                    <button className="admin-btn admin-btn-secondary">
                        <EditIcon /> Düzenle
                    </button>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="member-stats-grid">
                {/* LTV Card */}
                <div className="member-stat-card">
                    <div className="member-stat-icon teal">💰</div>
                    <div className="member-stat-content">
                        <div className="member-stat-label">LTV (Yaşam Boyu Değer)</div>
                        <div className="member-stat-value">{formatCurrency(member.ltv.total)}</div>
                        <div className="member-stat-meta">
                            {member.ltv.transactionCount} işlem
                            {member.ltv.change > 0 && <span className="positive">+{member.ltv.change}%</span>}
                        </div>
                    </div>
                </div>

                {/* Subscription Card */}
                <div className="member-stat-card">
                    <div className="member-stat-icon green">📦</div>
                    <div className="member-stat-content">
                        <div className="member-stat-label">Abonelik</div>
                        {member.subscription ? (
                            <>
                                <div className="member-stat-value">{member.subscription.planName}</div>
                                <div className="member-stat-meta">
                                    <span className={`status-badge ${member.subscription.status}`}>
                                        {getStatusLabel(member.subscription.status)}
                                    </span>
                                    {member.subscription.expiresAt && (
                                        <span>• {formatDate(member.subscription.expiresAt)}</span>
                                    )}
                                    {member.subscription.autoRenew && <span className="auto-renew">Otomatik</span>}
                                </div>
                            </>
                        ) : (
                            <div className="member-stat-value text-muted">Abonelik Yok</div>
                        )}
                    </div>
                </div>

                {/* Segment Card */}
                <div className="member-stat-card">
                    <div className="member-stat-icon purple">🏷️</div>
                    <div className="member-stat-content">
                        <div className="member-stat-label">Segmentasyon</div>
                        <div className="member-stat-value">{getSegmentLabel(member.segment)}</div>
                    </div>
                </div>

                {/* Activity Card */}
                <div className="member-stat-card">
                    <div className="member-stat-icon blue">📊</div>
                    <div className="member-stat-content">
                        <div className="member-stat-label">Aktivite</div>
                        <div className="member-stat-value">{timeAgo(member.activity.lastSeen)}</div>
                        <div className="member-stat-meta">
                            {member.activity.lastLoginIp && <span>IP: {member.activity.lastLoginIp}</span>}
                            <span>{member.activity.loginCount} giriş</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="member-tabs">
                <button
                    className={`member-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Genel Bakış
                </button>
                <button
                    className={`member-tab ${activeTab === 'financial' ? 'active' : ''}`}
                    onClick={() => setActiveTab('financial')}
                >
                    Finansal Geçmiş
                </button>
                <button
                    className={`member-tab ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    Aktivite & Loglar
                </button>
                <button
                    className={`member-tab ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => setActiveTab('security')}
                >
                    Güvenlik
                </button>
            </div>

            {/* Tab Content */}
            <div className="member-tab-content">
                {activeTab === 'overview' && (
                    <div className="member-overview">
                        {/* Notes/Warnings */}
                        {member.notes.length > 0 && (
                            <div className="member-notes">
                                <h3>📝 Hızlı Notlar</h3>
                                {member.notes.map((note, i) => (
                                    <div key={i} className={`member-note ${note.type}`}>
                                        {note.type === 'warning' && '⚠️ '}
                                        {note.type === 'success' && '✅ '}
                                        {note.type === 'info' && 'ℹ️ '}
                                        {note.message}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="member-timeline">
                            <h3>📅 Kullanıcı Yolculuğu</h3>
                            <div className="timeline">
                                {member.timeline.map((event, i) => (
                                    <div key={i} className="timeline-item">
                                        <div className="timeline-icon">{event.icon}</div>
                                        <div className="timeline-content">
                                            <div className="timeline-title">{event.title}</div>
                                            <div className="timeline-desc">{event.description}</div>
                                            <div className="timeline-date">{formatDateTime(event.date)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'financial' && (
                    <div className="member-financial">
                        <h3>💳 İşlem Geçmişi</h3>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Plan</th>
                                    <th>Tutar</th>
                                    <th>Platform</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {member.transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center text-muted">
                                            Henüz işlem yok
                                        </td>
                                    </tr>
                                ) : (
                                    member.transactions.map(tx => (
                                        <tr key={tx.id}>
                                            <td>{formatDateTime(tx.createdAt)}</td>
                                            <td>{tx.planName}</td>
                                            <td>{formatCurrency(tx.amount)}</td>
                                            <td>{getPlatformIcon(tx.platform)} {tx.platform}</td>
                                            <td>
                                                <span className={`status-badge ${tx.status}`}>
                                                    {getStatusLabel(tx.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="member-activity">
                        <h3>📊 Aktivite Logları</h3>
                        <p className="text-muted">
                            Son {member.activity.loginCount} giriş kaydı
                        </p>
                        {/* Activity logs would be fetched separately */}
                        <div className="activity-placeholder">
                            <p>Aktivite logları yükleniyor...</p>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="member-security">
                        <h3>🔒 Güvenlik Bilgileri</h3>
                        <div className="security-info">
                            <div className="security-row">
                                <span>Son Giriş IP:</span>
                                <span>{member.activity.lastLoginIp || '-'}</span>
                            </div>
                            <div className="security-row">
                                <span>Son Görülme:</span>
                                <span>{timeAgo(member.activity.lastSeen)}</span>
                            </div>
                            <div className="security-row">
                                <span>Platform:</span>
                                <span>{getPlatformIcon(member.user.platform)} {member.user.platform}</span>
                            </div>
                            <div className="security-row">
                                <span>VIP Durumu:</span>
                                <span>{member.user.isVip ? '⭐ VIP' : 'Normal'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
