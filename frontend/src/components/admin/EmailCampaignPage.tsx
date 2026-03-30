/**
 * EmailCampaignPage — Re-engagement Email Campaign Manager
 *
 * Allows admins to:
 * 1. Select a user segment (inactive X days + plan filter)
 * 2. Preview how many users are in the segment
 * 3. Configure campaign name, subject, discount code
 * 4. Trigger the email campaign via Resend
 * 5. View past campaign history
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

type PlanFilter = 'all' | 'free' | 'vip_expired';
type CampaignStatus = 'pending' | 'sent' | 'partial' | 'failed';

interface CampaignLog {
  id: string;
  campaign_name: string;
  channel: string;
  segment_params: { inactiveDays: number; planFilter: PlanFilter };
  recipient_count: number;
  accepted_count: number | null;
  rejected_count: number | null;
  status: CampaignStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

// ============================================================================
// API HELPERS
// ============================================================================

function adminHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-admin-api-key': ADMIN_KEY,
  };
}

async function fetchSegmentPreview(
  inactiveDays: number,
  planFilter: PlanFilter
): Promise<{ count: number }> {
  const res = await fetch(
    `${API_BASE}/admin/email/segment-preview?inactiveDays=${inactiveDays}&planFilter=${planFilter}`,
    { headers: adminHeaders() }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function sendCampaign(body: {
  campaignName: string;
  inactiveDays: number;
  planFilter: PlanFilter;
  emailSubject: string;
  discountCode: string;
  adminUserId: string;
}): Promise<{ success: boolean; data: { accepted: number; rejected: number; recipientCount: number; error?: string } }> {
  const res = await fetch(`${API_BASE}/admin/email/send-campaign`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ ...body, channel: 'email' }),
  });
  const json = await res.json();
  return json;
}

async function fetchCampaignLogs(): Promise<CampaignLog[]> {
  const res = await fetch(`${API_BASE}/admin/email/campaign-logs?limit=20`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, { bg: string; text: string; label: string }> = {
    sent:    { bg: '#d1fae5', text: '#065f46', label: 'Gönderildi' },
    partial: { bg: '#fef3c7', text: '#92400e', label: 'Kısmi' },
    failed:  { bg: '#fee2e2', text: '#991b1b', label: 'Başarısız' },
    pending: { bg: '#e0e7ff', text: '#3730a3', label: 'Bekliyor' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{
      background: s.bg, color: s.text,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '24px 28px',
      marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      border: '1px solid #e5e7eb',
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#111827' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EmailCampaignPage() {
  // Segment state
  const [inactiveDays, setInactiveDays] = useState<number>(14);
  const [planFilter, setPlanFilter]   = useState<PlanFilter>('all');

  // Preview state
  const [previewCount, setPreviewCount]     = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]     = useState<string | null>(null);

  // Campaign form state
  const [campaignName, setCampaignName]   = useState('');
  const [emailSubject, setEmailSubject]   = useState('GoalGPT — Seni Özledik 🤖 Geri Dön, %30 İndirim Kazan!');
  const [discountCode, setDiscountCode]   = useState('GOBACK30');
  const [adminUserId, setAdminUserId]     = useState('admin');

  // Send state
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; accepted: number; rejected: number; error?: string } | null>(null);

  // Logs state
  const [logs, setLogs]           = useState<CampaignLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ── Load logs on mount ──────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await fetchCampaignLogs();
      setLogs(data);
    } catch {
      // non-fatal
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Segment Preview ────────────────────────────────────────
  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewCount(null);
    try {
      const res = await fetchSegmentPreview(inactiveDays, planFilter);
      setPreviewCount(res.count);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Send Campaign ─────────────────────────────────────────
  const handleSend = async () => {
    if (!campaignName.trim()) {
      alert('Kampanya adı boş bırakılamaz.');
      return;
    }
    if (!previewCount || previewCount === 0) {
      alert('Önce segment önizleme yapın ve kullanıcı sayısını kontrol edin.');
      return;
    }
    const confirmed = window.confirm(
      `${previewCount} kullanıcıya e-posta gönderilecek.\n\nDevam etmek istiyor musunuz?`
    );
    if (!confirmed) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await sendCampaign({
        campaignName: campaignName.trim(),
        inactiveDays,
        planFilter,
        emailSubject: emailSubject.trim(),
        discountCode: discountCode.trim(),
        adminUserId: adminUserId.trim() || 'admin',
      });
      setSendResult({
        success: res.success,
        accepted: res.data?.accepted ?? 0,
        rejected: res.data?.rejected ?? 0,
        error: res.data?.error,
      });
      if (res.success) {
        await loadLogs(); // refresh logs
      }
    } catch (err: any) {
      setSendResult({ success: false, accepted: 0, rejected: 0, error: err.message });
    } finally {
      setSending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111827' }}>
          📧 E-posta Kampanya Yönetimi
        </h1>
        <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: 14 }}>
          Pasif kullanıcılara re-engagement maili gönder · Resend üzerinden iletilir
        </p>
      </div>

      {/* ── SEGMENT SEÇ ── */}
      <SectionCard title="1. Segment Seç">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Inactive Days */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Pasiflik süresi
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 14, 30, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => { setInactiveDays(d); setPreviewCount(null); }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '2px solid',
                    borderColor: inactiveDays === d ? '#5c68e2' : '#e5e7eb',
                    background: inactiveDays === d ? '#eef0fd' : '#fff',
                    color: inactiveDays === d ? '#5c68e2' : '#374151',
                    fontWeight: inactiveDays === d ? 700 : 400,
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {d} gün
                </button>
              ))}
            </div>
          </div>

          {/* Plan Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Plan filtresi
            </label>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value as PlanFilter); setPreviewCount(null); }}
              style={{
                padding: '9px 14px', borderRadius: 8, border: '2px solid #e5e7eb',
                fontSize: 14, background: '#fff', cursor: 'pointer',
              }}
            >
              <option value="all">Tüm Kullanıcılar</option>
              <option value="free">Ücretsiz Kullanıcılar</option>
              <option value="vip_expired">Süresi Dolmuş VIP</option>
            </select>
          </div>

          {/* Preview Button */}
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: '#5c68e2', color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: previewLoading ? 'not-allowed' : 'pointer',
              opacity: previewLoading ? 0.7 : 1,
            }}
          >
            {previewLoading ? 'Hesaplanıyor...' : '🔍 Önizle'}
          </button>
        </div>

        {/* Preview result */}
        {previewError && (
          <div style={{ marginTop: 14, padding: '10px 16px', background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
            Hata: {previewError}
          </div>
        )}
        {previewCount !== null && !previewError && (
          <div style={{
            marginTop: 14, padding: '12px 20px',
            background: previewCount > 0 ? '#f0f9ff' : '#fffbeb',
            border: `1px solid ${previewCount > 0 ? '#bae6fd' : '#fde68a'}`,
            borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: previewCount > 0 ? '#0284c7' : '#d97706' }}>
              {previewCount.toLocaleString('tr-TR')}
            </span>
            <span style={{ color: '#374151', fontSize: 14 }}>
              {previewCount > 0
                ? `kullanıcı bu segmentte · Son ${inactiveDays} gün içinde aktif olmamış`
                : 'Bu segmentte kullanıcı bulunamadı'}
            </span>
          </div>
        )}
      </SectionCard>

      {/* ── KAMPANYA AYARLARI ── */}
      <SectionCard title="2. Kampanya Ayarları">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Campaign name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Kampanya Adı <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Örn: Re-engage Mart 2026"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Email subject */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              E-posta Konusu
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Discount code */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              İndirim Kodu
            </label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '2px solid #e5e7eb', fontSize: 14, fontFamily: 'monospace',
                letterSpacing: 2, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Admin ID */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Admin ID
            </label>
            <input
              type="text"
              value={adminUserId}
              onChange={(e) => setAdminUserId(e.target.value)}
              placeholder="admin"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── GÖNDER ── */}
      <div style={{
        background: sending ? '#f9fafb' : 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: 12, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: sending ? '#374151' : '#fff' }}>
            {previewCount !== null && previewCount > 0
              ? `${previewCount.toLocaleString('tr-TR')} kullanıcıya e-posta gönderilecek`
              : 'Segment önizleme yapın'}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: sending ? '#6b7280' : '#94a3b8' }}>
            Resend üzerinden toplu HTML mail gönderimi
          </p>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !previewCount || previewCount === 0 || !campaignName.trim()}
          style={{
            padding: '14px 32px', borderRadius: 8, border: 'none',
            background: (sending || !previewCount || !campaignName.trim()) ? '#9ca3af' : '#007858',
            color: '#fff', fontWeight: 700, fontSize: 16,
            cursor: (sending || !previewCount || !campaignName.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '⏳ Gönderiliyor...' : '📧 Kampanyayı Gönder'}
        </button>
      </div>

      {/* Send result */}
      {sendResult && (
        <div style={{
          marginBottom: 20, padding: '16px 20px', borderRadius: 8,
          background: sendResult.success ? '#d1fae5' : '#fee2e2',
          border: `1px solid ${sendResult.success ? '#6ee7b7' : '#fca5a5'}`,
        }}>
          {sendResult.success ? (
            <p style={{ margin: 0, fontWeight: 700, color: '#065f46' }}>
              ✅ Kampanya tamamlandı — {sendResult.accepted.toLocaleString('tr-TR')} e-posta kabul edildi
              {sendResult.rejected > 0 && `, ${sendResult.rejected} reddedildi`}
            </p>
          ) : (
            <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>
              ❌ Kampanya başarısız — {sendResult.error ?? 'Bilinmeyen hata'}
            </p>
          )}
        </div>
      )}

      {/* ── GEÇMİŞ KAMPANYALAR ── */}
      <SectionCard title="Kampanya Geçmişi">
        {logsLoading ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>Yükleniyor...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Henüz kampanya gönderilmemiş.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Kampanya', 'Kanal', 'Segment', 'Alıcı', 'Kabul/Red', 'Durum', 'Tarih'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.campaign_name}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {log.channel.toUpperCase()}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {log.segment_params?.inactiveDays}g · {log.segment_params?.planFilter}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {(log.recipient_count ?? 0).toLocaleString('tr-TR')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {log.accepted_count != null
                        ? `${log.accepted_count}/${log.rejected_count ?? 0}`
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={log.status} />
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {log.sent_at
                        ? new Date(log.sent_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
                        : new Date(log.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          onClick={loadLogs}
          style={{
            marginTop: 12, padding: '7px 16px', borderRadius: 6,
            border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 13, cursor: 'pointer', color: '#374151',
          }}
        >
          ↻ Yenile
        </button>
      </SectionCard>
    </div>
  );
}
