/**
 * Komuta Merkezi (Command Center) Dashboard
 * Main analytics dashboard for GoalGPT with drill-down feature
 */

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './admin.css';

// API base URL - should end with /api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Types
interface DashboardStats {
    financial: {
        totalRevenue: number;
        revenueChange: number;
        revenueIos: number;
        revenueAndroid: number;
        activeSubscribers: number;
        subscribersChange: number;
        subscribersIos: number;
        subscribersAndroid: number;
        salesCount: number;
        salesChange: number;
        salesIos: number;
        salesAndroid: number;
        billingErrors: number;
        errorsChange: number;
        errorsIos: number;
        errorsAndroid: number;
    };
    acquisition: {
        newSignups: number;
        signupsChange: number;
        signupsIos: number;
        signupsAndroid: number;
        trials: number;
        trialsChange: number;
        trialsIos: number;
        trialsAndroid: number;
        firstPurchase: number;
        firstPurchaseChange: number;
        firstPurchaseIos: number;
        firstPurchaseAndroid: number;
        conversionRate: number;
        conversionChange: number;
        conversionIos: number;
        conversionAndroid: number;
    };
    retention: {
        cancellations: number;
        cancellationsChange: number;
        cancellationsIos: number;
        cancellationsAndroid: number;
        churnRate: number;
        churnChange: number;
        totalMembers: number;
        membersChange: number;
        membersIos: number;
        membersAndroid: number;
    };
}

interface TrendDataPoint {
    date: string;
    total: number;
    ios: number;
    android: number;
}

interface DetailItem {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    platform: string;
    plan_name?: string;
    amount?: number;
    status?: string;
    created_at?: string;
    started_at?: string;
    expired_at?: string;
    canceled_at?: string;
    days_remaining?: number;
    total_spent?: number;
    transaction_count?: number;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'year';
type CardType = 'revenue' | 'subscribers' | 'sales' | 'billing-errors' | 'signups' | 'trials' | 'cancellations' | 'churn' | 'first-purchase' | 'conversion' | 'total-members' | null;

const periodLabels: Record<PeriodFilter, string> = {
    today: 'Bugün',
    week: 'Bu Hafta',
    month: 'Bu Ay',
    year: 'Bu Yıl',
};

const cardConfig: Record<string, { label: string; trendTitle: string; tableTitle: string; tableDesc: string }> = {
    revenue: { label: 'TOPLAM GELİR', trendTitle: 'Toplam Gelir Trendi', tableTitle: 'Gelir Detayları', tableDesc: 'Seçili dönemde gerçekleşen tüm satın alma işlemleri' },
    subscribers: { label: 'AKTİF ABONELER', trendTitle: 'Aktif Aboneler Trendi', tableTitle: 'Aktif Aboneler', tableDesc: 'Şu an aktif aboneliği olan kullanıcılar' },
    sales: { label: 'SATIŞ ADEDİ', trendTitle: 'Satış Adedi Trendi', tableTitle: 'Satış Detayları', tableDesc: 'Seçili dönemde gerçekleşen satışlar' },
    'billing-errors': { label: 'FATURA HATASI', trendTitle: 'Fatura Hatası Trendi', tableTitle: 'Faturalandırma Hataları', tableDesc: 'Ödeme alınamayan kullanıcılar' },
    signups: { label: 'YENİ KAYIT', trendTitle: 'Yeni Kayıt Trendi', tableTitle: 'Yeni Kayıtlar', tableDesc: 'Son dönemde kayıt olan kullanıcılar' },
    trials: { label: 'DENEME', trendTitle: 'Deneme Trendi', tableTitle: 'Deneme Başlatanlar', tableDesc: 'Ücretsiz deneme dönemindeki kullanıcılar' },
    cancellations: { label: 'İPTALLER', trendTitle: 'İptaller Trendi', tableTitle: 'Gönüllü İptaller', tableDesc: 'Aboneliğini iptal eden kullanıcılar' },
    churn: { label: 'CHURN', trendTitle: 'Churn Trendi', tableTitle: 'Süresi Bitenler', tableDesc: 'Aboneliği sona eren kullanıcılar' },
    'first-purchase': { label: 'İLK SATIŞ', trendTitle: 'İlk Satış Trendi', tableTitle: 'İlk Satışlar', tableDesc: 'İlk kez satın alan kullanıcılar' },
    'conversion': { label: 'DÖNÜŞÜM', trendTitle: 'Dönüşüm Oranı Trendi', tableTitle: 'Dönüşüm Detayları', tableDesc: 'Kayıt olup satın alan kullanıcılar' },
    'total-members': { label: 'TOPLAM ÜYE', trendTitle: 'Toplam Üye Trendi', tableTitle: 'Tüm Üyeler', tableDesc: 'Sistemdeki tüm kayıtlı kullanıcılar' },
};

// Icons
const RevenueIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
);

const SubscribersIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const SalesIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
);

const ErrorIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    </svg>
);

const NewUserIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" />
    </svg>
);

const TrialIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
    </svg>
);

const CancelIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
);

const ChurnIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6" />
    </svg>
);

const WhatsAppIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('tr-TR').format(value);
}

// Removed unused formatDate function

function formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })} - ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Platform Badge Component
function PlatformBadge({ platform }: { platform: string }) {
    const isIOS = platform?.toLowerCase() === 'ios';
    const isAndroid = platform?.toLowerCase() === 'android' || platform?.toLowerCase() === 'google';

    return (
        <span className={`platform-badge ${isIOS ? 'ios' : isAndroid ? 'android' : 'web'}`}>
            {isIOS ? '🍎 iOS' : isAndroid ? '🤖 Android' : '🌐 Web'}
        </span>
    );
}

// Plan Badge Component  
function PlanBadge({ planName }: { planName?: string }) {
    if (!planName) return null;
    const isWeekly = planName.toLowerCase().includes('hafta') || planName.toLowerCase().includes('week');
    const isMonthly = planName.toLowerCase().includes('ay') || planName.toLowerCase().includes('month');
    const isYearly = planName.toLowerCase().includes('yıl') || planName.toLowerCase().includes('year');

    return (
        <span className={`plan-badge ${isWeekly ? 'weekly' : isMonthly ? 'monthly' : isYearly ? 'yearly' : ''}`}>
            {isWeekly ? 'Haftalık' : isMonthly ? 'Aylık' : isYearly ? 'Yıllık' : planName}
        </span>
    );
}

// Stat Card Component
interface StatCardProps {
    type: CardType;
    icon: React.ReactNode;
    iconColor: string;
    label: string;
    value: string | number;
    change?: number;
    iosValue?: number;
    androidValue?: number;
    isSelected?: boolean;
    onClick?: () => void;
}

function StatCard({ type: _type, icon, iconColor, label, value, change, iosValue, androidValue, isSelected, onClick }: StatCardProps) {
    const isPositive = change !== undefined && change >= 0;

    return (
        <div
            className={`admin-stat-card ${isSelected ? 'selected' : ''} clickable`}
            onClick={onClick}
        >
            <div className="admin-stat-card-header">
                <div className={`admin-stat-icon ${iconColor}`}>
                    {icon}
                </div>
                {change !== undefined && (
                    <span className={`admin-stat-change ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? '↑' : '↓'} {Math.abs(change)}%
                    </span>
                )}
            </div>
            <div className="admin-stat-label">{label}</div>
            <div className="admin-stat-value">{value}</div>
            {(iosValue !== undefined || androidValue !== undefined) && (
                <div className="admin-stat-breakdown">
                    <span className="ios-value">🍎 {formatNumber(iosValue || 0)}</span>
                    <span className="android-value">🤖 {formatNumber(androidValue || 0)}</span>
                </div>
            )}
        </div>
    );
}

// Trend Chart Component
function TrendChart({ data, title }: { data: TrendDataPoint[]; title: string }) {
    return (
        <div className="dashboard-chart-container">
            <h3 className="dashboard-chart-title">{title}</h3>
            <div className="dashboard-chart-legend">
                <span className="legend-item total">— Toplam</span>
                <span className="legend-item ios">— iOS</span>
                <span className="legend-item android">— Android</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][date.getMonth()]}`;
                        }}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString('tr-TR')}
                        formatter={(value) => formatNumber(value as number)}
                    />
                    <Line type="monotone" dataKey="total" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="ios" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="android" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// Detail Table Component
function DetailTable({ data, type, tableTitle, tableDesc }: { data: DetailItem[]; type: CardType; tableTitle: string; tableDesc: string }) {
    const handleWhatsApp = (phone: string) => {
        if (!phone) return;
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const handleExportExcel = () => {
        // TODO: Implement Excel export
        alert('Excel export özelliği yakında eklenecek');
    };

    return (
        <div className="dashboard-table-container">
            <div className="dashboard-table-header">
                <div>
                    <h3 className="dashboard-table-title">{tableTitle}</h3>
                    <p className="dashboard-table-desc">{tableDesc}</p>
                </div>
                <div className="dashboard-table-actions">
                    <button className="excel-export-btn" onClick={handleExportExcel}>
                        📥 Excel İndir
                    </button>
                    <span className="record-count">{data.length} kayıt</span>
                </div>
            </div>
            <div className="dashboard-table-scroll">
                <table className="dashboard-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>KULLANICI</th>
                            {type === 'signups' && <th>TELEFON</th>}
                            <th>PLATFORM</th>
                            {['revenue', 'subscribers', 'sales', 'trials'].includes(type as string) && <th>PAKET</th>}
                            {['revenue', 'sales'].includes(type as string) && <th>TUTAR</th>}
                            {['revenue', 'sales'].includes(type as string) && <th>İŞLEM ADETİ</th>}
                            {['subscribers', 'trials'].includes(type as string) && <th>KALAN GÜN</th>}
                            {type === 'subscribers' && <th>TOPLAM HARCAMA</th>}
                            {type === 'signups' && <th>KAYIT TARİHİ</th>}
                            {type === 'trials' && <th>BAŞLANGIÇ</th>}
                            {type === 'cancellations' && <th>İPTAL TARİHİ</th>}
                            {type === 'cancellations' && <th>BİTİŞE KALAN GÜN</th>}
                            {['churn', 'billing-errors'].includes(type as string) && <th>SON GİRİŞ</th>}
                            <th>İŞLEMLER</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => (
                            <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>
                                    <div className="user-cell">
                                        <div className="user-avatar">
                                            {(item.full_name || item.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="user-info">
                                            <span className="user-name">{item.full_name || 'İsimsiz'}</span>
                                            <span className="user-email">{item.email || '-'}</span>
                                        </div>
                                    </div>
                                </td>
                                {type === 'signups' && (
                                    <td>
                                        {item.phone ? (
                                            <button className="whatsapp-btn" onClick={() => handleWhatsApp(item.phone)}>
                                                <WhatsAppIcon /> {item.phone}
                                            </button>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                )}
                                <td><PlatformBadge platform={item.platform} /></td>
                                {['revenue', 'subscribers', 'sales', 'trials'].includes(type as string) && (
                                    <td><PlanBadge planName={item.plan_name} /></td>
                                )}
                                {['revenue', 'sales'].includes(type as string) && (
                                    <td className="amount-cell">{formatCurrency(item.amount || 0)}</td>
                                )}
                                {['revenue', 'sales'].includes(type as string) && (
                                    <td>{item.transaction_count || 0}</td>
                                )}
                                {['subscribers', 'trials'].includes(type as string) && (
                                    <td>{item.days_remaining || 0} gün</td>
                                )}
                                {type === 'subscribers' && (
                                    <td className="amount-cell">{formatCurrency(item.total_spent || 0)}</td>
                                )}
                                {type === 'signups' && <td>{formatDateTime(item.created_at || '')}</td>}
                                {type === 'trials' && <td>{formatDateTime(item.started_at || '')}</td>}
                                {type === 'cancellations' && <td>{formatDateTime(item.canceled_at || '')}</td>}
                                {type === 'cancellations' && <td>{item.days_remaining || 0} gün</td>}
                                {['churn', 'billing-errors'].includes(type as string) && <td>{formatDateTime(item.expired_at || '')}</td>}
                                <td>
                                    <button className="action-btn">⋮</button>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={10} className="empty-cell">Veri bulunamadı</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Main Dashboard Component
export function AdminKomutaMerkezi() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodFilter>('month');
    const [selectedCard, setSelectedCard] = useState<CardType>(null);
    const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
    const [detailData, setDetailData] = useState<DetailItem[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);

    // Fetch main stats
    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE}/admin/dashboard/stats?period=${period}`);
                const data = await response.json();
                if (data.success) {
                    setStats(data.data);
                } else {
                    setError(data.error || 'Failed to fetch stats');
                }
            } catch (err: any) {
                setError(err.message || 'Network error');
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [period]);

    // Fetch drill-down data when card is selected
    useEffect(() => {
        if (!selectedCard) {
            setTrendData([]);
            setDetailData([]);
            return;
        }

        async function fetchDrilldownData() {
            setDrilldownLoading(true);
            try {
                const [trendRes, detailRes] = await Promise.all([
                    fetch(`${API_BASE}/admin/dashboard/${selectedCard}/trend?period=${period}`),
                    fetch(`${API_BASE}/admin/dashboard/${selectedCard}/details?period=${period}&limit=100`)
                ]);

                const trendJson = await trendRes.json();
                const detailJson = await detailRes.json();

                if (trendJson.success) setTrendData(trendJson.data);
                if (detailJson.success) setDetailData(detailJson.data);
            } catch (err) {
                console.error('Error fetching drilldown data:', err);
            } finally {
                setDrilldownLoading(false);
            }
        }

        fetchDrilldownData();
    }, [selectedCard, period]);

    const handleCardClick = (type: CardType) => {
        setSelectedCard(type);
    };

    const handleBackClick = () => {
        setSelectedCard(null);
    };

    // Card definitions - all 11 cards in order
    const allCards = [
        // Finansal Sağlık (4 cards)
        { type: 'revenue' as CardType, icon: <RevenueIcon />, iconColor: 'teal', getValue: () => formatCurrency(stats?.financial.totalRevenue || 0), getChange: () => stats?.financial.revenueChange, getIosValue: () => stats?.financial.revenueIos || 0, getAndroidValue: () => stats?.financial.revenueAndroid || 0 },
        { type: 'subscribers' as CardType, icon: <SubscribersIcon />, iconColor: 'green', getValue: () => formatNumber(stats?.financial.activeSubscribers || 0), getChange: () => stats?.financial.subscribersChange, getIosValue: () => stats?.financial.subscribersIos || 0, getAndroidValue: () => stats?.financial.subscribersAndroid || 0 },
        { type: 'sales' as CardType, icon: <SalesIcon />, iconColor: 'blue', getValue: () => formatNumber(stats?.financial.salesCount || 0), getChange: () => stats?.financial.salesChange, getIosValue: () => stats?.financial.salesIos || 0, getAndroidValue: () => stats?.financial.salesAndroid || 0 },
        { type: 'billing-errors' as CardType, icon: <ErrorIcon />, iconColor: 'red', getValue: () => formatNumber(stats?.financial.billingErrors || 0), getChange: () => stats?.financial.errorsChange, getIosValue: () => stats?.financial.errorsIos || 0, getAndroidValue: () => stats?.financial.errorsAndroid || 0 },
        // Edinim & Büyüme (4 cards)
        { type: 'signups' as CardType, icon: <NewUserIcon />, iconColor: 'teal', getValue: () => formatNumber(stats?.acquisition.newSignups || 0), getChange: () => stats?.acquisition.signupsChange, getIosValue: () => stats?.acquisition.signupsIos || 0, getAndroidValue: () => stats?.acquisition.signupsAndroid || 0 },
        { type: 'trials' as CardType, icon: <TrialIcon />, iconColor: 'purple', getValue: () => formatNumber(stats?.acquisition.trials || 0), getChange: () => stats?.acquisition.trialsChange, getIosValue: () => stats?.acquisition.trialsIos || 0, getAndroidValue: () => stats?.acquisition.trialsAndroid || 0 },
        { type: 'first-purchase' as CardType, icon: <SalesIcon />, iconColor: 'green', getValue: () => formatNumber(stats?.acquisition.firstPurchase || 0), getChange: () => stats?.acquisition.firstPurchaseChange, getIosValue: () => stats?.acquisition.firstPurchaseIos || 0, getAndroidValue: () => stats?.acquisition.firstPurchaseAndroid || 0 },
        { type: 'conversion' as CardType, icon: <ChurnIcon />, iconColor: 'blue', getValue: () => `${stats?.acquisition.conversionRate || 0}%`, getChange: () => stats?.acquisition.conversionChange, getIosValue: () => stats?.acquisition.conversionIos || 0, getAndroidValue: () => stats?.acquisition.conversionAndroid || 0 },
        // Tutundurma & Kayıp (3 cards)
        { type: 'cancellations' as CardType, icon: <CancelIcon />, iconColor: 'amber', getValue: () => formatNumber(stats?.retention.cancellations || 0), getChange: () => stats?.retention.cancellationsChange, getIosValue: () => stats?.retention.cancellationsIos || 0, getAndroidValue: () => stats?.retention.cancellationsAndroid || 0 },
        { type: 'churn' as CardType, icon: <ChurnIcon />, iconColor: 'red', getValue: () => formatNumber(stats?.retention.churnRate || 0), getChange: () => stats?.retention.churnChange },
        { type: 'total-members' as CardType, icon: <SubscribersIcon />, iconColor: 'teal', getValue: () => formatNumber(stats?.retention.totalMembers || 0), getChange: () => stats?.retention.membersChange, getIosValue: () => stats?.retention.membersIos || 0, getAndroidValue: () => stats?.retention.membersAndroid || 0 },
    ];

    const financialCards = allCards.slice(0, 4);
    const acquisitionCards = allCards.slice(4, 8);  // Include first-purchase and conversion
    const retentionCards = allCards.slice(8, 11);   // cancellations, churn, total-members

    // Expanded View (Drill-down)
    if (selectedCard) {
        const config = cardConfig[selectedCard];
        return (
            <>
                <header className="admin-header">
                    <div className="admin-header-left">
                        <button className="back-button" onClick={handleBackClick}>
                            <BackIcon /> Panele Dön
                        </button>
                    </div>
                    <div className="admin-period-selector">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                            className="admin-select"
                        >
                            {Object.entries(periodLabels).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                </header>

                {/* Horizontal scrollable cards */}
                <div className="admin-cards-scroll-container">
                    <div className="admin-cards-scroll">
                        {allCards.map((card) => (
                            <StatCard
                                key={card.type}
                                type={card.type}
                                icon={card.icon}
                                iconColor={card.iconColor}
                                label={cardConfig[card.type!]?.label || ''}
                                value={card.getValue()}
                                change={card.getChange()}
                                iosValue={card.getIosValue?.()}
                                androidValue={card.getAndroidValue?.()}
                                isSelected={card.type === selectedCard}
                                onClick={() => handleCardClick(card.type)}
                            />
                        ))}
                    </div>
                </div>

                <div className="admin-content">
                    {drilldownLoading ? (
                        <div className="admin-loading">
                            <div className="admin-spinner"></div>
                            <span>Veriler yükleniyor...</span>
                        </div>
                    ) : (
                        <>
                            <TrendChart data={trendData} title={config.trendTitle} />
                            <DetailTable
                                data={detailData}
                                type={selectedCard}
                                tableTitle={config.tableTitle}
                                tableDesc={config.tableDesc}
                            />
                        </>
                    )}
                </div>
            </>
        );
    }

    // Collapsed View (Main Dashboard)
    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">Komuta Merkezi 🚀</h1>
                    <p className="admin-header-subtitle">Tüm uygulamanın anlık verileri ve finansal durumu</p>
                </div>
                <div className="admin-period-selector">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                        className="admin-select"
                    >
                        {Object.entries(periodLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="admin-content">
                {loading && (
                    <div className="admin-loading">
                        <div className="admin-spinner"></div>
                        <span>Veriler yükleniyor...</span>
                    </div>
                )}

                {error && (
                    <div className="admin-error-message">
                        <p>❌ {error}</p>
                        <button onClick={() => window.location.reload()} className="admin-btn admin-btn-primary">
                            Tekrar Dene
                        </button>
                    </div>
                )}

                {stats && !loading && (
                    <>
                        {/* Financial Health Section */}
                        <div className="admin-section">
                            <h2 className="admin-section-title">
                                <span className="admin-section-dot green"></span>
                                Finansal Sağlık
                            </h2>
                            <div className="admin-stats-grid">
                                {financialCards.map((card) => (
                                    <StatCard
                                        key={card.type}
                                        type={card.type}
                                        icon={card.icon}
                                        iconColor={card.iconColor}
                                        label={cardConfig[card.type!]?.label || ''}
                                        value={card.getValue()}
                                        change={card.getChange()}
                                        iosValue={card.getIosValue?.()}
                                        androidValue={card.getAndroidValue?.()}
                                        onClick={() => handleCardClick(card.type)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Acquisition Section */}
                        <div className="admin-section">
                            <h2 className="admin-section-title">
                                <span className="admin-section-dot blue"></span>
                                Edinim & Büyüme
                            </h2>
                            <div className="admin-stats-grid">
                                {acquisitionCards.map((card) => (
                                    <StatCard
                                        key={card.type}
                                        type={card.type}
                                        icon={card.icon}
                                        iconColor={card.iconColor}
                                        label={cardConfig[card.type!]?.label || ''}
                                        value={card.getValue()}
                                        change={card.getChange()}
                                        iosValue={card.getIosValue?.()}
                                        androidValue={card.getAndroidValue?.()}
                                        onClick={() => handleCardClick(card.type)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Retention Section */}
                        <div className="admin-section">
                            <h2 className="admin-section-title">
                                <span className="admin-section-dot amber"></span>
                                Tutundurma & Kayıp
                            </h2>
                            <div className="admin-stats-grid">
                                {retentionCards.map((card) => (
                                    <StatCard
                                        key={card.type}
                                        type={card.type}
                                        icon={card.icon}
                                        iconColor={card.iconColor}
                                        label={cardConfig[card.type!]?.label || ''}
                                        value={card.getValue()}
                                        change={card.getChange()}
                                        iosValue={card.getIosValue?.()}
                                        androidValue={card.getAndroidValue?.()}
                                        onClick={() => handleCardClick(card.type)}
                                    />
                                ))}
                            </div>
                        </div>

                    </>
                )}
            </div>
        </>
    );
}
