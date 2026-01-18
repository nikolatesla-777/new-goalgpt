/**
 * AITab (Livescore)
 *
 * Displays matches with AI predictions
 * Uses LivescoreContext for data
 *
 * NOTE: This is SEPARATE from /ai-predictions page
 * /ai-predictions uses AIPredictionsContext (UNTOUCHED)
 * This tab uses LivescoreContext
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLivescore } from '../../../context/LivescoreContext';
import { MatchList } from '../../MatchList';
import { Robot, Trophy, XCircle, Clock, Star } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export function AITab() {
  const { aiMatches, predictions, lastSettlement, isLoading, error } = useLivescore();
  const navigate = useNavigate();

  // Show toast on settlement
  useEffect(() => {
    if (lastSettlement) {
      const isWin = lastSettlement.result === 'won';
      const message = `${lastSettlement.botName}: ${lastSettlement.homeTeam} vs ${lastSettlement.awayTeam} - ${isWin ? 'KAZANDI!' : 'Kaybetti'}`;

      if (isWin) {
        toast.success(message, {
          icon: '&#127942;',
          duration: 5000,
          style: {
            background: '#166534',
            color: '#fff',
          },
        });
      } else {
        toast.error(message, {
          icon: '&#10060;',
          duration: 3000,
          style: {
            background: '#991b1b',
            color: '#fff',
          },
        });
      }
    }
  }, [lastSettlement]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const total = predictions.length;
    const won = predictions.filter(p => p.result === 'won').length;
    const lost = predictions.filter(p => p.result === 'lost').length;
    const pending = predictions.filter(p => p.result === 'pending').length;
    const winRate = total > 0 ? ((won / (won + lost || 1)) * 100).toFixed(1) : '0';

    return { total, won, lost, pending, winRate };
  }, [predictions]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        gap: '16px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #334155',
          borderTop: '3px solid #f59e0b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#94a3b8' }}>AI tahminli maclar yukleniyor...</span>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}>
        <p style={{ marginBottom: '8px', fontWeight: '600' }}>Hata</p>
        <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {/* Total */}
        <div style={{
          padding: '16px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <Robot size={24} color="#94a3b8" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Toplam</div>
        </div>

        {/* Won */}
        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(34, 197, 94, 0.2)',
        }}>
          <Trophy size={24} color="#22c55e" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
            {stats.won}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>Kazanan</div>
        </div>

        {/* Lost */}
        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(239, 68, 68, 0.2)',
        }}>
          <XCircle size={24} color="#ef4444" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
            {stats.lost}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Kaybeden</div>
        </div>

        {/* Pending */}
        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}>
          <Clock size={24} color="#f59e0b" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Bekleyen</div>
        </div>

        {/* Win Rate */}
        <div style={{
          padding: '16px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <Star size={24} color="#fbbf24" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>
            %{stats.winRate}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Basari</div>
        </div>
      </div>

      {/* Link to full AI page */}
      <div style={{
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Robot size={18} color="#f59e0b" />
          <span style={{ color: '#fbbf24', fontWeight: '600' }}>
            {aiMatches.length} macta AI tahmini var
          </span>
        </div>
        <button
          onClick={() => navigate('/ai-predictions')}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f59e0b',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Tum Tahminler &rarr;
        </button>
      </div>

      {aiMatches.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#64748b',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            backgroundColor: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Robot size={32} color="#475569" />
          </div>
          <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px' }}>
            Bugun AI tahmini yok
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            AI tahminleri geldiginde burada gorunecek
          </p>
        </div>
      ) : (
        <MatchList
          view="ai"
          prefetchedMatches={aiMatches}
          skipInternalUpdates={true}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

export default AITab;
