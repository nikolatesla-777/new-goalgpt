/**
 * Badge Seeding Script - 50+ Predefined Badges
 *
 * Run: npx ts-node scripts/seed-badges.ts
 *
 * Categories:
 * - Referral Badges (4)
 * - Prediction Badges (6)
 * - Login Streak Badges (5)
 * - Comment Badges (4)
 * - XP Level Badges (6)
 * - Credits Earned Badges (4)
 * - Special Badges (5)
 * - Seasonal Badges (5)
 * - Fun/Quirky Badges (6)
 */

import { db } from '../src/database/kysely';
import { sql } from 'kysely';

interface BadgeDefinition {
  slug: string;
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  icon_url: string;
  category: 'achievement' | 'milestone' | 'special' | 'seasonal';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlock_condition: any;
  reward_xp: number;
  reward_credits: number;
  reward_vip_days: number;
  display_order: number;
}

const badges: BadgeDefinition[] = [
  // ==================== REFERRAL BADGES (4) ====================
  {
    slug: 'first_referral',
    name_tr: 'İlk Arkadaş',
    name_en: 'First Friend',
    description_tr: 'İlk arkadaşını davet et',
    description_en: 'Invite your first friend',
    icon_url: '/badges/first_referral.png',
    category: 'milestone',
    rarity: 'common',
    unlock_condition: { type: 'referrals', count: 1 },
    reward_xp: 50,
    reward_credits: 10,
    reward_vip_days: 0,
    display_order: 1,
  },
  {
    slug: 'social_butterfly',
    name_tr: 'Sosyal Kelebek',
    name_en: 'Social Butterfly',
    description_tr: '5 arkadaşını davet et',
    description_en: 'Invite 5 friends',
    icon_url: '/badges/social_butterfly.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'referrals', count: 5 },
    reward_xp: 200,
    reward_credits: 50,
    reward_vip_days: 0,
    display_order: 2,
  },
  {
    slug: 'influencer',
    name_tr: 'Influencer',
    name_en: 'Influencer',
    description_tr: '20 arkadaşını davet et',
    description_en: 'Invite 20 friends',
    icon_url: '/badges/influencer.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'referrals', count: 20 },
    reward_xp: 500,
    reward_credits: 150,
    reward_vip_days: 3,
    display_order: 3,
  },
  {
    slug: 'legend_recruiter',
    name_tr: 'Efsane Recruiter',
    name_en: 'Legend Recruiter',
    description_tr: '100 arkadaşını davet et',
    description_en: 'Invite 100 friends',
    icon_url: '/badges/legend_recruiter.png',
    category: 'achievement',
    rarity: 'legendary',
    unlock_condition: { type: 'referrals', count: 100 },
    reward_xp: 2000,
    reward_credits: 500,
    reward_vip_days: 30,
    display_order: 4,
  },

  // ==================== PREDICTION BADGES (6) ====================
  {
    slug: 'lucky_guess',
    name_tr: 'Şanslı Tahmin',
    name_en: 'Lucky Guess',
    description_tr: 'İlk doğru tahmini yap',
    description_en: 'Make your first correct prediction',
    icon_url: '/badges/lucky_guess.png',
    category: 'milestone',
    rarity: 'common',
    unlock_condition: { type: 'predictions', correct_count: 1 },
    reward_xp: 25,
    reward_credits: 5,
    reward_vip_days: 0,
    display_order: 5,
  },
  {
    slug: 'prediction_master',
    name_tr: 'Tahmin Ustası',
    name_en: 'Prediction Master',
    description_tr: '10 doğru tahmin yap',
    description_en: 'Make 10 correct predictions',
    icon_url: '/badges/prediction_master.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'predictions', correct_count: 10 },
    reward_xp: 200,
    reward_credits: 50,
    reward_vip_days: 0,
    display_order: 6,
  },
  {
    slug: 'oracle',
    name_tr: 'Kahin',
    name_en: 'Oracle',
    description_tr: '50 doğru tahmin yap',
    description_en: 'Make 50 correct predictions',
    icon_url: '/badges/oracle.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'predictions', correct_count: 50 },
    reward_xp: 750,
    reward_credits: 200,
    reward_vip_days: 7,
    display_order: 7,
  },
  {
    slug: 'nostradamus',
    name_tr: 'Nostradamus',
    name_en: 'Nostradamus',
    description_tr: '200 doğru tahmin yap',
    description_en: 'Make 200 correct predictions',
    icon_url: '/badges/nostradamus.png',
    category: 'achievement',
    rarity: 'legendary',
    unlock_condition: { type: 'predictions', correct_count: 200 },
    reward_xp: 3000,
    reward_credits: 1000,
    reward_vip_days: 30,
    display_order: 8,
  },
  {
    slug: 'accuracy_king',
    name_tr: 'İsabet Kralı',
    name_en: 'Accuracy King',
    description_tr: '%70 isabet oranı ile 20 tahmin yap',
    description_en: 'Achieve 70% accuracy with 20 predictions',
    icon_url: '/badges/accuracy_king.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'predictions', accuracy: 70, min_count: 20 },
    reward_xp: 500,
    reward_credits: 150,
    reward_vip_days: 5,
    display_order: 9,
  },
  {
    slug: 'perfect_week',
    name_tr: 'Mükemmel Hafta',
    name_en: 'Perfect Week',
    description_tr: 'Bir hafta boyunca tüm tahminlerini doğru yap (min 7 tahmin)',
    description_en: 'Get all predictions correct for a week (min 7 predictions)',
    icon_url: '/badges/perfect_week.png',
    category: 'achievement',
    rarity: 'legendary',
    unlock_condition: { type: 'predictions', accuracy: 100, min_count: 7 },
    reward_xp: 1000,
    reward_credits: 300,
    reward_vip_days: 7,
    display_order: 10,
  },

  // ==================== LOGIN STREAK BADGES (5) ====================
  {
    slug: 'streak_3',
    name_tr: '3 Gün Streak',
    name_en: '3 Day Streak',
    description_tr: '3 gün üst üste giriş yap',
    description_en: 'Log in for 3 consecutive days',
    icon_url: '/badges/streak_3.png',
    category: 'milestone',
    rarity: 'common',
    unlock_condition: { type: 'login_streak', days: 3 },
    reward_xp: 30,
    reward_credits: 10,
    reward_vip_days: 0,
    display_order: 11,
  },
  {
    slug: 'streak_7',
    name_tr: '7 Gün Streak',
    name_en: '7 Day Streak',
    description_tr: '7 gün üst üste giriş yap',
    description_en: 'Log in for 7 consecutive days',
    icon_url: '/badges/streak_7.png',
    category: 'milestone',
    rarity: 'rare',
    unlock_condition: { type: 'login_streak', days: 7 },
    reward_xp: 100,
    reward_credits: 30,
    reward_vip_days: 0,
    display_order: 12,
  },
  {
    slug: 'streak_14',
    name_tr: '14 Gün Streak',
    name_en: '14 Day Streak',
    description_tr: '14 gün üst üste giriş yap',
    description_en: 'Log in for 14 consecutive days',
    icon_url: '/badges/streak_14.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'login_streak', days: 14 },
    reward_xp: 250,
    reward_credits: 75,
    reward_vip_days: 1,
    display_order: 13,
  },
  {
    slug: 'streak_30',
    name_tr: '30 Gün Streak',
    name_en: '30 Day Streak',
    description_tr: '30 gün üst üste giriş yap',
    description_en: 'Log in for 30 consecutive days',
    icon_url: '/badges/streak_30.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'login_streak', days: 30 },
    reward_xp: 750,
    reward_credits: 250,
    reward_vip_days: 7,
    display_order: 14,
  },
  {
    slug: 'streak_100',
    name_tr: '100 Gün Streak',
    name_en: '100 Day Streak',
    description_tr: '100 gün üst üste giriş yap',
    description_en: 'Log in for 100 consecutive days',
    icon_url: '/badges/streak_100.png',
    category: 'achievement',
    rarity: 'legendary',
    unlock_condition: { type: 'login_streak', days: 100 },
    reward_xp: 3000,
    reward_credits: 1000,
    reward_vip_days: 30,
    display_order: 15,
  },

  // ==================== COMMENT BADGES (4) ====================
  {
    slug: 'first_comment',
    name_tr: 'İlk Yorum',
    name_en: 'First Comment',
    description_tr: 'İlk yorumunu yap',
    description_en: 'Make your first comment',
    icon_url: '/badges/first_comment.png',
    category: 'milestone',
    rarity: 'common',
    unlock_condition: { type: 'comments', count: 1 },
    reward_xp: 10,
    reward_credits: 5,
    reward_vip_days: 0,
    display_order: 16,
  },
  {
    slug: 'commentator',
    name_tr: 'Yorumcu',
    name_en: 'Commentator',
    description_tr: '50 yorum yap',
    description_en: 'Make 50 comments',
    icon_url: '/badges/commentator.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'comments', count: 50 },
    reward_xp: 150,
    reward_credits: 40,
    reward_vip_days: 0,
    display_order: 17,
  },
  {
    slug: 'active_voice',
    name_tr: 'Aktif Ses',
    name_en: 'Active Voice',
    description_tr: '200 yorum yap',
    description_en: 'Make 200 comments',
    icon_url: '/badges/active_voice.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'comments', count: 200 },
    reward_xp: 500,
    reward_credits: 150,
    reward_vip_days: 3,
    display_order: 18,
  },
  {
    slug: 'community_leader',
    name_tr: 'Topluluk Lideri',
    name_en: 'Community Leader',
    description_tr: '1000 yorum yap',
    description_en: 'Make 1000 comments',
    icon_url: '/badges/community_leader.png',
    category: 'achievement',
    rarity: 'legendary',
    unlock_condition: { type: 'comments', count: 1000 },
    reward_xp: 2000,
    reward_credits: 500,
    reward_vip_days: 15,
    display_order: 19,
  },

  // ==================== XP LEVEL BADGES (6) ====================
  {
    slug: 'bronze_warrior',
    name_tr: 'Bronz Savaşçı',
    name_en: 'Bronze Warrior',
    description_tr: 'Bronze seviyesine ulaş',
    description_en: 'Reach Bronze level',
    icon_url: '/badges/bronze_warrior.png',
    category: 'milestone',
    rarity: 'common',
    unlock_condition: { type: 'xp_level', level: 'bronze' },
    reward_xp: 0,
    reward_credits: 10,
    reward_vip_days: 0,
    display_order: 20,
  },
  {
    slug: 'silver_champion',
    name_tr: 'Gümüş Şampiyon',
    name_en: 'Silver Champion',
    description_tr: 'Silver seviyesine ulaş',
    description_en: 'Reach Silver level',
    icon_url: '/badges/silver_champion.png',
    category: 'milestone',
    rarity: 'common',
    unlock_condition: { type: 'xp_level', level: 'silver' },
    reward_xp: 0,
    reward_credits: 25,
    reward_vip_days: 0,
    display_order: 21,
  },
  {
    slug: 'gold_legend',
    name_tr: 'Altın Efsane',
    name_en: 'Gold Legend',
    description_tr: 'Gold seviyesine ulaş',
    description_en: 'Reach Gold level',
    icon_url: '/badges/gold_legend.png',
    category: 'milestone',
    rarity: 'rare',
    unlock_condition: { type: 'xp_level', level: 'gold' },
    reward_xp: 0,
    reward_credits: 50,
    reward_vip_days: 1,
    display_order: 22,
  },
  {
    slug: 'platinum_master',
    name_tr: 'Platin Usta',
    name_en: 'Platinum Master',
    description_tr: 'Platinum seviyesine ulaş',
    description_en: 'Reach Platinum level',
    icon_url: '/badges/platinum_master.png',
    category: 'milestone',
    rarity: 'epic',
    unlock_condition: { type: 'xp_level', level: 'platinum' },
    reward_xp: 0,
    reward_credits: 100,
    reward_vip_days: 3,
    display_order: 23,
  },
  {
    slug: 'diamond_elite',
    name_tr: 'Elmas Elit',
    name_en: 'Diamond Elite',
    description_tr: 'Diamond seviyesine ulaş',
    description_en: 'Reach Diamond level',
    icon_url: '/badges/diamond_elite.png',
    category: 'milestone',
    rarity: 'epic',
    unlock_condition: { type: 'xp_level', level: 'diamond' },
    reward_xp: 0,
    reward_credits: 250,
    reward_vip_days: 7,
    display_order: 24,
  },
  {
    slug: 'vip_elite_god',
    name_tr: 'VIP Elite Tanrı',
    name_en: 'VIP Elite God',
    description_tr: 'VIP Elite seviyesine ulaş',
    description_en: 'Reach VIP Elite level',
    icon_url: '/badges/vip_elite_god.png',
    category: 'milestone',
    rarity: 'legendary',
    unlock_condition: { type: 'xp_level', level: 'vip_elite' },
    reward_xp: 0,
    reward_credits: 500,
    reward_vip_days: 30,
    display_order: 25,
  },

  // ==================== CREDITS EARNED BADGES (4) ====================
  {
    slug: 'credit_collector',
    name_tr: 'Kredi Toplayıcı',
    name_en: 'Credit Collector',
    description_tr: '100 kredi kazan',
    description_en: 'Earn 100 credits',
    icon_url: '/badges/credit_collector.png',
    category: 'achievement',
    rarity: 'common',
    unlock_condition: { type: 'credits_earned', amount: 100 },
    reward_xp: 50,
    reward_credits: 25,
    reward_vip_days: 0,
    display_order: 26,
  },
  {
    slug: 'credit_magnate',
    name_tr: 'Kredi Patronu',
    name_en: 'Credit Magnate',
    description_tr: '500 kredi kazan',
    description_en: 'Earn 500 credits',
    icon_url: '/badges/credit_magnate.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'credits_earned', amount: 500 },
    reward_xp: 200,
    reward_credits: 100,
    reward_vip_days: 1,
    display_order: 27,
  },
  {
    slug: 'credit_tycoon',
    name_tr: 'Kredi Kralı',
    name_en: 'Credit Tycoon',
    description_tr: '2000 kredi kazan',
    description_en: 'Earn 2000 credits',
    icon_url: '/badges/credit_tycoon.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'credits_earned', amount: 2000 },
    reward_xp: 750,
    reward_credits: 500,
    reward_vip_days: 7,
    display_order: 28,
  },
  {
    slug: 'billionaire',
    name_tr: 'Milyarder',
    name_en: 'Billionaire',
    description_tr: '10000 kredi kazan',
    description_en: 'Earn 10000 credits',
    icon_url: '/badges/billionaire.png',
    category: 'achievement',
    rarity: 'legendary',
    unlock_condition: { type: 'credits_earned', amount: 10000 },
    reward_xp: 3000,
    reward_credits: 2000,
    reward_vip_days: 30,
    display_order: 29,
  },

  // ==================== SPECIAL BADGES (5) ====================
  {
    slug: 'beta_tester',
    name_tr: 'Beta Tester',
    name_en: 'Beta Tester',
    description_tr: 'Uygulamanın beta testine katıl',
    description_en: 'Participate in app beta testing',
    icon_url: '/badges/beta_tester.png',
    category: 'special',
    rarity: 'epic',
    unlock_condition: { type: 'manual' },
    reward_xp: 500,
    reward_credits: 100,
    reward_vip_days: 7,
    display_order: 30,
  },
  {
    slug: 'founding_member',
    name_tr: 'Kurucu Üye',
    name_en: 'Founding Member',
    description_tr: 'İlk 1000 kullanıcıdan biri ol',
    description_en: 'Be among the first 1000 users',
    icon_url: '/badges/founding_member.png',
    category: 'special',
    rarity: 'legendary',
    unlock_condition: { type: 'manual' },
    reward_xp: 1000,
    reward_credits: 500,
    reward_vip_days: 30,
    display_order: 31,
  },
  {
    slug: 'vip_founder',
    name_tr: 'VIP Kurucu',
    name_en: 'VIP Founder',
    description_tr: 'İlk VIP aboneliklerden biri ol',
    description_en: 'Be among the first VIP subscribers',
    icon_url: '/badges/vip_founder.png',
    category: 'special',
    rarity: 'legendary',
    unlock_condition: { type: 'manual' },
    reward_xp: 2000,
    reward_credits: 1000,
    reward_vip_days: 90,
    display_order: 32,
  },
  {
    slug: 'bug_hunter',
    name_tr: 'Bug Avcısı',
    name_en: 'Bug Hunter',
    description_tr: 'Kritik bir bug bildir',
    description_en: 'Report a critical bug',
    icon_url: '/badges/bug_hunter.png',
    category: 'special',
    rarity: 'epic',
    unlock_condition: { type: 'manual' },
    reward_xp: 500,
    reward_credits: 200,
    reward_vip_days: 7,
    display_order: 33,
  },
  {
    slug: 'early_adopter',
    name_tr: 'Erken Benimseyici',
    name_en: 'Early Adopter',
    description_tr: 'Uygulamanın ilk ayında kayıt ol',
    description_en: 'Sign up in the first month',
    icon_url: '/badges/early_adopter.png',
    category: 'special',
    rarity: 'rare',
    unlock_condition: { type: 'manual' },
    reward_xp: 250,
    reward_credits: 100,
    reward_vip_days: 3,
    display_order: 34,
  },

  // ==================== SEASONAL BADGES (5) ====================
  {
    slug: 'world_cup_2026',
    name_tr: 'Dünya Kupası 2026',
    name_en: 'World Cup 2026',
    description_tr: '2026 Dünya Kupası sırasında aktif ol',
    description_en: 'Be active during 2026 World Cup',
    icon_url: '/badges/world_cup_2026.png',
    category: 'seasonal',
    rarity: 'legendary',
    unlock_condition: { type: 'manual' },
    reward_xp: 1000,
    reward_credits: 500,
    reward_vip_days: 30,
    display_order: 35,
  },
  {
    slug: 'champions_league_2026',
    name_tr: 'Şampiyonlar Ligi 2026',
    name_en: 'Champions League 2026',
    description_tr: '2026 Şampiyonlar Ligi finalinde aktif ol',
    description_en: 'Be active during 2026 Champions League final',
    icon_url: '/badges/champions_league_2026.png',
    category: 'seasonal',
    rarity: 'epic',
    unlock_condition: { type: 'manual' },
    reward_xp: 500,
    reward_credits: 250,
    reward_vip_days: 7,
    display_order: 36,
  },
  {
    slug: 'euro_2024',
    name_tr: 'Euro 2024',
    name_en: 'Euro 2024',
    description_tr: 'Euro 2024 sırasında aktif ol',
    description_en: 'Be active during Euro 2024',
    icon_url: '/badges/euro_2024.png',
    category: 'seasonal',
    rarity: 'epic',
    unlock_condition: { type: 'manual' },
    reward_xp: 500,
    reward_credits: 250,
    reward_vip_days: 7,
    display_order: 37,
  },
  {
    slug: 'ramadan_2026',
    name_tr: 'Ramazan 2026',
    name_en: 'Ramadan 2026',
    description_tr: 'Ramazan ayında her gün giriş yap',
    description_en: 'Log in every day during Ramadan',
    icon_url: '/badges/ramadan_2026.png',
    category: 'seasonal',
    rarity: 'rare',
    unlock_condition: { type: 'manual' },
    reward_xp: 300,
    reward_credits: 150,
    reward_vip_days: 7,
    display_order: 38,
  },
  {
    slug: 'new_year_2026',
    name_tr: 'Yeni Yıl 2026',
    name_en: 'New Year 2026',
    description_tr: 'Yeni yıl gecesi aktif ol',
    description_en: 'Be active on New Year\'s Eve',
    icon_url: '/badges/new_year_2026.png',
    category: 'seasonal',
    rarity: 'rare',
    unlock_condition: { type: 'manual' },
    reward_xp: 200,
    reward_credits: 100,
    reward_vip_days: 3,
    display_order: 39,
  },

  // ==================== FUN/QUIRKY BADGES (6) ====================
  {
    slug: 'night_owl',
    name_tr: 'Gece Kuşu',
    name_en: 'Night Owl',
    description_tr: 'Gece 2-5 arası 10 giriş yap',
    description_en: 'Log in 10 times between 2-5 AM',
    icon_url: '/badges/night_owl.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'manual' },
    reward_xp: 150,
    reward_credits: 50,
    reward_vip_days: 1,
    display_order: 40,
  },
  {
    slug: 'coffee_break',
    name_tr: 'Kahve Molası',
    name_en: 'Coffee Break',
    description_tr: 'Sabah 8-10 arası 30 giriş yap',
    description_en: 'Log in 30 times between 8-10 AM',
    icon_url: '/badges/coffee_break.png',
    category: 'achievement',
    rarity: 'common',
    unlock_condition: { type: 'manual' },
    reward_xp: 50,
    reward_credits: 20,
    reward_vip_days: 0,
    display_order: 41,
  },
  {
    slug: 'weekend_warrior',
    name_tr: 'Hafta Sonu Savaşçısı',
    name_en: 'Weekend Warrior',
    description_tr: '10 hafta sonu üst üste giriş yap',
    description_en: 'Log in for 10 consecutive weekends',
    icon_url: '/badges/weekend_warrior.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'manual' },
    reward_xp: 200,
    reward_credits: 75,
    reward_vip_days: 2,
    display_order: 42,
  },
  {
    slug: 'perfect_score',
    name_tr: 'Tam Skor',
    name_en: 'Perfect Score',
    description_tr: 'Bir maçın skorunu tam olarak tahmin et',
    description_en: 'Predict the exact score of a match',
    icon_url: '/badges/perfect_score.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'manual' },
    reward_xp: 500,
    reward_credits: 200,
    reward_vip_days: 5,
    display_order: 43,
  },
  {
    slug: 'comeback_king',
    name_tr: 'Dönüş Kralı',
    name_en: 'Comeback King',
    description_tr: '2-0 geriden dönen bir takımı tahmin et',
    description_en: 'Predict a team that comes back from 2-0 down',
    icon_url: '/badges/comeback_king.png',
    category: 'achievement',
    rarity: 'epic',
    unlock_condition: { type: 'manual' },
    reward_xp: 750,
    reward_credits: 300,
    reward_vip_days: 7,
    display_order: 44,
  },
  {
    slug: 'underdog_believer',
    name_tr: 'Mazlum Taraftarı',
    name_en: 'Underdog Believer',
    description_tr: '10 kez underdog takımı doğru tahmin et',
    description_en: 'Correctly predict the underdog 10 times',
    icon_url: '/badges/underdog_believer.png',
    category: 'achievement',
    rarity: 'rare',
    unlock_condition: { type: 'manual' },
    reward_xp: 300,
    reward_credits: 100,
    reward_vip_days: 3,
    display_order: 45,
  },
];

async function seedBadges() {
  console.log('🚀 Starting badge seeding process...\n');

  try {
    // Check if badges already exist
    const existingBadges = await db
      .selectFrom('badges')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    const count = Number(existingBadges?.count || 0);

    if (count > 0) {
      console.log(`⚠️  Warning: ${count} badges already exist in database.`);
      console.log('   This script will skip existing badges (by slug).\n');
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const badge of badges) {
      try {
        // Check if badge with this slug already exists
        const existing = await db
          .selectFrom('badges')
          .select('id')
          .where('slug', '=', badge.slug)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();

        if (existing) {
          console.log(`   ⏭️  Skipped: ${badge.slug} (already exists)`);
          skipped++;
          continue;
        }

        // Insert badge
        await db
          .insertInto('badges')
          .values({
            slug: badge.slug,
            name_tr: badge.name_tr,
            name_en: badge.name_en,
            description_tr: badge.description_tr,
            description_en: badge.description_en,
            icon_url: badge.icon_url,
            category: badge.category,
            rarity: badge.rarity,
            unlock_condition: JSON.stringify(badge.unlock_condition),
            reward_xp: badge.reward_xp,
            reward_credits: badge.reward_credits,
            reward_vip_days: badge.reward_vip_days,
            is_active: true,
            display_order: badge.display_order,
            total_unlocks: 0,
            created_at: sql`NOW()`,
            updated_at: sql`NOW()`,
            deleted_at: null,
          })
          .execute();

        console.log(`   ✅ Inserted: ${badge.slug} (${badge.rarity})`);
        inserted++;
      } catch (err: any) {
        console.error(`   ❌ Error inserting ${badge.slug}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   Total badges: ${badges.length}`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);

    // Get category breakdown
    console.log('\n📈 Badge Breakdown by Category:');
    const categoryStats = await db
      .selectFrom('badges')
      .select([
        'category',
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('deleted_at', 'is', null)
      .groupBy('category')
      .execute();

    for (const stat of categoryStats) {
      console.log(`   ${stat.category}: ${stat.count}`);
    }

    console.log('\n📈 Badge Breakdown by Rarity:');
    const rarityStats = await db
      .selectFrom('badges')
      .select([
        'rarity',
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('deleted_at', 'is', null)
      .groupBy('rarity')
      .execute();

    for (const stat of rarityStats) {
      console.log(`   ${stat.rarity}: ${stat.count}`);
    }

    console.log('\n✅ Badge seeding completed successfully!\n');
  } catch (error: any) {
    console.error('❌ Fatal error during seeding:', error);
    throw error;
  }
}

// Run seeding
seedBadges()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
