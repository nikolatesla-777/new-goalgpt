/**
 * EmailCampaignPage — Re-engagement Email Campaign Manager
 *
 * Flow:
 * 1. Template Seç   — preview + select HTML template
 * 2. Segment Seç    — inactive days + plan filter + preview count
 * 3. Kampanya Ayarları — name, subject, discount code
 * 4. Gönder
 * 5. Kampanya Geçmişi
 */

import { useState, useEffect, useCallback } from 'react';
import {
  EMAIL_TEMPLATES,
  PREVIEW_VARS,
  injectTemplateVars,
  type EmailTemplate,
} from './emailTemplates';

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
  return { 'Content-Type': 'application/json', 'x-admin-api-key': ADMIN_KEY };
}

async function fetchSegmentPreview(inactiveDays: number, planFilter: PlanFilter) {
  const res = await fetch(
    `${API_BASE}/admin/email/segment-preview?inactiveDays=${inactiveDays}&planFilter=${planFilter}`,
    { headers: adminHeaders() }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data as { count: number };
}

async function sendCampaign(body: {
  campaignName: string;
  inactiveDays: number;
  planFilter: PlanFilter;
  emailSubject: string;
  discountCode: string;
  adminUserId: string;
  templateId: string;
}) {
  const res = await fetch(`${API_BASE}/admin/email/send-campaign`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ ...body, channel: 'email' }),
  });
  const json = await res.json();
  return json as {
    success: boolean;
    data: { accepted: number; rejected: number; recipientCount: number; error?: string };
  };
}

async function fetchCampaignLogs() {
  const res = await fetch(`${API_BASE}/admin/email/campaign-logs?limit=20`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as CampaignLog[];
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
    <span style={{ background: s.bg, color: s.text, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function SectionCard({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '24px 28px',
      marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      border: '1px solid #e5e7eb',
      borderTop: accent ? `3px solid ${accent}` : '1px solid #e5e7eb',
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h3>
      {children}
    </div>
  );
}

// ── Template Preview Modal ──────────────────────────────────────────────────

function PreviewModal({
  html,
  templateName,
  onClose,
}: {
  html: string;
  templateName: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: '20px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 680,
          overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 6 }}>
              📧 {templateName} — Önizleme
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        {/* Email client chrome */}
        <div style={{ background: '#f1f5f9', padding: '10px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Konu: Seni Çok Özledik 👀</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Gönderen: GoalGPT &lt;noreply@goalgpt.pro&gt;</div>
        </div>
        {/* iframe */}
        <iframe
          srcDoc={html}
          title="Email Preview"
          style={{ width: '100%', height: 600, border: 'none', display: 'block', background: '#fff' }}
          sandbox="allow-same-origin"
        />
        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 24px', borderRadius: 8, border: 'none',
              background: '#5c68e2', color: '#fff', fontWeight: 700,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  discountCode,
  onSelect,
}: {
  template: EmailTemplate;
  selected: boolean;
  discountCode: string;
  onSelect: () => void;
}) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const openPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(template.previewPath);
      let html = await res.text();
      html = injectTemplateVars(html, {
        ...PREVIEW_VARS,
        discount_code: discountCode || PREVIEW_VARS.discount_code,
      });
      setPreviewHtml(html);
      setShowModal(true);
    } catch {
      alert('Template yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showModal && previewHtml && (
        <PreviewModal
          html={previewHtml}
          templateName={template.name}
          onClose={() => setShowModal(false)}
        />
      )}
      <div
        onClick={onSelect}
        style={{
          border: `2px solid ${selected ? template.accentColor : '#e5e7eb'}`,
          borderRadius: 12, padding: '20px 22px', cursor: 'pointer',
          background: selected ? `${template.accentColor}08` : '#fafafa',
          transition: 'border-color 0.15s, background 0.15s',
          position: 'relative',
        }}
      >
        {/* Selected indicator */}
        {selected && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: template.accentColor, color: '#fff',
            borderRadius: '50%', width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800,
          }}>✓</div>
        )}

        {/* Color strip */}
        <div style={{
          width: 40, height: 6, borderRadius: 4,
          background: `linear-gradient(90deg, ${template.accentColor}, #007858)`,
          marginBottom: 12,
        }} />

        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>
          {template.name}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>
          {template.description}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {template.tags.map((tag) => (
            <span key={tag} style={{
              background: `${template.accentColor}15`, color: template.accentColor,
              padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600,
            }}>
              {tag}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={openPreview}
            disabled={loading}
            style={{
              padding: '7px 16px', borderRadius: 7, border: `1px solid ${template.accentColor}`,
              background: '#fff', color: template.accentColor, fontSize: 13,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : '👁 Önizle'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: selected ? template.accentColor : '#f3f4f6',
              color: selected ? '#fff' : '#374151',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {selected ? '✓ Seçildi' : 'Seç'}
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EmailCampaignPage() {
  // Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(EMAIL_TEMPLATES[0]?.id ?? '');

  // Segment
  const [inactiveDays, setInactiveDays] = useState(14);
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');

  // Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [emailSubject, setEmailSubject] = useState('GoalGPT — Seni Özledik 👀 Geri Dön, %30 İndirim Kazan!');
  const [discountCode, setDiscountCode] = useState('GOBACK30');
  const [adminUserId, setAdminUserId] = useState('admin');

  // Send
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean; accepted: number; rejected: number; error?: string;
  } | null>(null);

  // Logs
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // When template changes, update default subject
  useEffect(() => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (tpl) {
      setEmailSubject(
        tpl.defaultSubject
          .replace('{{days_inactive}}', String(inactiveDays))
          .replace('{{discount_code}}', discountCode)
      );
    }
  }, [selectedTemplateId]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try { setLogs(await fetchCampaignLogs()); } catch { /* non-fatal */ }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

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

  const handleSend = async () => {
    if (!campaignName.trim()) { alert('Kampanya adı boş bırakılamaz.'); return; }
    if (!selectedTemplateId) { alert('Bir template seçmelisiniz.'); return; }
    if (!previewCount || previewCount === 0) {
      alert('Önce segment önizleme yapın ve kullanıcı sayısını kontrol edin.');
      return;
    }
    if (!window.confirm(`${previewCount.toLocaleString('tr-TR')} kullanıcıya e-posta gönderilecek.\n\nDevam etmek istiyor musunuz?`)) return;

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
        templateId: selectedTemplateId,
      });
      setSendResult({
        success: res.success,
        accepted: res.data?.accepted ?? 0,
        rejected: res.data?.rejected ?? 0,
        error: res.data?.error,
      });
      if (res.success) await loadLogs();
    } catch (err: any) {
      setSendResult({ success: false, accepted: 0, rejected: 0, error: err.message });
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId);

  // ── Render ──────────────────────────────────────────────────────────────
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

      {/* ── 1. TEMPLATE SEÇ ── */}
      <SectionCard title="1. Template Seç" accent="#5c68e2">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {EMAIL_TEMPLATES.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              selected={selectedTemplateId === tpl.id}
              discountCode={discountCode}
              onSelect={() => setSelectedTemplateId(tpl.id)}
            />
          ))}
        </div>
        {selectedTemplate && (
          <div style={{
            marginTop: 14, padding: '10px 14px', background: '#f0f9ff',
            border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, color: '#0369a1',
          }}>
            Seçili: <strong>{selectedTemplate.name}</strong>
          </div>
        )}
      </SectionCard>

      {/* ── 2. SEGMENT SEÇ ── */}
      <SectionCard title="2. Segment Seç" accent="#007858">
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
                    borderColor: inactiveDays === d ? '#007858' : '#e5e7eb',
                    background: inactiveDays === d ? '#f0fdf4' : '#fff',
                    color: inactiveDays === d ? '#007858' : '#374151',
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
              style={{ padding: '9px 14px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, background: '#fff', cursor: 'pointer' }}
            >
              <option value="all">Tüm Kullanıcılar</option>
              <option value="free">Ücretsiz Kullanıcılar</option>
              <option value="vip_expired">Süresi Dolmuş VIP</option>
            </select>
          </div>

          <button
            onClick={handlePreview}
            disabled={previewLoading}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: '#007858', color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: previewLoading ? 'not-allowed' : 'pointer',
              opacity: previewLoading ? 0.7 : 1,
            }}
          >
            {previewLoading ? 'Hesaplanıyor...' : '🔍 Önizle'}
          </button>
        </div>

        {previewError && (
          <div style={{ marginTop: 14, padding: '10px 16px', background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
            Hata: {previewError}
          </div>
        )}
        {previewCount !== null && !previewError && (
          <div style={{
            marginTop: 14, padding: '12px 20px',
            background: previewCount > 0 ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${previewCount > 0 ? '#6ee7b7' : '#fde68a'}`,
            borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: previewCount > 0 ? '#007858' : '#d97706' }}>
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

      {/* ── 3. KAMPANYA AYARLARI ── */}
      <SectionCard title="3. Kampanya Ayarları" accent="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Kampanya Adı <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Örn: Re-engage Mart 2026"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              E-posta Konusu
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              İndirim Kodu
            </label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Admin ID
            </label>
            <input
              type="text"
              value={adminUserId}
              onChange={(e) => setAdminUserId(e.target.value)}
              placeholder="admin"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── GÖNDER BARI ── */}
      <div style={{
        background: sending ? '#f9fafb' : 'linear-gradient(135deg,#1e293b,#0f172a)',
        borderRadius: 12, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: sending ? '#374151' : '#fff' }}>
            {previewCount !== null && previewCount > 0
              ? `${previewCount.toLocaleString('tr-TR')} kullanıcıya e-posta gönderilecek`
              : 'Segment önizleme yapın'}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: sending ? '#6b7280' : '#64748b' }}>
            {selectedTemplate ? `Template: ${selectedTemplate.name}` : 'Template seçiniz'} · Resend üzerinden toplu HTML mail
          </p>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !previewCount || previewCount === 0 || !campaignName.trim() || !selectedTemplateId}
          style={{
            padding: '14px 32px', borderRadius: 8, border: 'none',
            background: (sending || !previewCount || !campaignName.trim() || !selectedTemplateId) ? '#9ca3af' : '#007858',
            color: '#fff', fontWeight: 700, fontSize: 16,
            cursor: (sending || !previewCount || !campaignName.trim() || !selectedTemplateId) ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '⏳ Gönderiliyor...' : '📧 Kampanyayı Gönder'}
        </button>
      </div>

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
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.campaign_name}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{log.channel.toUpperCase()}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {log.segment_params?.inactiveDays}g · {log.segment_params?.planFilter}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {(log.recipient_count ?? 0).toLocaleString('tr-TR')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {log.accepted_count != null ? `${log.accepted_count}/${log.rejected_count ?? 0}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={log.status} /></td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(log.sent_at ?? log.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          onClick={loadLogs}
          style={{ marginTop: 12, padding: '7px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}
        >
          ↻ Yenile
        </button>
      </SectionCard>
    </div>
  );
}
