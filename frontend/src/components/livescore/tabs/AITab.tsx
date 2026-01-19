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
          border: '3px solid #cbd5e1',
          borderTop: '3px solid #f59e0b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#64748b' }}>AI tahminli maclar yukleniyor...</span>
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
          backgroundColor: '#f1f5f9',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
        }}>
          <Robot size={24} color="#64748b" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Toplam</div>
        </div>

        {/* Won */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f0fdf4',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #bbf7d0',
        }}>
          <Trophy size={24} color="#16a34a" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>
            {stats.won}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Kazanan</div>
        </div>

        {/* Lost */}
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #fecaca',
        }}>
          <XCircle size={24} color="#dc2626" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
            {stats.lost}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Kaybeden</div>
        </div>

        {/* Pending */}
        <div style={{
          padding: '16px',
          backgroundColor: '#fffbeb',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #fde68a',
        }}>
          <Clock size={24} color="#d97706" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d97706' }}>Bekleyen</div>
        </div>

        {/* Win Rate */}
        <div style={{
          padding: '16px',
          backgroundColor: '#fefce8',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid #fef08a',
        }}>
          <Star size={24} color="#ca8a04" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ca8a04' }}>
            %{stats.winRate}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#a16207' }}>Basari</div>
        </div>
      </div>

      {/* Link to full AI page */}
      <div style={{
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        border: '1px solid #fde68a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Robot size={18} color="#d97706" />
          <span style={{ color: '#92400e', fontWeight: '600' }}>
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
            backgroundColor: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Robot size={32} color="#64748b" />
          </div>
          <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px', color: '#334155' }}>
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
