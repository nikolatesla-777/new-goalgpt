# FootyStats API Documentation

Bu klasör FootyStats API dokümantasyonunu içerir. GoalGPT'ye betting istatistikleri (BTTS, Over/Under, Corners) eklemek için kullanılacak.

## Base URL
```
https://api.football-data-api.com/
```

## Authentication
Her istekte `?key=YOUR_API_KEY` parametresi gerekli.

## Setup the API
1. After subscribing, go to [API Settings](https://footystats.org/api/u/api-settings).
2. Note down the **API Key**. It's under the API Key section.
3. **Pick the Leagues**. Pick the leagues you would like to access. This can be changed each month. The number of leagues you can pick depends on your package.
4. Now you're ready to make calls to the API!

## Make the First API Call
Now that you have your API Key jotted down we can try the API. Just visit the following URL in any browser:
*Note - Replace "YOURKEY" with your own API Key.*
```
https://api.football-data-api.com/test-call?key=YOURKEY
```

## Endpoints

| Endpoint | Dosya | Açıklama |
|----------|-------|----------|
| `/league-list` | [league-list.md](./league-list.md) | Tüm ligler |
| `/country-list` | [country-list.md](./country-list.md) | Ülkeler |
| `/todays-matches` | [todays-matches.md](./todays-matches.md) | Günün Maçları |
| `/league-season` | [league-season.md](./league-season.md) | Lig Sezon İstatistikleri |
| `/league-matches` | [league-matches.md](./league-matches.md) | Lig Maçları |
| `/league-teams` | [league-teams.md](./league-teams.md) | Lig Takımları |
| `/league-players` | [league-players.md](./league-players.md) | Lig Oyuncuları |
| `/league-referees` | [league-referees.md](./league-referees.md) | Lig Hakemleri |
| `/team` | [team.md](./team.md) | Takım Detayları |
| `/lastx` | [team-lastx.md](./team-lastx.md) | Takım Son X Maç |
| `/match` | [match-details.md](./match-details.md) | Maç Detayları |
| `/league-tables` | [league-tables.md](./league-tables.md) | Puan Durumu |
| `/player-stats` | [player-stats.md](./player-stats.md) | Oyuncu İstatistikleri |
| `/referee` | [referee-stats.md](./referee-stats.md) | Hakem İstatistikleri |
| `/stats-data-btts` | [btts-stats.md](./btts-stats.md) | BTTS İstatistikleri |
| `/stats-data-over25` | [over25-stats.md](./over25-stats.md) | Over 2.5 İstatistikleri |

## Example Key
Test için `?key=example` kullanılabilir (sadece EPL 2018/2019 döner).

## Integration Notes
- TheSports ID'leri ile eşleştirme için mapping tablosu gerekecek
- AI tahmin kartında kullanılacak (BTTS%, Over 2.5%, PPG)
- `btts-stats` ve `over25-stats` endpointleri hazır analizler sunar
