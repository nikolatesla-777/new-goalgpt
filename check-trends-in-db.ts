import { safeQuery } from './src/database/connection';

async function checkTrendsInMessages() {
  console.log('Checking messages 12-15 for trends section...\n');

  const messages = await safeQuery<{ telegram_message_id: number; content: string }>(
    `SELECT telegram_message_id, content
     FROM telegram_posts
     WHERE telegram_message_id IN (12, 13, 14, 15)
     ORDER BY telegram_message_id`
  );

  for (const msg of messages) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`MESSAGE ID: ${msg.telegram_message_id}`);
    console.log(`${'='.repeat(80)}`);

    const hasTrends = msg.content.includes('Trendler');
    console.log(hasTrends ? '✅ HAS TRENDS SECTION' : '❌ NO TRENDS SECTION');

    if (hasTrends) {
      // Extract trends sections
      const evMatch = msg.content.match(/🧠 <b>Trendler \(Ev\):<\/b>\n((?:• .*\n)+)/);
      const depMatch = msg.content.match(/🧠 <b>Trendler \(Dep\):<\/b>\n((?:• .*\n)+)/);

      if (evMatch) {
        console.log('\n📊 Trendler (Ev):');
        console.log(evMatch[1]);
      }

      if (depMatch) {
        console.log('📊 Trendler (Dep):');
        console.log(depMatch[1]);
      }
    } else {
      // Show what sections ARE present
      console.log('\nSections present:');
      if (msg.content.includes('İstatistikler:')) console.log('  ✓ İstatistikler');
      if (msg.content.includes('Beklenen Gol')) console.log('  ✓ Beklenen Gol (xG)');
      if (msg.content.includes('Form (Puan/Maç)')) console.log('  ✓ Form');
      if (msg.content.includes('Kafa Kafaya')) console.log('  ✓ Kafa Kafaya (H2H)');
      if (msg.content.includes('Tahmini Piyasalar:')) console.log('  ✓ Tahmini Piyasalar');
      if (msg.content.includes('Oranlar:')) console.log('  ✓ Oranlar');
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  process.exit(0);
}

checkTrendsInMessages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
