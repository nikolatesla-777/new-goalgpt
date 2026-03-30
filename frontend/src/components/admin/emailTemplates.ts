/**
 * Email Template Registry
 *
 * Add new templates here — they automatically appear in EmailCampaignPage.
 * HTML files live in /public/email-templates/*.html
 * Placeholders: {{user_name}}, {{days_inactive}}, {{discount_code}}, {{unsubscribe_url}}
 */

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  defaultSubject: string;
  tags: string[];
  /** Relative path to HTML file in /public */
  previewPath: string;
  accentColor: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'goalgpt-v1',
    name: 'GoalGPT V1 — Dark Pro',
    description: 'Koyu gradient hero, haftalık kazanılan maçlar, indirim kutusu, fiyatlandırma kartları ve testimonial bölümü.',
    defaultSubject: 'GoalGPT — {{days_inactive}} gündür yoktun 👀 Geri dön, %30 indirim kazan!',
    tags: ['Re-engagement', 'İndirim', 'VIP', 'Dark'],
    previewPath: '/email-templates/goalgpt-v1.html',
    accentColor: '#5c68e2',
  },
  {
    id: 'goalgpt-v2',
    name: 'GoalGPT V2 — Radar Sistemi',
    description: 'Radar & AI odaklı. Sistem nasıl çalışır (4 adım), 87 parametre listesi, telefon bildirim mockup\'u, günlük/haftalık/aylık başarı oranları.',
    defaultSubject: 'GoalGPT Radar {{days_inactive}} gündür seni arıyor 🎯 Sisteme geri dön!',
    tags: ['Teknik', 'AI Radar', 'Performans', 'Dark'],
    previewPath: '/email-templates/goalgpt-v2.html',
    accentColor: '#00ff88',
  },
];

/** Sample data injected into template previews */
export const PREVIEW_VARS = {
  user_name: 'Ahmet',
  days_inactive: '14',
  discount_code: 'GOBACK30',
  unsubscribe_url: '#',
};

/** Replace all {{placeholder}} tokens with given vars */
export function injectTemplateVars(
  html: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val),
    html
  );
}
