# FootyStats API Endpoint Map

## Client Methods (footystats.client.ts)

| Method | URL Path | Parameters | Returns |
|--------|----------|------------|---------|
| `getLeagueList()` | `/league-list` | - | All leagues with seasons |
| `getTodaysMatches()` | `/todays-matches` | date?, timezone? | Today's matches (summary) |
| `getMatchDetails()` | `/match` | match_id | **FULL match data** (H2H, trends, potentials) |
| `getLeagueTeams()` | `/league-teams` | season_id | Teams in a league |
| `getLeagueSeason()` | `/league-season` | season_id | League season stats |
| `getTeamLastX()` | `/lastx` | team_id | Team form (last X matches) |
| `getRefereeStats()` | `/referee` | referee_id | Referee statistics |
| `getBTTSStats()` | `/stats-data-btts` | - | BTTS top stats |
| `getOver25Stats()` | `/stats-data-over25` | - | Over 2.5 top stats |

## Routes Usage (footystats.routes.ts)

