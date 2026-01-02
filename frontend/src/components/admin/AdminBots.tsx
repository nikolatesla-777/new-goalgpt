/**
 * Admin Bot Rules Page
 * Manage bot assignment rules based on minute
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css';

interface BotRule {
    id: string;
    bot_group_id: string | null;
    bot_display_name: string;
    minute_from: number | null;
    minute_to: number | null;
    prediction_type_pattern: string | null;
    priority: number;
    is_active: boolean;
    created_at: string;
}

// API endpoint for future use when backend endpoint is ready
// const API_BASE = import.meta.env.VITE_API_URL || '';

export function AdminBots() {
    const navigate = useNavigate();
    const [rules, setRules] = useState<BotRule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            // For now, we'll display static rules since we don't have an endpoint yet
            // This will be connected to the database later
            setRules([
                {
                    id: '1',
                    bot_group_id: null,
                    bot_display_name: 'ALERT: D',
                    minute_from: 1,
                    minute_to: 15,
                    prediction_type_pattern: null,
                    priority: 10,
                    is_active: true,
                    created_at: new Date().toISOString()
                },
                {
                    id: '2',
                    bot_group_id: null,
                    bot_display_name: '70. Dakika Botu',
                    minute_from: 65,
                    minute_to: 75,
                    prediction_type_pattern: null,
                    priority: 20,
                    is_active: true,
                    created_at: new Date().toISOString()
                },
                {
                    id: '3',
                    bot_group_id: null,
                    bot_display_name: 'BOT 007',
                    minute_from: 0,
                    minute_to: 90,
                    prediction_type_pattern: null,
                    priority: 1,
                    is_active: true,
                    created_at: new Date().toISOString()
                }
            ]);
        } catch (err) {
            console.error('Fetch rules error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">Bot Kuralları</h1>
                    <p className="admin-header-subtitle">Dakikaya göre tahmin gruplandırma kuralları</p>
                </div>
                <button className="admin-btn admin-btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Yeni Kural
                </button>
            </header>

            <div className="admin-content">
                {/* Info Box */}
                <div style={{
                    backgroundColor: 'var(--admin-accent-light)',
                    border: '1px solid var(--admin-accent)',
                    borderRadius: 'var(--admin-radius-lg)',
                    padding: '20px 24px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--admin-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)', marginBottom: '4px' }}>
                            Nasıl Çalışır?
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
                            Gelen her tahmin, <strong>dakika bilgisine</strong> göre bir bot grubuna atanır.
                            Öncelik (priority) değeri yüksek olan kural önce değerlendirilir.
                            Örneğin, 10. dakikada gelen tahmin önce "ALERT: D" kuralına (priority: 10) bakar.
                        </div>
                    </div>
                </div>

                {/* Rules Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px', gridColumn: '1 / -1' }}>
                            <div className="admin-spinner" />
                        </div>
                    ) : (
                        rules.sort((a, b) => b.priority - a.priority).map((rule) => (
                            <div
                                key={rule.id}
                                className="admin-stat-card"
                                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                                onClick={() => navigate(`/admin/bots/${encodeURIComponent(rule.bot_display_name)}`)}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                            >
                                {/* Card Header */}
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid var(--admin-border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: 'var(--admin-radius-md)',
                                            background: 'linear-gradient(135deg, var(--admin-accent), #0D9488)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                <path d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--admin-text-primary)' }}>
                                                {rule.bot_display_name}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                                Priority: {rule.priority}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`admin-badge ${rule.is_active ? 'success' : 'neutral'}`}>
                                        {rule.is_active ? 'Aktif' : 'Pasif'}
                                    </span>
                                </div>

                                {/* Card Body */}
                                <div style={{ padding: '20px 24px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                                                Dakika Aralığı
                                            </div>
                                            <div style={{ fontWeight: 600, fontSize: '18px', color: 'var(--admin-text-primary)' }}>
                                                {rule.minute_from}' - {rule.minute_to}'
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                                                Tahmin Tipi
                                            </div>
                                            <div style={{ fontWeight: 500, color: 'var(--admin-text-secondary)' }}>
                                                {rule.prediction_type_pattern || 'Tümü'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <div style={{
                                    padding: '12px 24px',
                                    borderTop: '1px solid var(--admin-border-light)',
                                    backgroundColor: 'var(--admin-bg-hover)',
                                    display: 'flex',
                                    gap: '8px'
                                }}>
                                    <button className="admin-btn admin-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Düzenle
                                    </button>
                                    <button className="admin-btn admin-btn-secondary" style={{ color: 'var(--admin-error)' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
