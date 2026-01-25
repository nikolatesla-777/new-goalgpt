// Temporary test endpoint to verify trends formatting
import Fastify from 'fastify';
import { formatTelegramMessage } from './src/services/telegram/turkish.formatter';

const app = Fastify({ logger: false });

app.get('/test-format', async (request, reply) => {
  const matchData = {
    home_name: 'TEST HOME',
    away_name: 'TEST AWAY',
    league_name: 'Test League',
    date_unix: Math.floor(Date.now() / 1000),
    potentials: {
      btts: 68,
      over25: 69,
      over15: 91,
    },
    xg: {
      home: 1.85,
      away: 1.69,
    },
    form: {
      home: { ppg: null },
      away: { ppg: null },
    },
    h2h: {
      total_matches: 43,
      home_wins: 15,
      draws: 11,
      away_wins: 17,
      avg_goals: 2.7,
      btts_pct: 60,
    },
    trends: undefined,
    odds: {
      home: 1.57,
      draw: 4.20,
      away: 4.90,
    },
  };

  const picks = [
    { market_type: 'BTTS_YES' as const, odds: 1.70 },
    { market_type: 'O25_OVER' as const, odds: 1.65 },
  ];

  const confidenceScore = {
    score: 75,
    tier: 'high' as const,
    stars: 4,
    missing_fields: [],
    missingCount: 0,
  };

  const message = formatTelegramMessage(matchData, picks, confidenceScore);

  return {
    success: true,
    has_trends: message.includes('Trendler'),
    message,
  };
});

app.listen({ port: 3333, host: '0.0.0.0' }, (err) => {
  if (err) throw err;
  console.log('Test server listening on :3333');
});
