const fs = require('fs');
try {
    const content = fs.readFileSync('/root/diary_20251228.json', 'utf8');
    const data = JSON.parse(content);
    const matches = data.results || [];

    // Search for match with both teams
    const target = matches.find(m => {
        const home = m.home_team_id;
        const away = m.away_team_id;
        // Sunderland: p3glrw7he6gqdyj
        // Leeds: gx7lm7phdv4m2wd
        return (home === 'p3glrw7he6gqdyj' || home === 'gx7lm7phdv4m2wd') &&
            (away === 'p3glrw7he6gqdyj' || away === 'gx7lm7phdv4m2wd');
    });

    if (target) {
        console.log(JSON.stringify(target, null, 2));
    } else {
        console.log('Match not found.');
    }
} catch (e) {
    console.error(e);
}
