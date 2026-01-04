/**
 * Admin Manual Predictions Page
 * Allows admins to manually create predictions for live matches
 */

import { useEffect, useState } from 'react';
import './admin.css';

interface ManualPrediction {
    id: string;
    match_external_id: string;
    bot_name: string;
    league_name: string;
    home_team_name: string;
    away_team_name: string;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction_type: string;
    prediction_value: string;
    prediction_result: string | null;
    created_at: string;
    access_type?: 'VIP' | 'FREE';
    // Match Status
    match_status_id?: number;
    match_minute?: number;
}

interface LiveMatch {
    id: string; // uuid
    external_id: string;
    home_team_name: string;
    away_team_name: string;
    league_name?: string;
    competition_name?: string;
    competition?: {
        id: string;
        name: string;
        logo_url?: string;
    };
    home_score: number;
    away_score: number;
    minute: number;
    status_id: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AdminManualPredictions() {
    const [predictions, setPredictions] = useState<ManualPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form State
    const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);
    const [minute, setMinute] = useState<number>(0);
    const [accessType, setAccessType] = useState<'VIP' | 'FREE'>('VIP');
    const [predictionType, setPredictionType] = useState('IY 0.5 ÜST');
    const [customPrediction, setCustomPrediction] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchManualPredictions();
        fetchLiveMatches();
    }, []);

    const fetchManualPredictions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/predictions/manual`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setPredictions(data.predictions);
                }
            }
        } catch (err) {
            console.error('Error fetching manual predictions:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLiveMatches = async () => {
        try {
            // Using existing endpoint or a new one? 
            // We'll assume a new endpoint or use /matches/live if available.
            // For now let's assume /matches/live-simple that returns basic info for dropdown
            const res = await fetch(`${API_BASE}/matches/live`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data && data.data.results) {
                    setLiveMatches(data.data.results);
                }
            }
        } catch (err) {
            console.error('Error fetching live matches:', err);
        }
    };

    const handleMatchSelect = (matchId: string) => {
        const match = liveMatches.find(m => m.external_id === matchId);
        if (match) {
            setSelectedMatch(match);
            setMinute(match.minute); // Auto-fill minute
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMatch) return;

        setIsSubmitting(true);
        try {
            const finalPrediction = predictionType === 'OTHER' ? customPrediction : predictionType;

            const payload = {
                match_external_id: selectedMatch.external_id,
                home_team: selectedMatch.home_team_name,
                away_team: selectedMatch.away_team_name,
                league: selectedMatch.league_name || selectedMatch.competition?.name || selectedMatch.competition_name || '',
                score: `${selectedMatch.home_score}-${selectedMatch.away_score}`,
                minute: minute,
                prediction: finalPrediction, // For display
                prediction_type: finalPrediction,
                prediction_value: finalPrediction, // Simplified
                access_type: accessType,
                bot_name: 'Alert System'
            };

            const res = await fetch(`${API_BASE}/predictions/manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowCreateModal(false);
                fetchManualPredictions(); // Refresh list
                // Reset form
                setSelectedMatch(null);
                setMinute(0);
                setPredictionType('IY 0.5 ÜST');
            } else {
                alert('Tahmin oluşturulamadı!');
            }
        } catch (err) {
            console.error('Error creating prediction:', err);
            alert('Bir hata oluştu');
        } finally {
            setIsSubmitting(false);
        }
    };

    const commonTemplates = [
        'IY 0.5 ÜST',
        '+1 Gol - (0.5 ÜST)',
        'IY 1.5 ÜST',
        '+1 Gol - (1.5 ÜST)',
        'IY 2.5 ÜST',
        '+1 Gol - (2.5 ÜST)',
        'MS 1',
        'MS 2',
        'MS 0',
        'KG VAR',
        'KG YOK'
    ];

    return (
        <>
            <header className="admin-header">
                <div>
                    <h1 className="admin-header-title">Manuel Canlı Tekli Tahminler</h1>
                    <p className="admin-header-subtitle">Canlı maçlara manuel tahmin ekleyin ve yönetin</p>
                </div>
                <button className="admin-btn admin-btn-primary" onClick={() => setShowCreateModal(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 4v16m-8-8h16" />
                    </svg>
                    Yeni Oluştur
                </button>
            </header>

            <div className="admin-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div className="admin-search">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Takım adı, lig, tahmin..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Maç</th>
                                <th>Dakika</th>
                                <th>Tahmin</th>
                                <th>Erişim</th>
                                <th>Oluşturulma</th>
                                <th>Durum</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center" style={{ padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Yükleniyor...</td></tr>
                            ) : predictions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center" style={{ padding: '64px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--admin-text-muted)' }}>
                                                <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                            </svg>
                                            <p style={{ margin: 0, color: 'var(--admin-text-secondary)' }}>Henüz manuel tahmin yok.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                predictions
                                    .filter(p => !searchTerm ||
                                        p.home_team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        p.away_team_name.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map((p, idx) => (
                                        <tr key={p.id}>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <div className="match-cell">
                                                    <span className="league-hint">{p.league_name}</span>
                                                    <div className="teams">
                                                        {p.home_team_name} vs {p.away_team_name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="minute-badge">{p.minute_at_prediction}'</span>
                                            </td>
                                            <td>
                                                <span className="prediction-badge">{p.prediction_type}</span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${p.access_type === 'VIP' ? 'vip' : 'free'}`}>
                                                    {p.access_type || 'VIP'}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(p.created_at).toLocaleString('tr-TR')}
                                            </td>
                                            <td>
                                                <span className={`status-tag ${p.prediction_result || 'pending'}`}>
                                                    {p.prediction_result === 'winner' ? 'KAZANDI' :
                                                        p.prediction_result === 'loser' ? 'KAYBETTİ' : 'BEKLİYOR'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="actions">
                                                    <button className="icon-btn delete" title="Sil">
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content large">
                        <div className="modal-header">
                            <h2>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 4v16m-8-8h16" />
                                </svg>
                                Yeni Tahmin Oluştur
                                <span className="live-count">{liveMatches.length} canlı maç</span>
                            </h2>
                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Lig / Maç</label>
                                    <select
                                        className="admin-input"
                                        onChange={(e) => handleMatchSelect(e.target.value)}
                                        required
                                    >
                                        <option value="">Maç Seçiniz...</option>
                                        {liveMatches.map(m => (
                                            <option key={m.external_id} value={m.external_id}>
                                                {m.home_team_name} {m.home_score}-{m.away_score} {m.away_team_name} ({m.minute}') • {m.league_name || m.competition_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Dakika</label>
                                    <input
                                        type="number"
                                        className="admin-input"
                                        value={minute}
                                        onChange={(e) => setMinute(parseInt(e.target.value))}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Erişim Türü</label>
                                    <select
                                        className="admin-input"
                                        value={accessType}
                                        onChange={(e) => setAccessType(e.target.value as any)}
                                    >
                                        <option value="VIP">VIP</option>
                                        <option value="FREE">FREE</option>
                                    </select>
                                </div>

                                <div className="form-group full-width">
                                    <label>Tahmin Şablonu</label>
                                    <select
                                        className="admin-input"
                                        value={predictionType}
                                        onChange={(e) => setPredictionType(e.target.value)}
                                    >
                                        {commonTemplates.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                        <option value="OTHER">Diğer (Manuel Gir)</option>
                                    </select>
                                </div>

                                {predictionType === 'OTHER' && (
                                    <div className="form-group full-width">
                                        <label>Tahmin (Özel)</label>
                                        <input
                                            type="text"
                                            className="admin-input"
                                            placeholder="Örn: Ev Sahibi 1.5 Üst"
                                            value={customPrediction}
                                            onChange={(e) => setCustomPrediction(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowCreateModal(false)}>İptal</button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

