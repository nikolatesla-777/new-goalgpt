/**
 * Admin Bot Rules Page
 * Manage bot assignment rules and view performance stats
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Robot, TrendUp, CheckCircle, XCircle, Clock, WarningCircle, Code, Lightning } from '@phosphor-icons/react';
import { useBotStats } from '../../hooks/useBotStats';
import './admin.css';

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || '';

interface BotRule {
    id: string;
    bot_group_id: string | null;
    bot_display_name: string;
    minute_from: number | null;
    minute_to: number | null;
    prediction_type_pattern: string | null;
    priority: number;
    is_active: boolean;
    created_at: string;
}

// Default Bots strictly requested by User
// These will be displayed if the database result is empty or merged with it
const REQUIRED_BOTS: BotRule[] = [
    {
        id: 'default-alert-system',
        bot_group_id: 'manual',
        bot_display_name: 'Alert System',
        minute_from: null,
        minute_to: null,
        prediction_type_pattern: 'Manuel',
        priority: 100,
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'default-alert-d',
        bot_group_id: 'alert-d',
        bot_display_name: 'Alert D',
        minute_from: 1,
        minute_to: 15,
        prediction_type_pattern: null,
        priority: 90,
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'default-bot-007',
        bot_group_id: 'bot-007',
        bot_display_name: 'BOT 007',
        minute_from: null,
        minute_to: null,
        prediction_type_pattern: null,
        priority: 85,
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'default-algoritma-01',
        bot_group_id: 'algo-01',
        bot_display_name: 'Algoritma 01', // Request was Code Zero but this exists too
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 80,
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'default-code-35',
        bot_group_id: 'code-35',
        bot_display_name: 'Code 35',
        minute_from: 35,
        minute_to: 45,
        prediction_type_pattern: null,
        priority: 70,
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'default-code-zero',
        bot_group_id: 'code-zero',
        bot_display_name: 'Code Zero',
        minute_from: 0,
        minute_to: 90,
        prediction_type_pattern: null,
        priority: 60,
        is_active: true,
        created_at: new Date().toISOString()
    }
];

export function AdminBots() {
    const navigate = useNavigate();
    const { stats } = useBotStats(); // Removed loading: statsLoading
    const [rules, setRules] = useState<BotRule[]>(REQUIRED_BOTS);
    // Removed rulesLoading

    // Fetch Rules from DB
    useEffect(() => {
        const fetchRules = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/predictions/rules`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && Array.isArray(data.rules) && data.rules.length > 0) {
                        // Merge logic: Use DB rules, but ensure REQUIRED_BOTS are present if missing
                        const merged = [...data.rules];

                        REQUIRED_BOTS.forEach(reqBot => {
                            const exists = merged.some(
                                r => r.bot_display_name.toLowerCase() === reqBot.bot_display_name.toLowerCase()
                            );
                            if (!exists) {
                                merged.push(reqBot);
                            }
                        });

                        setRules(merged);
                    } else {
                        // API empty? Keep defaults.
                        console.log("No rules from API, using defaults.");
                    }
                }
            } catch (error) {
                console.error("Failed to fetch bot rules:", error);
            }
        };

        fetchRules();
    }, []);

    // Helper to find stats for a rule
    const getStatsForRule = (ruleName: string) => {
        if (!stats) return null;
        // Try exact match
        let found = stats.bots.find(b => b.bot_name === ruleName);
        if (!found) {
            // Try normalized match (case insensitive)
            found = stats.bots.find(b => b.bot_name.toLowerCase() === ruleName.toLowerCase());
        }
        return found;
    };

    // Helper to get Icon
    const getBotIcon = (name: string, isActive: boolean) => {
        const n = name.toLowerCase();
        const className = isActive ? "text-blue-500" : "text-gray-500";

        if (n.includes('alert system')) return <WarningCircle size={24} weight="duotone" className="text-red-500" />;
        if (n.includes('alert')) return <Lightning size={24} weight="duotone" className="text-yellow-500" />;
        if (n.includes('code')) return <Code size={24} weight="duotone" className="text-green-500" />;

        return <Robot size={24} weight="duotone" className={className} />;
    };

    return (
        // Enforce dark background for Premium look
        <div className="min-h-screen bg-[#090909] text-white p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Bot Yönetimi</h1>
                        <p className="text-gray-400">Yapay zeka botlarının performans ve kural yönetimi</p>
                    </div>
                    <button className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2">
                        <Robot size={20} weight="bold" />
                        Yeni Kural Ekle
                    </button>
                </header>

                {/* Global Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendUp size={64} weight="duotone" className="text-blue-500" />
                        </div>
                        <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Toplam Tahmin</div>
                        <div className="text-3xl font-black text-white">{stats?.global.total_predictions || 0}</div>
                        <div className="mt-2 text-xs text-gray-500">Geçmiş Veriler</div>
                    </div>

                    <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-green-500/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CheckCircle size={64} weight="duotone" className="text-green-500" />
                        </div>
                        <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Başarılı</div>
                        <div className="text-3xl font-black text-green-500">{stats?.global.wins || 0}</div>
                        <div className="mt-2 text-xs text-green-500/50">+{((stats?.global.wins || 0) / ((stats?.global.wins || 0) + (stats?.global.losses || 0) || 1) * 100).toFixed(0)}% Olasılık</div>
                    </div>

                    <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-red-500/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <XCircle size={64} weight="duotone" className="text-red-500" />
                        </div>
                        <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Başarısız</div>
                        <div className="text-3xl font-black text-red-500">{stats?.global.losses || 0}</div>
                        <div className="mt-2 text-xs text-red-500/50">Risk analizi yapılıyor</div>
                    </div>

                    <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-yellow-500/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Clock size={64} weight="duotone" className="text-yellow-500" />
                        </div>
                        <div className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Bekleyen</div>
                        <div className="text-3xl font-black text-yellow-500">{stats?.global.pending || 0}</div>
                        <div className="mt-2 text-xs text-yellow-500/50">Sonuçlanmamış</div>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                    Aktif Bot Grupları
                </h2>

                {/* Bot Rules Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Always using rules array, which is initialized with REQUIRED_BOTS */}
                    {rules.sort((a, b) => b.priority - a.priority).map((rule) => {
                        const botStats = getStatsForRule(rule.bot_display_name);

                        return (
                            <div
                                key={rule.id}
                                onClick={() => navigate(`/admin/bots/${encodeURIComponent(rule.bot_display_name)}`)}
                                className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer group hover:-translate-y-1"
                            >
                                {/* Card Header */}
                                <div className="p-6 border-b border-white/5 flex items-start justify-between bg-white/[0.02]">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-gray-900 to-black border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                            {getBotIcon(rule.bot_display_name, rule.is_active)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{rule.bot_display_name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                                    PRIORITY: {rule.priority}
                                                </span>
                                                {(rule.minute_from !== null || rule.minute_to !== null) && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{rule.minute_from ?? '0'}' - {rule.minute_to ?? '90'}'</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                </div>

                                {/* Card Stats */}
                                <div className="p-6">
                                    <>
                                        {/* Success Rate Visual */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-400">Başarı Oranı</span>
                                            <span className={`text-xl font-black ${(botStats?.win_rate || 0) >= 70 ? 'text-green-500' :
                                                (botStats?.win_rate || 0) >= 50 ? 'text-yellow-500' : 'text-red-500'
                                                }`}>
                                                %{botStats?.win_rate || 0}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-6">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${(botStats?.win_rate || 0) >= 70 ? 'bg-green-500' :
                                                    (botStats?.win_rate || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${Math.max(5, botStats?.win_rate || 0)}%` }}
                                            />
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors">
                                                <div className="text-white font-bold">{botStats?.wins || 0}</div>
                                                <div className="text-[10px] text-green-500 uppercase font-bold">WINS</div>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors">
                                                <div className="text-white font-bold">{botStats?.losses || 0}</div>
                                                <div className="text-[10px] text-red-500 uppercase font-bold">LOSS</div>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors">
                                                <div className="text-white font-bold">{botStats?.total_predictions || 0}</div>
                                                <div className="text-[10px] text-gray-500 uppercase font-bold">TOTAL</div>
                                            </div>
                                        </div>
                                    </>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
