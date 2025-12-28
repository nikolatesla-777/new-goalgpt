/**
 * Admin Logs Page
 * Shows all incoming API requests for debugging
 */

import React, { useEffect, useState } from 'react';
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

const API_BASE = import.meta.env.VITE_API_URL || '';

export function AdminLogs() {
    const [logs, setLogs] = useState<RequestLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 15000); // Refresh every 15s
        return () => clearInterval(interval);
    }, [filter]);

    const fetchLogs = async () => {
        try {
            let url = `${API_BASE}/api/predictions/requests?limit=100`;
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

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">İstek Logları</h1>
                    <p className="admin-header-subtitle">Dış yapay zekadan gelen tüm API istekleri</p>
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
                {/* Stats */}
                <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                    <div className="admin-stat-card">
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
                        <div className="admin-stat-value">{avgTime}ms</div>
                        <div className="admin-stat-label">Ort. Süre</div>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ marginBottom: '24px' }}>
                    <div className="admin-filter-pills">
                        <button
                            className={`admin-filter-pill ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            Tümü
                        </button>
                        <button
                            className={`admin-filter-pill ${filter === 'success' ? 'active' : ''}`}
                            onClick={() => setFilter('success')}
                        >
                            Başarılı
                        </button>
                        <button
                            className={`admin-filter-pill ${filter === 'failed' ? 'active' : ''}`}
                            onClick={() => setFilter('failed')}
                        >
                            Başarısız
                        </button>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h3 className="admin-table-title">{logs.length} İstek</h3>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                            <div className="admin-spinner" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="admin-empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <h3>Henüz istek yok</h3>
                            <p>Dış yapay zekadan istek bekleniyor</p>
                        </div>
                    ) : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Zaman</th>
                                    <th>IP</th>
                                    <th>Endpoint</th>
                                    <th>Status</th>
                                    <th>Süre</th>
                                    <th>Sonuç</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <React.Fragment key={log.id}>
                                        <tr
                                            onClick={() => toggleExpand(log.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td>
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    style={{
                                                        transform: expandedId === log.id ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.15s ease'
                                                    }}
                                                >
                                                    <path d="M9 18l6-6-6-6" />
                                                </svg>
                                            </td>
                                            <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                                                {formatTime(log.created_at)}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                                                {log.source_ip}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--admin-accent)' }}>
                                                {log.endpoint}
                                            </td>
                                            <td>{getStatusBadge(log.response_status, log.success)}</td>
                                            <td style={{ color: 'var(--admin-text-secondary)' }}>
                                                {log.processing_time_ms}ms
                                            </td>
                                            <td>
                                                {log.success ? (
                                                    <span className="admin-badge success">OK</span>
                                                ) : (
                                                    <span className="admin-badge error">{log.error_message || 'Error'}</span>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedId === log.id && (
                                            <tr>
                                                <td colSpan={7} style={{ padding: 0 }}>
                                                    <div style={{
                                                        padding: '16px 24px',
                                                        backgroundColor: 'var(--admin-bg-hover)',
                                                        borderTop: '1px solid var(--admin-border)'
                                                    }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                                    Request Body
                                                                </div>
                                                                <pre style={{
                                                                    backgroundColor: 'var(--admin-sidebar-bg)',
                                                                    color: '#E5E7EB',
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '12px',
                                                                    overflow: 'auto',
                                                                    maxHeight: '200px',
                                                                    margin: 0
                                                                }}>
                                                                    {JSON.stringify(log.request_body, null, 2)}
                                                                </pre>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                                    Response Body
                                                                </div>
                                                                <pre style={{
                                                                    backgroundColor: 'var(--admin-sidebar-bg)',
                                                                    color: '#E5E7EB',
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '12px',
                                                                    overflow: 'auto',
                                                                    maxHeight: '200px',
                                                                    margin: 0
                                                                }}>
                                                                    {JSON.stringify(log.response_body, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                        {log.error_message && (
                                                            <div style={{ marginTop: '16px' }}>
                                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-error)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                                    Error Message
                                                                </div>
                                                                <div style={{
                                                                    backgroundColor: 'var(--admin-error-light)',
                                                                    color: 'var(--admin-error)',
                                                                    padding: '12px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '13px'
                                                                }}>
                                                                    {log.error_message}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}
