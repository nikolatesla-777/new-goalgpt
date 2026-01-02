/**
 * Admin Logs Page
 * Shows all incoming API requests for debugging
 * Premium responsive design
 */

import { useEffect, useState } from 'react';
import './admin.css';

interface RequestLog {
    id: string;
    request_id: string;
    source_ip: string;
    user_agent: string;
    http_method: string;
    endpoint: string;
    request_body: any;
    response_status: number;
    response_body: any;
    success: boolean;
    error_message: string | null;
    processing_time_ms: number;
    created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AdminLogs() {
    const [logs, setLogs] = useState<RequestLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 15000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchLogs = async () => {
        try {
            let url = `${API_BASE}/predictions/requests?limit=100`;
            if (filter === 'success') {
                url += '&success=true';
            } else if (filter === 'failed') {
                url += '&success=false';
            }

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.requests || []);
            }
        } catch (err) {
            console.error('Fetch logs error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    };

    const getStatusBadge = (status: number, success: boolean) => {
        if (success) {
            return <span className="admin-badge success">{status}</span>;
        }
        return <span className="admin-badge error">{status}</span>;
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const successCount = logs.filter((l) => l.success).length;
    const failedCount = logs.filter((l) => !l.success).length;
    const avgTime = logs.length > 0
        ? Math.round(logs.reduce((sum, l) => sum + (l.processing_time_ms || 0), 0) / logs.length)
        : 0;
    const successRate = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0;

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">İstek Logları</h1>
                    <p className="admin-header-subtitle">AI tahmin sistemi gelen API istekleri</p>
                </div>
                <button className="admin-btn admin-btn-primary" onClick={fetchLogs}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                    Yenile
                </button>
            </header>

            <div className="admin-content">
                {/* Stats Grid - Responsive */}
                <div className="admin-stats-grid logs-stats" style={{ marginBottom: '24px' }}>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon blue">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    <path d="M9 12l2 2 4-4" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{logs.length}</div>
                        <div className="admin-stat-label">Toplam İstek</div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon green">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{successCount}</div>
                        <div className="admin-stat-label">Başarılı</div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon red">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{failedCount}</div>
                        <div className="admin-stat-label">Başarısız</div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon purple">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{avgTime}ms</div>
                        <div className="admin-stat-label">Ort. Süre</div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-card-header">
                            <div className="admin-stat-icon teal">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                            </div>
                        </div>
                        <div className="admin-stat-value">{successRate}%</div>
                        <div className="admin-stat-label">Başarı Oranı</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="admin-filter-row">
                    <div className="admin-filter-pills">
                        <button
                            className={`admin-filter-pill ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            Tümü ({logs.length})
                        </button>
                        <button
                            className={`admin-filter-pill ${filter === 'success' ? 'active' : ''}`}
                            onClick={() => setFilter('success')}
                        >
                            ✓ Başarılı
                        </button>
                        <button
                            className={`admin-filter-pill ${filter === 'failed' ? 'active' : ''}`}
                            onClick={() => setFilter('failed')}
                        >
                            ✗ Başarısız
                        </button>
                    </div>
                </div>

                {/* Logs List - Card based for better mobile */}
                <div className="admin-logs-container">
                    {loading ? (
                        <div className="admin-loading-state">
                            <div className="admin-spinner" />
                            <p>Loglar yükleniyor...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="admin-empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <h3>Henüz istek yok</h3>
                            <p>AI sisteminden istek bekleniyor</p>
                        </div>
                    ) : (
                        <div className="admin-logs-list">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`admin-log-card ${expandedId === log.id ? 'expanded' : ''} ${log.success ? 'success' : 'failed'}`}
                                >
                                    <div
                                        className="admin-log-card-header"
                                        onClick={() => toggleExpand(log.id)}
                                    >
                                        <div className="admin-log-main">
                                            <div className="admin-log-status">
                                                {log.success ? (
                                                    <span className="status-dot success"></span>
                                                ) : (
                                                    <span className="status-dot error"></span>
                                                )}
                                                {getStatusBadge(log.response_status, log.success)}
                                            </div>
                                            <div className="admin-log-info">
                                                <div className="admin-log-endpoint">{log.endpoint}</div>
                                                <div className="admin-log-meta">
                                                    <span className="admin-log-time">{formatTime(log.created_at)}</span>
                                                    <span className="admin-log-separator">•</span>
                                                    <span className="admin-log-ip">{log.source_ip}</span>
                                                    <span className="admin-log-separator">•</span>
                                                    <span className="admin-log-duration">{log.processing_time_ms}ms</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="admin-log-result">
                                            {log.success ? (
                                                <span className="admin-badge success">OK</span>
                                            ) : (
                                                <span className="admin-badge error" title={log.error_message || ''}>
                                                    {(log.error_message || 'Error').substring(0, 20)}
                                                    {(log.error_message || '').length > 20 ? '...' : ''}
                                                </span>
                                            )}
                                            <svg
                                                className="admin-log-chevron"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                style={{
                                                    transform: expandedId === log.id ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s ease'
                                                }}
                                            >
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </div>
                                    </div>

                                    {expandedId === log.id && (
                                        <div className="admin-log-card-body">
                                            <div className="admin-log-details-grid">
                                                <div className="admin-log-detail-section">
                                                    <div className="admin-log-detail-label">REQUEST BODY</div>
                                                    <pre className="admin-log-detail-code">
                                                        {JSON.stringify(log.request_body, null, 2)}
                                                    </pre>
                                                </div>
                                                <div className="admin-log-detail-section">
                                                    <div className="admin-log-detail-label">RESPONSE BODY</div>
                                                    <pre className="admin-log-detail-code">
                                                        {JSON.stringify(log.response_body, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                            {log.error_message && (
                                                <div className="admin-log-error-section">
                                                    <div className="admin-log-detail-label error">ERROR MESSAGE</div>
                                                    <div className="admin-log-error-content">
                                                        {log.error_message}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
