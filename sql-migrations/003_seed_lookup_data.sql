-- ============================================
-- Migration 003: Seed Lookup Data
-- TheSports API Status Codes - TR/EN Translations
-- ============================================

-- ==========================================
-- Match States (0-13)
-- ==========================================
INSERT INTO lookup_match_states (id, name_en, name_tr, is_live, is_finished) VALUES
  (0, 'Abnormal', 'Anormal', false, false),
  (1, 'Not Started', 'Başlamadı', false, false),
  (2, 'First Half', '1. Yarı', true, false),
  (3, 'Half-time', 'Devre Arası', true, false),
  (4, 'Second Half', '2. Yarı', true, false),
  (5, 'Overtime', 'Uzatma', true, false),
  (6, 'Overtime (deprecated)', 'Uzatma (eski)', true, false),
  (7, 'Penalty Shoot-out', 'Penaltılar', true, false),
  (8, 'End', 'Bitti', false, true),
  (9, 'Delay', 'Ertelendi', false, false),
  (10, 'Interrupt', 'Yarıda Kaldı', false, false),
  (11, 'Cut in Half', 'Yarıda Kesildi', false, false),
  (12, 'Cancel', 'İptal', false, true),
  (13, 'To be Determined', 'Belirlenecek', false, false)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  is_live = EXCLUDED.is_live,
  is_finished = EXCLUDED.is_finished;

-- ==========================================
-- Technical Statistics (1-37)
-- ==========================================
INSERT INTO lookup_technical_statistics (id, name_en, name_tr, is_goal_event, is_card_event) VALUES
  (1, 'Goal', 'Gol', true, false),
  (2, 'Corner', 'Korner', false, false),
  (3, 'Yellow Card', 'Sarı Kart', false, true),
  (4, 'Red Card', 'Kırmızı Kart', false, true),
  (5, 'Offside', 'Ofsayt', false, false),
  (6, 'Free Kick', 'Serbest Vuruş', false, false),
  (7, 'Goal Kick', 'Aut', false, false),
  (8, 'Penalty', 'Penaltı', false, false),
  (9, 'Substitution', 'Oyuncu Değişikliği', false, false),
  (10, 'Start', 'Başlangıç', false, false),
  (11, 'Midfield', 'Orta Saha', false, false),
  (12, 'End', 'Bitiş', false, false),
  (13, 'Halftime Score', 'İlk Yarı Skoru', false, false),
  (15, 'Card Upgrade Confirmed', 'Kart Yükseltme Onaylandı', false, true),
  (16, 'Penalty Missed', 'Penaltı Kaçtı', false, false),
  (17, 'Own Goal', 'Kendi Kalesine Gol', true, false),
  (19, 'Injury Time', 'Uzatma Dakikası', false, false),
  (21, 'Shots on Target', 'İsabetli Şut', false, false),
  (22, 'Shots off Target', 'İsabetsiz Şut', false, false),
  (23, 'Attacks', 'Atak', false, false),
  (24, 'Dangerous Attack', 'Tehlikeli Atak', false, false),
  (25, 'Ball Possession', 'Topa Sahip Olma', false, false),
  (26, 'Overtime is Over', 'Uzatma Bitti', false, false),
  (27, 'Penalty Kick Ended', 'Penaltılar Bitti', false, false),
  (28, 'VAR', 'VAR', false, false),
  (29, 'Penalty (Shoot-out)', 'Penaltı (Seri)', false, false),
  (30, 'Penalty Missed (Shoot-out)', 'Penaltı Kaçtı (Seri)', false, false),
  (37, 'Blocked Shots', 'Engellenen Şut', false, false)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  is_goal_event = EXCLUDED.is_goal_event,
  is_card_event = EXCLUDED.is_card_event;

-- ==========================================
-- Event Reasons (0-37)
-- ==========================================
INSERT INTO lookup_event_reasons (id, name_en, name_tr) VALUES
  (0, 'Unknown', 'Bilinmiyor'),
  (1, 'Foul', 'Faul'),
  (2, 'Professional Foul', 'Profesyonel Faul'),
  (3, 'Encroachment/Injury Substitution', 'İhlal/Sakatlık Değişikliği'),
  (4, 'Tactical', 'Taktiksel'),
  (5, 'Reckless Offence', 'Pervasız Hareket'),
  (6, 'Off the Ball Foul', 'Top Dışı Faul'),
  (7, 'Persistent Fouling', 'Sürekli Faul'),
  (8, 'Persistent Infringement', 'Sürekli İhlal'),
  (9, 'Violent Conduct', 'Şiddet'),
  (10, 'Dangerous Play', 'Tehlikeli Oyun'),
  (11, 'Handball', 'Elle Oynama'),
  (12, 'Serious Foul', 'Ağır Faul'),
  (13, 'Professional Foul Last Man', 'Son Adam Faulu'),
  (14, 'Denied Goal-scoring', 'Gol Şansını Engelleme'),
  (15, 'Time Wasting', 'Zaman Kaybettirme'),
  (16, 'Video Sync Done', 'Video Senkronize'),
  (17, 'Rescinded Card', 'İptal Edilen Kart'),
  (18, 'Argument', 'Tartışma'),
  (19, 'Dissent', 'İtiraz'),
  (20, 'Foul and Abusive Language', 'Faul ve Kötü Dil'),
  (21, 'Excessive Celebration', 'Aşırı Sevinç'),
  (22, 'Not Retreating', 'Geri Çekilmeme'),
  (23, 'Fight', 'Kavga'),
  (24, 'Extra Flag to Checker', 'Ek Bayrak'),
  (25, 'On Bench', 'Yedek Kulübesinde'),
  (26, 'Post Match', 'Maç Sonrası'),
  (27, 'Other Reason', 'Diğer Sebep'),
  (28, 'Unallowed Field Entering', 'İzinsiz Saha Girişi'),
  (29, 'Entering Field', 'Sahaya Giriş'),
  (30, 'Leaving Field', 'Sahadan Çıkış'),
  (31, 'Unsporting Behaviour', 'Sportmenlik Dışı'),
  (32, 'Not Visible', 'Görünmüyor'),
  (33, 'Flop', 'Düşme'),
  (34, 'Excessive Review Signal', 'Aşırı İnceleme İşareti'),
  (35, 'Entering Referee Review Area', 'VAR Alanına Giriş'),
  (36, 'Spitting', 'Tükürme'),
  (37, 'Viral', 'Viral')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- VAR Reasons (0-7)
-- ==========================================
INSERT INTO lookup_var_reasons (id, name_en, name_tr) VALUES
  (0, 'Other', 'Diğer'),
  (1, 'Goal Awarded', 'Gol Onaylandı'),
  (2, 'Goal Not Awarded', 'Gol Onaylanmadı'),
  (3, 'Penalty Awarded', 'Penaltı Verildi'),
  (4, 'Penalty Not Awarded', 'Penaltı Verilmedi'),
  (5, 'Red Card Given', 'Kırmızı Kart Verildi'),
  (6, 'Card Upgrade', 'Kart Yükseltme'),
  (7, 'Mistaken Identity', 'Yanlış Oyuncu')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- VAR Results (0-10)
-- ==========================================
INSERT INTO lookup_var_results (id, name_en, name_tr) VALUES
  (0, 'Unknown', 'Bilinmiyor'),
  (1, 'Goal Confirmed', 'Gol Onaylandı'),
  (2, 'Goal Cancelled', 'Gol İptal'),
  (3, 'Penalty Confirmed', 'Penaltı Onaylandı'),
  (4, 'Penalty Cancelled', 'Penaltı İptal'),
  (5, 'Red Card Confirmed', 'Kırmızı Kart Onaylandı'),
  (6, 'Red Card Cancelled', 'Kırmızı Kart İptal'),
  (7, 'Card Upgrade Confirmed', 'Kart Yükseltme Onaylandı'),
  (8, 'Card Upgrade Cancelled', 'Kart Yükseltme İptal'),
  (9, 'Original Decision', 'Orijinal Karar'),
  (10, 'Original Decision Changed', 'Karar Değiştirildi')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- Data Update Types (1-11)
-- ==========================================
INSERT INTO lookup_data_update_types (id, name_en, name_tr, uses_match_id, uses_season_id) VALUES
  (1, 'Single Match Lineup', 'Tek Maç Kadrosu', true, false),
  (2, 'Bracket', 'Turnuva Şeması', false, true),
  (3, 'Season Standing', 'Sezon Puan Durumu', false, true),
  (4, 'Season Team Statistics', 'Sezon Takım İstatistikleri', false, true),
  (5, 'Season Player Statistics', 'Sezon Oyuncu İstatistikleri', false, true),
  (6, 'Season Top Scorer', 'Sezon Gol Krallığı', false, true),
  (7, 'FIFA Men', 'FIFA Erkekler', false, false),
  (8, 'FIFA Women', 'FIFA Kadınlar', false, false),
  (9, 'World Clubs Ranking', 'Dünya Kulüpler Sıralaması', false, false),
  (10, 'Match Incident GIF', 'Maç Olayı GIF', true, false),
  (11, 'Match Goal Line', 'Maç Gol Çizgisi', true, false)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  uses_match_id = EXCLUDED.uses_match_id,
  uses_season_id = EXCLUDED.uses_season_id;

-- ==========================================
-- Competition Types (0-3)
-- ==========================================
INSERT INTO lookup_competition_types (id, name_en, name_tr) VALUES
  (0, 'Unknown', 'Bilinmiyor'),
  (1, 'League', 'Lig'),
  (2, 'Cup', 'Kupa'),
  (3, 'Friendly', 'Hazırlık Maçı')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- Gender (1-2)
-- ==========================================
INSERT INTO lookup_genders (id, name_en, name_tr) VALUES
  (1, 'Male', 'Erkek'),
  (2, 'Female', 'Kadın')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- Player Positions (F, M, D, G)
-- ==========================================
INSERT INTO lookup_player_positions (code, name_en, name_tr, color) VALUES
  ('F', 'Forward', 'Forvet', '#e74c3c'),
  ('M', 'Midfielder', 'Orta Saha', '#3498db'),
  ('D', 'Defender', 'Defans', '#2ecc71'),
  ('G', 'Goalkeeper', 'Kaleci', '#f39c12')
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  color = EXCLUDED.color;

-- ==========================================
-- Player Detailed Positions
-- ==========================================
INSERT INTO lookup_player_detailed_positions (code, name_en, name_tr, general_position) VALUES
  ('LW', 'Left Forward', 'Sol Kanat', 'F'),
  ('RW', 'Right Forward', 'Sağ Kanat', 'F'),
  ('ST', 'Striker', 'Forvet', 'F'),
  ('AM', 'Attacking Midfielder', 'Ofansif Orta Saha', 'M'),
  ('ML', 'Left Midfielder', 'Sol Orta Saha', 'M'),
  ('MC', 'Center Midfielder', 'Merkez Orta Saha', 'M'),
  ('MR', 'Right Midfielder', 'Sağ Orta Saha', 'M'),
  ('DM', 'Defensive Midfielder', 'Defansif Orta Saha', 'M'),
  ('DL', 'Left Back', 'Sol Bek', 'D'),
  ('DC', 'Center Back', 'Stoper', 'D'),
  ('DR', 'Right Back', 'Sağ Bek', 'D'),
  ('GK', 'Goalkeeper', 'Kaleci', 'G')
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  general_position = EXCLUDED.general_position;

-- ==========================================
-- Player Ability Types (1-9)
-- ==========================================
INSERT INTO lookup_player_ability_types (id, name_en, name_tr, is_goalkeeper_specific) VALUES
  (1, 'Save', 'Kurtarış', true),
  (2, 'Pre-judgment', 'Öngörü', false),
  (3, 'Handling', 'Top Kontrolü', false),
  (4, 'Air', 'Hava Topu', false),
  (5, 'Tactics', 'Taktik', false),
  (6, 'Attack', 'Hücum', false),
  (7, 'Defense', 'Savunma', false),
  (8, 'Creativity', 'Yaratıcılık', false),
  (9, 'Technology', 'Teknik', false)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  is_goalkeeper_specific = EXCLUDED.is_goalkeeper_specific;

-- ==========================================
-- Preferred Foot (0-3)
-- ==========================================
INSERT INTO lookup_preferred_foot (id, name_en, name_tr) VALUES
  (0, 'Unknown', 'Bilinmiyor'),
  (1, 'Left', 'Sol'),
  (2, 'Right', 'Sağ'),
  (3, 'Both', 'Her İkisi')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- Coach Types (1-2)
-- ==========================================
INSERT INTO lookup_coach_types (id, name_en, name_tr) VALUES
  (1, 'Head Coach', 'Teknik Direktör'),
  (2, 'Interim', 'Geçici Teknik Direktör')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- Stage Modes (1-2)
-- ==========================================
INSERT INTO lookup_stage_modes (id, name_en, name_tr) VALUES
  (1, 'Points', 'Puan Sistemi'),
  (2, 'Elimination', 'Eleme Sistemi')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- ==========================================
-- Player Characteristics (1-43)
-- ==========================================
INSERT INTO lookup_player_characteristics (id, name_en, name_tr, is_negative) VALUES
  (1, 'Unloading', 'Topu Bırakma', false),
  (2, 'Penalty Kick', 'Penaltı', false),
  (3, 'Direct Free Kick', 'Direkt Serbest Vuruş', false),
  (4, 'Long Shot', 'Uzun Şut', false),
  (5, 'Single Shot', 'Tek Vuruş', false),
  (6, 'Pass', 'Pas', false),
  (7, 'Organize Attack', 'Atak Organizasyonu', false),
  (8, 'Dribble', 'Dribling', false),
  (9, 'Interrupt Ball', 'Top Kesme', false),
  (10, 'Tackle', 'Müdahale', false),
  (11, 'Stability', 'İstikrar', false),
  (12, 'Excellent', 'Mükemmellik', false),
  (13, 'Long Pass', 'Uzun Pas', false),
  (14, 'Ball Control', 'Top Kontrolü', false),
  (15, 'Air Confrontation', 'Hava Mücadelesi', false),
  (16, 'Ground Confrontation', 'Yer Mücadelesi', false),
  (17, 'Error Tendency', 'Hata Eğilimi', true),
  (18, 'Discipline', 'Disiplin', false),
  (19, 'Punch Penalty', 'Yumruk Cezası', false),
  (20, 'Reaction', 'Reaksiyon', false),
  (21, 'Abandon Goal', 'Kaleyi Terk', false),
  (22, 'High Ball Interception', 'Yüksek Top Kesme', false),
  (23, 'Handle Ball', 'Top Tutma', false),
  (24, 'Long Shots', 'Uzun Şutlar', false),
  (25, 'Stance', 'Duruş', false),
  (26, 'High Pressing', 'Yüksek Pres', false),
  (27, 'Long Shots Save', 'Uzun Şut Kurtarma', false),
  (28, 'Crossing', 'Orta Yapma', false),
  (29, 'Offside Awareness', 'Ofsayt Bilinci', false),
  (30, 'Close Shot Saves', 'Yakın Şut Kurtarma', false),
  (31, 'Concentration', 'Konsantrasyon', false),
  (32, 'Defensive Participation', 'Savunma Katılımı', false),
  (33, 'Key Pass', 'Kilit Pas', false),
  (34, 'Header', 'Kafa Vuruşu', false),
  (35, 'Set Piece', 'Duran Top', false),
  (36, 'Straight Pass', 'Düz Pas', false),
  (37, 'Counter Attack', 'Kontra Atak', false),
  (38, 'One Kick', 'Tek Vuruş', false),
  (39, 'Up High Ball', 'Yükselen Top', false),
  (40, 'Fouling', 'Faul Yapma', true),
  (41, 'Inward Cut', 'İçe Kesme', false),
  (42, 'Punches', 'Yumruklar', false),
  (43, 'Clearance', 'Uzaklaştırma', false)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  is_negative = EXCLUDED.is_negative;

-- ==========================================
-- Half-time Statistics (Key ones: 1-83)
-- ==========================================
INSERT INTO lookup_halftime_statistics (id, name_en, name_tr) VALUES
  (1, 'Goal', 'Gol'),
  (2, 'Corner', 'Korner'),
  (3, 'Yellow Card', 'Sarı Kart'),
  (4, 'Red Card', 'Kırmızı Kart'),
  (5, 'Offside', 'Ofsayt'),
  (6, 'Free Kick', 'Serbest Vuruş'),
  (7, 'Goal Kick', 'Aut'),
  (8, 'Penalty', 'Penaltı'),
  (9, 'Substitution', 'Değişiklik'),
  (15, 'Card Upgrade', 'Kart Yükseltme'),
  (16, 'Penalty Missed', 'Penaltı Kaçtı'),
  (17, 'Own Goal', 'Kendi Kalesine'),
  (21, 'Shots on Target', 'İsabetli Şut'),
  (22, 'Shots off Target', 'İsabetsiz Şut'),
  (23, 'Attacks', 'Atak'),
  (24, 'Dangerous Attack', 'Tehlikeli Atak'),
  (25, 'Ball Possession', 'Topa Sahip Olma'),
  (33, 'Dribble', 'Dribling'),
  (34, 'Dribble Success', 'Başarılı Dribling'),
  (36, 'Clearances', 'Uzaklaştırma'),
  (37, 'Blocked Shots', 'Engellenen Şut'),
  (38, 'Intercept', 'Top Kesme'),
  (39, 'Tackles', 'Müdahale'),
  (40, 'Pass', 'Pas'),
  (41, 'Pass Success', 'Başarılı Pas'),
  (42, 'Key Passes', 'Kilit Pas'),
  (43, 'Cross', 'Orta'),
  (44, 'Cross Success', 'Başarılı Orta'),
  (45, 'Long Pass', 'Uzun Pas'),
  (46, 'Long Pass Success', 'Başarılı Uzun Pas'),
  (48, '1v1 Success', '1e1 Başarılı'),
  (49, 'Pass Broken', 'Kesilen Pas'),
  (51, 'Fouls', 'Faul'),
  (52, 'Save', 'Kurtarış'),
  (53, 'Punches', 'Yumruk'),
  (54, 'GK Strikes', 'Kaleci Çıkışı'),
  (55, 'GK Strikes Success', 'Başarılı Kaleci Çıkışı'),
  (56, 'High Altitude Attack', 'Yüksek Atak'),
  (61, '1v1 Failed', '1e1 Başarısız'),
  (63, 'Free Kick (Half)', 'Serbest Vuruş'),
  (65, 'Free Kick Goal', 'Serbest Vuruş Golü'),
  (69, 'Hit Woodwork', 'Direkten Dönen'),
  (70, 'Fast Break', 'Hızlı Atak'),
  (71, 'Fast Break Shot', 'Hızlı Atak Şutu'),
  (72, 'Fast Break Goal', 'Hızlı Atak Golü'),
  (78, 'Lost the Ball', 'Top Kaybı'),
  (79, 'Win Aerial Duel', 'Kazanılan Hava Topu'),
  (80, 'Lose Aerial Duel', 'Kaybedilen Hava Topu'),
  (81, 'Win Ground Duel', 'Kazanılan Yer Mücadelesi'),
  (82, 'Lose Ground Duel', 'Kaybedilen Yer Mücadelesi'),
  (83, 'Shots', 'Şut')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr;

-- Done!
SELECT 'All lookup data seeded successfully!' as status;
