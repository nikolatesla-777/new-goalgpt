/**
 * Komuta Merkezi (Command Center) Dashboard
 * Main analytics dashboard for GoalGPT
 */

import { useState, useEffect } from 'react';
import './admin.css';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || '';

interface DashboardStats {
    financial: {
        totalRevenue: number;
        revenueChange: number;
        activeSubscribers: number;
        subscribersChange: number;
        salesCount: number;
        salesChange: number;
        billingErrors: number;
        errorsChange: number;
    };
    acquisition: {
        newSignups: number;
        signupsChange: number;
        trials: number;
        trialsChange: number;
        firstPurchase: number;
        firstPurchaseChange: number;
        conversionRate: number;
        conversionChange: number;
    };
    retention: {
        cancellations: number;
        cancellationsChange: number;
        churnRate: number;
        churnChange: number;
        totalMembers: number;
        membersChange: number;
    };
}

type PeriodFilter = 'today' | 'week' | 'month' | 'year';

const periodLabels: Record<PeriodFilter, string> = {
    today: 'Bugün',
    week: 'Bu Hafta',
    month: 'Bu Ay',
    year: 'Bu Yıl',
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

const ConversionIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />
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

const TotalMembersIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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

interface StatCardProps {
    icon: React.ReactNode;
    iconColor: 'teal' | 'green' | 'amber' | 'red' | 'blue' | 'purple';
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
}

function StatCard({ icon, iconColor, label, value, change, changeLabel }: StatCardProps) {
    const isPositive = change !== undefined && change >= 0;

    return (
        <div className="admin-stat-card">
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
            {changeLabel && (
                <div className="admin-stat-sublabel">{changeLabel}</div>
            )}
        </div>
    );
}

export function AdminKomutaMerkezi() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodFilter>('month');

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE}/api/admin/dashboard/stats?period=${period}`);
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
                                <StatCard
                                    icon={<RevenueIcon />}
                                    iconColor="teal"
                                    label="TOPLAM GELİR"
                                    value={formatCurrency(stats.financial.totalRevenue)}
                                    change={stats.financial.revenueChange}
                                />
                                <StatCard
                                    icon={<SubscribersIcon />}
                                    iconColor="green"
                                    label="AKTİF ABONELER"
                                    value={formatNumber(stats.financial.activeSubscribers)}
                                    change={stats.financial.subscribersChange}
                                />
                                <StatCard
                                    icon={<SalesIcon />}
                                    iconColor="blue"
                                    label="SATIŞ ADEDİ"
                                    value={formatNumber(stats.financial.salesCount)}
                                    change={stats.financial.salesChange}
                                />
                                <StatCard
                                    icon={<ErrorIcon />}
                                    iconColor="red"
                                    label="FATURA HATASI"
                                    value={formatNumber(stats.financial.billingErrors)}
                                    change={stats.financial.errorsChange}
                                />
                            </div>
                        </div>

                        {/* Acquisition Section */}
                        <div className="admin-section">
                            <h2 className="admin-section-title">
                                <span className="admin-section-dot blue"></span>
                                Edinim & Büyüme
                            </h2>
                            <div className="admin-stats-grid">
                                <StatCard
                                    icon={<NewUserIcon />}
                                    iconColor="teal"
                                    label="YENİ KAYIT"
                                    value={formatNumber(stats.acquisition.newSignups)}
                                    change={stats.acquisition.signupsChange}
                                />
                                <StatCard
                                    icon={<TrialIcon />}
                                    iconColor="purple"
                                    label="DENEME"
                                    value={formatNumber(stats.acquisition.trials)}
                                    change={stats.acquisition.trialsChange}
                                />
                                <StatCard
                                    icon={<SalesIcon />}
                                    iconColor="green"
                                    label="İLK SATIŞ"
                                    value={formatNumber(stats.acquisition.firstPurchase)}
                                    change={stats.acquisition.firstPurchaseChange}
                                />
                                <StatCard
                                    icon={<ConversionIcon />}
                                    iconColor="blue"
                                    label="DÖNÜŞÜM"
                                    value={`${stats.acquisition.conversionRate}%`}
                                    change={stats.acquisition.conversionChange}
                                />
                            </div>
                        </div>

                        {/* Retention Section */}
                        <div className="admin-section">
                            <h2 className="admin-section-title">
                                <span className="admin-section-dot amber"></span>
                                Tutundurma & Kayıp
                            </h2>
                            <div className="admin-stats-grid">
                                <StatCard
                                    icon={<CancelIcon />}
                                    iconColor="amber"
                                    label="İPTALLER"
                                    value={formatNumber(stats.retention.cancellations)}
                                    change={stats.retention.cancellationsChange}
                                />
                                <StatCard
                                    icon={<ChurnIcon />}
                                    iconColor="red"
                                    label="CHURN"
                                    value={formatNumber(stats.retention.churnRate)}
                                    change={stats.retention.churnChange}
                                />
                                <StatCard
                                    icon={<TotalMembersIcon />}
                                    iconColor="teal"
                                    label="TOPLAM ÜYE"
                                    value={formatNumber(stats.retention.totalMembers)}
                                    change={stats.retention.membersChange}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
