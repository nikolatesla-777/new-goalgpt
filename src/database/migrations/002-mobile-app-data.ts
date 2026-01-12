import { Kysely, sql } from 'kysely';

/**
 * Mobile App Data Migration
 * Initializes XP, Credits for all 50K+ existing users
 * Grants welcome bonus to VIP users
 * Inserts default badges
 * Generates referral codes
 */

export async function up(db: Kysely<any>): Promise<void> {
  console.log('🚀 Starting data migration for existing users...');

  const startTime = Date.now();

  // 1. Initialize XP for all existing users
  console.log('📊 Initializing XP records...');
  const xpResult = await sql`
    INSERT INTO customer_xp (customer_user_id, xp_points, level, total_earned)
    SELECT
      id,
      0 as xp_points,
      'bronze' as level,
      0 as total_earned
    FROM customer_users
    WHERE deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM customer_xp WHERE customer_user_id = customer_users.id
      )
  `.execute(db);

  console.log(`✅ Created ${xpResult.numAffectedRows || 0} XP records`);

  // 2. Initialize Credits for all existing users
  console.log('💰 Initializing Credit records...');
  const creditsResult = await sql`
    INSERT INTO customer_credits (customer_user_id, balance, lifetime_earned, lifetime_spent)
    SELECT
      id,
      0 as balance,
      0 as lifetime_earned,
      0 as lifetime_spent
    FROM customer_users
    WHERE deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM customer_credits WHERE customer_user_id = customer_users.id
      )
  `.execute(db);

  console.log(`✅ Created ${creditsResult.numAffectedRows || 0} Credit records`);

  // 3. Grant welcome bonus to existing VIP users (50 credits)
  console.log('🎁 Granting welcome bonus to VIP users...');

  const vipUsers = await db
    .selectFrom('customer_subscriptions as cs')
    .innerJoin('customer_users as cu', 'cu.id', 'cs.customer_user_id')
    .select(['cu.id as user_id'])
    .where('cs.status', '=', 'active')
    .where('cs.expired_at', '>', sql`NOW()`)
    .where('cu.deleted_at', 'is', null)
    .execute();

  let bonusCount = 0;

  for (const user of vipUsers) {
    await db.transaction().execute(async (trx) => {
      // Get current balance
      const currentCredit = await trx
        .selectFrom('customer_credits')
        .select(['balance'])
        .where('customer_user_id', '=', user.user_id)
        .executeTakeFirst();

      const balanceBefore = currentCredit?.balance || 0;
      const balanceAfter = balanceBefore + 50;

      // Update balance
      await trx
        .updateTable('customer_credits')
        .set({
          balance: balanceAfter,
          lifetime_earned: sql`lifetime_earned + 50`,
          updated_at: sql`NOW()`
        })
        .where('customer_user_id', '=', user.user_id)
        .execute();

      // Insert transaction record
      await trx
        .insertInto('customer_credit_transactions')
        .values({
          customer_user_id: user.user_id,
          amount: 50,
          transaction_type: 'promotional',
          description: 'VIP kullanıcısı hoş geldin bonusu',
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          metadata: sql`'{"migration": true}'::jsonb`
        })
        .execute();
    });

    bonusCount++;
  }

  console.log(`✅ Granted welcome bonus to ${bonusCount} VIP users`);

  // 4. Insert default badges
  console.log('🏅 Inserting default badges...');

  const defaultBadges = [
    {
      slug: 'first_referral',
      name_tr: 'İlk Arkadaş',
      name_en: 'First Friend',
      description_tr: 'İlk arkadaşını davet et',
      description_en: 'Invite your first friend',
      icon_url: '/badges/first_referral.png',
      category: 'milestone',
      rarity: 'common',
      unlock_condition: sql`'{"type": "referrals", "count": 1}'::jsonb`,
      reward_xp: 50,
      reward_credits: 10
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
      unlock_condition: sql`'{"type": "predictions", "correct_count": 10}'::jsonb`,
      reward_xp: 200,
      reward_credits: 50
    },
    {
      slug: 'streak_7',
      name_tr: '7 Gün Streak',
      name_en: '7 Day Streak',
      description_tr: '7 gün üst üste giriş yap',
      description_en: 'Login 7 days in a row',
      icon_url: '/badges/streak_7.png',
      category: 'milestone',
      rarity: 'common',
      unlock_condition: sql`'{"type": "login_streak", "days": 7}'::jsonb`,
      reward_xp: 100,
      reward_credits: 25
    },
    {
      slug: 'first_comment',
      name_tr: 'İlk Yorum',
      name_en: 'First Comment',
      description_tr: 'İlk maç yorumunu yap',
      description_en: 'Make your first match comment',
      icon_url: '/badges/first_comment.png',
      category: 'milestone',
      rarity: 'common',
      unlock_condition: sql`'{"type": "comments", "count": 1}'::jsonb`,
      reward_xp: 25,
      reward_credits: 5
    },
    {
      slug: 'vip_founder',
      name_tr: 'VIP Kurucu',
      name_en: 'VIP Founder',
      description_tr: 'İlk VIP abonesi ol',
      description_en: 'Become the first VIP subscriber',
      icon_url: '/badges/vip_founder.png',
      category: 'special',
      rarity: 'epic',
      unlock_condition: sql`'{"type": "subscription", "any": true}'::jsonb`,
      reward_xp: 500,
      reward_credits: 100
    }
  ];

  for (const badge of defaultBadges) {
    await db
      .insertInto('badges')
      .values(badge)
      .onConflict((oc) => oc.column('slug').doNothing())
      .execute();
  }

  console.log(`✅ Inserted ${defaultBadges.length} default badges`);

  // 5. Generate referral codes for existing users
  console.log('🔗 Generating referral codes for users...');

  await sql`
    UPDATE customer_users
    SET referral_code = 'GOAL-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
    WHERE deleted_at IS NULL
      AND referral_code IS NULL
  `.execute(db);

  console.log('✅ Referral codes generated');

  // 6. Create default notification templates
  console.log('📬 Creating default notification templates...');

  const defaultTemplates = [
    {
      name: 'welcome_new_user',
      title_tr: 'GoalGPT\'e Hoş Geldin! 🎉',
      title_en: 'Welcome to GoalGPT! 🎉',
      body_tr: 'Maç tahminleri, canlı skorlar ve daha fazlası için hazır!',
      body_en: 'Ready for match predictions, live scores, and more!',
      deep_link_type: 'none',
      target_audience: 'all',
      is_active: true
    },
    {
      name: 'match_starting_soon',
      title_tr: 'Maç Yakında Başlıyor! ⚽',
      title_en: 'Match Starting Soon! ⚽',
      body_tr: 'Takip ettiğin maç 15 dakika içinde başlıyor.',
      body_en: 'Your followed match starts in 15 minutes.',
      deep_link_type: 'match',
      target_audience: 'all',
      is_active: true
    },
    {
      name: 'prediction_correct',
      title_tr: 'Tebrikler! Tahminin Tuttu! 🎯',
      title_en: 'Congratulations! Your Prediction Was Correct! 🎯',
      body_tr: 'XP ve kredilerini kazandın!',
      body_en: 'You earned your XP and credits!',
      deep_link_type: 'prediction',
      target_audience: 'all',
      is_active: true
    }
  ];

  for (const template of defaultTemplates) {
    await db
      .insertInto('notification_templates')
      .values(template)
      .onConflict((oc) => oc.column('name').doNothing())
      .execute();
  }

  console.log(`✅ Created ${defaultTemplates.length} notification templates`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Data migration completed in ${elapsed}s`);

  // Summary
  const summary = await sql`
    SELECT
      (SELECT COUNT(*) FROM customer_users WHERE deleted_at IS NULL) as total_users,
      (SELECT COUNT(*) FROM customer_xp) as users_with_xp,
      (SELECT COUNT(*) FROM customer_credits) as users_with_credits,
      (SELECT COUNT(*) FROM badges WHERE deleted_at IS NULL) as total_badges,
      (SELECT COUNT(*) FROM customer_users WHERE referral_code IS NOT NULL) as users_with_referral
  `.execute(db);

  console.log('\n📊 Migration Summary:');
  console.log(`   Total Users: ${summary.rows[0].total_users}`);
  console.log(`   Users with XP: ${summary.rows[0].users_with_xp}`);
  console.log(`   Users with Credits: ${summary.rows[0].users_with_credits}`);
  console.log(`   Total Badges: ${summary.rows[0].total_badges}`);
  console.log(`   Users with Referral Code: ${summary.rows[0].users_with_referral}`);
  console.log(`   VIP Welcome Bonuses: ${bonusCount}`);
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('🔄 Rolling back data migration...');

  // Clear migrated data
  await db.deleteFrom('customer_credit_transactions')
    .where('metadata', '->', 'migration', '=', 'true')
    .execute();

  await db.deleteFrom('customer_daily_rewards').execute();
  await db.deleteFrom('customer_badges').execute();
  await db.deleteFrom('badges').execute();
  await db.deleteFrom('customer_credit_transactions').execute();
  await db.deleteFrom('customer_credits').execute();
  await db.deleteFrom('customer_xp_transactions').execute();
  await db.deleteFrom('customer_xp').execute();
  await db.deleteFrom('notification_templates').execute();

  // Clear referral codes
  await sql`
    UPDATE customer_users
    SET referral_code = NULL
    WHERE referral_code LIKE 'GOAL-%'
  `.execute(db);

  console.log('✅ Data rollback completed');
}
