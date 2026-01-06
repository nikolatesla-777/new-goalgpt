
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';
import { logger } from '../utils/logger';

// Mock logger to see output
// @ts-ignore
logger.info = console.log;
// @ts-ignore
logger.warn = console.warn;
// @ts-ignore
logger.error = console.error;

async function test() {
    console.log('--- Testing Matcher for Yangon United (Uppercase) ---');
    try {
        const result = await teamNameMatcherService.findMatchByTeams(
            'YANGON UNITED',
            'Mahar United',
            10, // minute hint
            '0-0', // score hint
            'Myanmar Professional League' // league hint
        );

        console.log('\n--- Result ---');
        console.log(JSON.stringify(result, null, 2));

        if (!result) {
            console.log('❌ No match found.');
        } else {
            console.log('✅ Match Found!');
        }

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

test();
