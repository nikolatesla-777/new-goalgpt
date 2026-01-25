#!/bin/bash
# Run Telegram tables migration

npx tsx -e "
import { up } from './src/database/migrations/004-create-telegram-tables.ts';
import { db } from './src/database/kysely';

up(db).then(() => {
  console.log('✅ Telegram tables migration completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
"
