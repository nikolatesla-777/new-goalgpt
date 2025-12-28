const fs = require('fs');
try {
    const content = fs.readFileSync('/root/diary_20251228.json', 'utf8');
    const data = JSON.parse(content);
    const matches = data.results || [];

    // Search for Sunderland loosely
    const target = matches.find(m => {
        const h = (m.home_team && m.home_team.name) || '';
        const a = (m.away_team && m.away_team.name) || '';
        return h.includes('Sunderland') || a.includes('Sunderland');
    });

    if (target) {
        console.log(JSON.stringify(target, null, 2));
    } else {
        console.log('Match with Sunderland not found in ' + matches.length + ' matches.');
        // Print first match to see structure
        if (matches.length > 0) console.log('Sample:', JSON.stringify(matches[0], null, 2));
    }
} catch (e) {
    console.error(e);
}
