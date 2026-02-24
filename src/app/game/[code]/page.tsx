"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Gamepad2, Users, Loader2, Send, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = 'lobby' | 'question' | 'voting' | 'reveal' | 'finance-duel';

export default function GamePage() {
    const { code } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { socket, connected } = useSocket();
    const [phase, setPhase] = useState<Phase>('lobby');
    const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);
    const [localPlayerName, setLocalPlayerName] = useState(searchParams.get("name") || "");
    const [isJoined, setIsJoined] = useState(false);
    const [question, setQuestion] = useState<string>("");
    const [isImposter, setIsImposter] = useState(false);
    const [answer, setAnswer] = useState("");
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [votes, setVotes] = useState<Record<string, number>>({});
    const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
    const [votedPlayers, setVotedPlayers] = useState<string[]>([]);
    const [imposterId, setImposterId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVoting, setIsVoting] = useState(false);
    const [gameType, setGameType] = useState<string>("who-is-lying");
    const [currentRound, setCurrentRound] = useState(1);
    const [maxRounds, setMaxRounds] = useState(1);
    const [isLastRound, setIsLastRound] = useState(false);
    // Finance State
    const [market, setMarket] = useState<Record<string, { price: number, history: number[] }>>({});
    const [portfolio, setPortfolio] = useState<{ balance: number, assets: Record<string, number> }>({ balance: 0, assets: {} });
    const [timeLeft, setTimeLeft] = useState(0);
    const [rankings, setRankings] = useState<any[]>([]);
    const [news, setNews] = useState<{ message: string, symbol?: string, impact: number, time: number }[]>([]);
    const [limitOrders, setLimitOrders] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'market' | 'orders'>('market');
    const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
    const [orderMode, setOrderMode] = useState<'market' | 'limit'>('market');
    const [targetPrice, setTargetPrice] = useState<string>("");
    const [orderAmount, setOrderAmount] = useState<string>("1");
    const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC");
    const [notifications, setNotifications] = useState<{ id: string, message: string }[]>([]);

    useEffect(() => {
        if (socket && connected && code && localPlayerName && isJoined) {
            socket.emit("join-lobby", { lobbyCode: code, playerName: localPlayerName });

            socket.on("player-joined", ({ players }: { players: { id: string, name: string }[] }) => {
                setPlayers(players);
            });

            socket.on("game-started", ({ gameType: incomingType, imposterId, normalQuestion, imposterQuestion, question: incomingQuestion, currentRound: curRound, maxRounds: maxRoundsVal, market: initialMarket, portfolios }: {
                gameType: string,
                imposterId?: string,
                normalQuestion?: string,
                imposterQuestion?: string,
                question?: string,
                currentRound?: number,
                maxRounds?: number,
                market?: any,
                portfolios?: any
            }) => {
                setGameType(incomingType);
                setAnsweredPlayers([]);
                setVotedPlayers([]);
                setAnswers({});
                setVotes({});
                setIsSubmitting(false);
                setIsVoting(false);
                setIsLastRound(false);
                if (curRound) setCurrentRound(curRound);
                if (maxRoundsVal) setMaxRounds(maxRoundsVal);

                if (incomingType === 'who-is-lying') {
                    setPhase('question');
                    const isNowImposter = socket.id === imposterId;
                    setIsImposter(isNowImposter);
                    setImposterId(imposterId || null);
                    setQuestion(isNowImposter ? imposterQuestion! : normalQuestion!);
                } else if (incomingType === 'most-likely') {
                    setPhase('voting');
                    setQuestion(incomingQuestion!);
                } else if (incomingType === 'finance-duel') {
                    setPhase('finance-duel');
                    if (initialMarket) setMarket(initialMarket);
                    const socketId = socket?.id;
                    if (socketId && portfolios && portfolios[socketId]) {
                        setPortfolio(portfolios[socketId]);
                    }
                }
            });

            socket.on("market-update", ({ market, timeLeft, portfolios, news: incomingNews, limitOrders: incomingOrders }: { market: any, timeLeft: number, portfolios: any, news?: any[], limitOrders?: any[] }) => {
                setMarket(market);
                setTimeLeft(timeLeft);
                if (portfolios && socket.id && portfolios[socket.id]) setPortfolio(portfolios[socket.id]);
                if (incomingNews) setNews(incomingNews);
                if (incomingOrders) {
                    setLimitOrders(incomingOrders.filter((o: any) => o.userId === socket.id));
                }
            });

            socket.on("news-alert", (newsItem: any) => {
                addNotification(newsItem.message);
            });

            socket.on("portfolio-update", ({ portfolio, message }: { portfolio: any, message?: string }) => {
                setPortfolio(portfolio);
                if (message) addNotification(message);
            });

            socket.on("order-placed", ({ order }: { order: any }) => {
                addNotification(`Limit-Order platziert: ${order.type === 'buy' ? 'Kauf' : 'Verkauf'} ${order.amount} ${order.symbol} @ $${order.targetPrice}`);
            });

            socket.on("answer-submitted", ({ playerId, answer }: { playerId: string, answer: string }) => {
                setAnsweredPlayers((prev: string[]) => [...new Set([...prev, playerId])]);
            });

            socket.on("all-answered", ({ answers }: { answers: Record<string, string> }) => {
                setAnswers(answers);
                setPhase('voting');
                setAnsweredPlayers([]);
            });

            socket.on("player-voted", ({ voterId }: { voterId: string }) => {
                setVotedPlayers((prev: string[]) => [...new Set([...prev, voterId])]);
            });

            socket.on("reveal", ({ imposterId, votes, answers, isLastRound: lastRound, gameType: gType, rankings: finalRankings, market: finalMarket }: { imposterId: string, votes: Record<string, string>, answers: Record<string, string>, isLastRound?: boolean, gameType?: string, rankings?: any[], market?: any }) => {
                setPhase('reveal');
                if (gType === 'finance-duel') {
                    setRankings(finalRankings || []);
                    setMarket(finalMarket || {});
                    setIsLastRound(true);
                    return;
                }
                setImposterId(imposterId);
                setIsImposter(socket.id === imposterId);
                setAnswers(answers);
                if (lastRound !== undefined) setIsLastRound(lastRound);
                // Calculate vote counts (results)
                const counts: Record<string, number> = {};
                Object.values(votes as Record<string, string>).forEach(votedId => {
                    counts[votedId] = (counts[votedId] || 0) + 1;
                });
                setVotes(counts);
            });

            socket.on("error", ({ message }: { message: string }) => {
                alert(message);
                if (message === "Name already taken") {
                    router.push("/");
                }
            });
        }

        return () => {
            socket?.off("player-joined");
            socket?.off("game-started");
            socket?.off("answer-submitted");
            socket?.off("all-answered");
            socket?.off("reveal");
        };
    }, [socket, connected, code, localPlayerName, isJoined]);

    const handleJoinClick = (e: React.FormEvent) => {
        e.preventDefault();
        if (localPlayerName.trim()) {
            setIsJoined(true);
        }
    };

    const submitAnswer = () => {
        if (socket && answer && !isSubmitting) {
            setIsSubmitting(true);
            socket.emit("submit-answer", { lobbyCode: code, answer });
        }
    };

    const votePlayer = (playerId: string) => {
        if (socket && !isVoting) {
            setIsVoting(true);
            socket.emit("vote-player", { lobbyCode: code, votedPlayerId: playerId });
        }
    };

    const buyAsset = (symbol: string, amount: number) => {
        if (socket && code) {
            socket.emit("buy-asset", { lobbyCode: code, symbol, amount });
        }
    };

    const sellAsset = (symbol: string, amount: number) => {
        if (socket && code) {
            socket.emit("sell-asset", { lobbyCode: code, symbol, amount });
        }
    };

    const placeLimitOrder = () => {
        if (socket && code && targetPrice && orderAmount) {
            socket.emit("set-limit-order", {
                lobbyCode: code,
                symbol: selectedSymbol,
                type: orderType,
                targetPrice: parseFloat(targetPrice),
                amount: parseInt(orderAmount)
            });
            setTargetPrice("");
        }
    };

    const cancelLimitOrder = (orderId: string) => {
        if (socket && code) {
            socket.emit("cancel-limit-order", { lobbyCode: code, orderId });
        }
    };

    const addNotification = (message: string) => {
        const id = Math.random().toString(36).substring(7);
        setNotifications((prev: any[]) => [...prev, { id, message }]);
        setTimeout(() => {
            setNotifications((prev: any[]) => prev.filter((n: any) => n.id !== id));
        }, 5000);
    };

    if (!isJoined) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md kahoot-card"
                >
                    <div className="flex justify-center mb-6">
                        <div className="p-4 rounded-2xl bg-white/10 shadow-inner">
                            <Gamepad2 size={48} className="text-white" />
                        </div>
                    </div>

                    <h1 className="kahoot-title text-center mb-2">Beitritt zu {code}</h1>
                    <p className="text-white/50 text-center mb-8 font-medium">Gib deinen Spitznamen ein, um dem Spiel beizutreten.</p>

                    <form onSubmit={handleJoinClick} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/50 uppercase ml-1">Spitzname</label>
                            <input
                                type="text"
                                placeholder="Dein Name"
                                className="kahoot-input"
                                value={localPlayerName}
                                onChange={(e) => setLocalPlayerName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <button type="submit" className="w-full kahoot-button text-xl uppercase tracking-wider">
                            Dem Spiel beitreten
                        </button>
                    </form>
                </motion.div>
            </main>
        );
    }

    if (phase === 'lobby') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="kahoot-card w-full max-w-md"
                >
                    <div className="flex justify-center mb-6">
                        <Loader2 size={48} className="text-indigo-400 animate-spin" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Lobby beigetreten</h2>
                    <p className="text-white/50 mb-8 font-medium">Warte auf den Host, um das Spiel zu starten...</p>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2">
                        <Users size={20} className="text-indigo-400" />
                        <span className="text-white font-bold">{players.length} Spieler verbunden</span>
                    </div>
                </motion.div>
            </main>
        );
    }

    if (phase === 'question') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-4xl kahoot-card p-12 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />

                    <div className="mb-8 text-center">
                        <motion.h1
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-5xl font-[1000] uppercase tracking-tighter mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 italic"
                        >
                            Wer ist der Imposter?
                        </motion.h1>
                        <span className="px-4 py-1 rounded-full bg-indigo-500 text-[10px] font-black uppercase tracking-widest text-white mb-4 inline-block">
                            Runde {currentRound} von {maxRounds}
                        </span>
                        <h2 className="text-4xl font-black text-white leading-tight mt-4">
                            {question}
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {!answeredPlayers.includes(socket?.id || "") ? (
                            <>
                                <textarea
                                    className="kahoot-input min-h-[120px] resize-none text-xl p-6"
                                    placeholder="Deine Antwort hier eingeben..."
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                />
                                <button
                                    onClick={submitAnswer}
                                    disabled={!answer || isSubmitting}
                                    className={`w-full kahoot-button flex items-center justify-center gap-2 text-xl transition-all ${(!answer || isSubmitting) ? 'opacity-50 cursor-not-allowed grayscale scale-95' : 'hover:scale-105 active:scale-95'
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="animate-spin" size={24} />
                                    ) : (
                                        <Send size={24} />
                                    )}
                                    {isSubmitting ? "Wird gesendet..." : "Antwort senden"}
                                </button>
                            </>
                        ) : (
                            <div className="p-8 rounded-2xl bg-green-500/20 border border-green-500/30 text-center">
                                <Check size={32} className="text-green-400 mx-auto mb-4" />
                                <p className="text-white font-bold text-xl">Antwort gesendet!</p>
                                <p className="text-white/60 text-sm mt-2 font-medium">Warte auf die anderen Spieler...</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-2">
                        {players.map(p => (
                            <div key={p.id} className="flex items-center gap-2 text-white/60 text-sm">
                                <div className={`w-3 h-3 rounded-full ${answeredPlayers.includes(p.id) ? 'bg-green-500' : 'bg-white/10'}`} />
                                <span className={answeredPlayers.includes(p.id) ? 'text-white' : ''}>{p.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </main>
        );
    }

    if (phase === 'voting') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full max-w-4xl"
                >
                    <div className="text-center mb-12">
                        <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">
                            {gameType === 'most-likely' ? question : 'Wer ist der Imposter?'}
                        </h2>
                        <p className="text-white/60 text-xl font-medium">
                            Runde {currentRound} von {maxRounds} • {gameType === 'most-likely' ? 'Stimme für die Person ab, die am ehesten passt!' : 'Lies die Antworten und stimme für den Imposter ab!'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {players.map((player) => {
                            const hasVoted = votedPlayers.includes(player.id);
                            return (
                                <motion.button
                                    key={player.id}
                                    whileHover={(player.id !== socket?.id && !isVoting && !votedPlayers.includes(socket?.id || "")) ? { scale: 1.02 } : {}}
                                    whileTap={(player.id !== socket?.id && !isVoting && !votedPlayers.includes(socket?.id || "")) ? { scale: 0.98 } : {}}
                                    onClick={() => player.id !== socket?.id && !isVoting && votePlayer(player.id)}
                                    disabled={votedPlayers.includes(socket?.id || "") || player.id === socket?.id || isVoting}
                                    className={`kahoot-card text-left group transition-all overflow-hidden relative ${votedPlayers.includes(socket?.id || "") ? 'opacity-80' : 'hover:border-white/40 border-transparent hover:-translate-y-1'
                                        } ${player.id === socket?.id ? 'border-indigo-500/50 grayscale-[0.5] cursor-default' : ''} ${votedPlayers.includes(socket?.id || "") && !hasVoted ? 'grayscale shadow-none scale-95' : ''
                                        } ${hasVoted ? 'border-green-500 ring-2 ring-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : ''}`}
                                >
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-white/40 uppercase block">Antwort von {player.name}</span>
                                            {hasVoted && (
                                                <span className="bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shadow-lg shadow-green-900/40">
                                                    Abgestimmt ✅
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-2xl font-bold leading-tight group-hover:text-indigo-300 transition-colors">
                                            {gameType === 'most-likely' ? player.name : `"${answers[player.id] || "Überlegt noch..."}"`}
                                        </p>
                                    </div>
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Users className="text-white/20" size={32} />
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>
            </main>
        );
    }


    if (phase === 'finance-duel') {
        const netWorth = portfolio.balance + Object.entries(portfolio.assets).reduce((acc: number, [sym, amt]: [string, any]) => {
            return acc + (amt * (market[sym]?.price || 0));
        }, 0);

        return (
            <main className="flex min-h-screen flex-col p-4 md:p-8 bg-slate-950 text-white gap-6">
                {/* Notifications */}
                <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                    <AnimatePresence>
                        {notifications.map(n => (
                            <motion.div
                                key={n.id}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-indigo-600 border border-indigo-400 p-4 rounded-2xl shadow-2xl text-white font-bold text-xs pointer-events-auto"
                            >
                                {n.message}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 gap-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Portfoliowert</p>
                            <h2 className="text-3xl font-black tracking-tight text-white">${Math.round(netWorth).toLocaleString()}</h2>
                        </div>
                        <div className="w-px h-10 bg-white/10" />
                        <div>
                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Verf&uuml;gbar</p>
                            <h2 className="text-xl font-black text-white/80">${Math.round(portfolio.balance).toLocaleString()}</h2>
                        </div>
                    </div>
                    <div className="flex-1 max-w-md hidden lg:block overflow-hidden mx-8">
                        <AnimatePresence mode="wait">
                            {news.length > 0 && (
                                <motion.div
                                    key={news[0].time}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-full whitespace-nowrap overflow-hidden text-ellipsis border border-indigo-500/20"
                                >
                                    📢 {news[0].message}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="flex flex-col items-center md:items-end">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Zeit &uuml;brig</p>
                        <div className="text-3xl font-black font-mono text-indigo-500">
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                    </div>
                </div>

                {/* Main */}
                <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
                    {/* Market / Orders */}
                    <div className="flex-1 overflow-y-auto space-y-4">
                        <div className="flex gap-2">
                            <button onClick={() => setActiveTab('market')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'market' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-white/40'}`}>Markt</button>
                            <button onClick={() => setActiveTab('orders')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'orders' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-white/40'}`}>Offene Orders ({limitOrders.length})</button>
                        </div>

                        {activeTab === 'market' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(market).map(([symbol, data]) => (
                                    <div key={symbol} onClick={() => setSelectedSymbol(symbol)} className={`kahoot-card cursor-pointer border-2 transition-all ${selectedSymbol === symbol ? 'border-indigo-500' : 'border-transparent'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-2xl font-black">{symbol}</h3>
                                                <p className="text-xs font-bold text-white/40">In Besitz: {portfolio.assets[symbol] || 0}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold font-mono">${data.price.toFixed(2)}</p>
                                                <span className={`text-[10px] font-black ${data.history[data.history.length - 1] > data.history[data.history.length - 2] ? 'text-green-400' : 'text-red-400'}`}>
                                                    {data.history[data.history.length - 1] > data.history[data.history.length - 2] ? '▲ UP' : '▼ DOWN'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-24 w-full relative mt-4">
                                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <defs>
                                                    <linearGradient id={`g-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>
                                                {(() => {
                                                    const hist = data.history.slice(-30);
                                                    if (hist.length < 2) return null;
                                                    const min = Math.min(...hist) * 0.9995;
                                                    const max = Math.max(...hist) * 1.0005;
                                                    const range = max - min || 1;
                                                    const pts = hist.map((h: number, i: number) => ({ x: (i / (hist.length - 1)) * 100, y: 100 - ((h - min) / range) * 100 }));
                                                    const line = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ');
                                                    const area = line + ` L 100 100 L 0 100 Z`;
                                                    return (
                                                        <>
                                                            <path d={area} fill={`url(#g-${symbol})`} />
                                                            <path d={line} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill="#6366f1" />
                                                        </>
                                                    );
                                                })()}
                                            </svg>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {limitOrders.length === 0 ? (
                                    <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Keine offenen Orders</p>
                                    </div>
                                ) : (
                                    limitOrders.map(order => (
                                        <div key={order.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 flex justify-between items-center hover:bg-white/10 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${order.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {order.type === 'buy' ? 'K' : 'V'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white">{order.amount}x {order.symbol}</h4>
                                                    <p className="text-[10px] font-bold text-white/40 uppercase">{order.type === 'buy' ? 'Kauflimit' : 'Verkauflimit'}: ${order.targetPrice?.toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => cancelLimitOrder(order.id)} className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-black">
                                                Stornieren
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Order Terminal */}
                    <div className="w-full lg:w-80 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Trading Terminal</p>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl">
                            <button onClick={() => setOrderType('buy')} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${orderType === 'buy' ? 'bg-green-500 text-white' : 'text-white/40'}`}>Kauf</button>
                            <button onClick={() => setOrderType('sell')} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${orderType === 'sell' ? 'bg-red-500 text-white' : 'text-white/40'}`}>Verkauf</button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-white/40 uppercase block mb-1">Asset</label>
                                <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500">
                                    {Object.keys(market).map(s => <option key={s} value={s}>{s} — ${market[s].price.toFixed(2)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-white/40 uppercase block mb-1">Order Typ</label>
                                <select value={orderMode} onChange={e => setOrderMode(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500">
                                    <option value="market">Marktpreis</option>
                                    <option value="limit">Limitpreis</option>
                                </select>
                            </div>
                            {orderMode === 'limit' && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                    <label className="text-[10px] font-black text-white/40 uppercase block mb-1">Zielpreis ($)</label>
                                    <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder={`z.B. ${market[selectedSymbol]?.price.toFixed(0)}`} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500" />
                                </motion.div>
                            )}
                            <div>
                                <label className="text-[10px] font-black text-white/40 uppercase block mb-1">Menge</label>
                                <div className="flex gap-2">
                                    <input type="number" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500" />
                                    <button onClick={() => setOrderAmount(Math.max(0, Math.floor(portfolio.balance / (market[selectedSymbol]?.price || 1))).toString())} className="px-3 rounded-xl bg-white/10 text-[10px] font-black hover:bg-white/20 uppercase">Max</button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-white/10">
                            <div className="flex justify-between items-center mb-4 text-[10px] font-black text-white/40 uppercase">
                                <span>Gesamt</span>
                                <span className="text-white text-sm font-bold">
                                    ${((parseFloat(orderAmount) || 0) * (orderMode === 'market' ? (market[selectedSymbol]?.price || 0) : (parseFloat(targetPrice) || 0))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            {orderMode === 'market' ? (
                                <button
                                    onClick={() => orderType === 'buy' ? buyAsset(selectedSymbol, parseInt(orderAmount)) : sellAsset(selectedSymbol, parseInt(orderAmount))}
                                    disabled={!orderAmount || parseInt(orderAmount) < 1 || (orderType === 'buy' && portfolio.balance < (market[selectedSymbol]?.price || 0) * parseInt(orderAmount)) || (orderType === 'sell' && (portfolio.assets[selectedSymbol] || 0) < parseInt(orderAmount))}
                                    className={`w-full py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-lg disabled:opacity-50 disabled:grayscale ${orderType === 'buy' ? 'bg-green-600 hover:bg-green-500 shadow-green-900/40' : 'bg-red-600 hover:bg-red-500 shadow-red-900/40'}`}
                                >
                                    {orderType === 'buy' ? 'Jetzt Kaufen' : 'Jetzt Verkaufen'}
                                </button>
                            ) : (
                                <button
                                    onClick={placeLimitOrder}
                                    disabled={!orderAmount || !targetPrice || parseInt(orderAmount) < 1}
                                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-black uppercase text-xs transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-50 disabled:grayscale"
                                >
                                    {orderType === 'buy' ? '📈 Kauflimit setzen' : '📉 Verkauflimit setzen'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        );
    }



    if (phase === 'reveal') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-6xl py-12"
                >
                    <div className="text-center mb-16">
                        <motion.h2
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className="text-7xl font-[1000] uppercase tracking-[0.2em] mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 italic"
                        >
                            {gameType === 'most-likely' ? 'Ergebnis' : 'Wer ist der Imposter?'}
                        </motion.h2>
                        <div className="h-1 w-24 bg-indigo-500 mx-auto rounded-full mb-6" />
                        <p className="text-white/40 text-xl font-medium tracking-widest uppercase">
                            Runde {currentRound} von {maxRounds} • {isLastRound ? 'Endergebnis' : 'Wer hat hier gelogen?'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {gameType === 'finance-duel' ? (
                            rankings.map((player, index) => (
                                <motion.div
                                    key={player.id}
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.15, duration: 0.6 }}
                                    className={`relative group p-1 rounded-[2rem] transition-all duration-700 ${index === 0
                                        ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-800 shadow-[0_0_50px_rgba(234,179,8,0.4)] ring-4 ring-yellow-500/20'
                                        : 'bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className={`p-8 rounded-[1.8rem] h-full flex flex-col ${index === 0 ? 'bg-black/40 backdrop-blur-xl' : 'bg-slate-900/40 backdrop-blur-md border border-white/5'}`}>
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className={`text-sm font-black uppercase tracking-widest mb-1 ${index === 0 ? 'text-yellow-400' : 'text-indigo-400'}`}>
                                                    {player.name}
                                                </h3>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/50'}`}>
                                                    Platz {index + 1}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-white">${Math.round(player.netWorth).toLocaleString()}</p>
                                                <p className="text-[10px] font-bold text-white/40 uppercase">Gesamtvermögen</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mt-4">
                                            <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                                                <span>Cash</span>
                                                <span>${Math.round(player.portfolio.balance).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                                                <span>Assets</span>
                                                <span>{Object.keys(player.portfolio.assets).length} Diversifiziert</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            players.map((player, index) => {
                                const isTheImposter = player.id === imposterId;
                                const voteCount = votes[player.id] || 0;

                                return (
                                    <motion.div
                                        key={player.id}
                                        initial={{ opacity: 0, y: 40 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.15, duration: 0.6 }}
                                        className={`relative group p-1 rounded-[2rem] transition-all duration-700 ${isTheImposter
                                            ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-900 shadow-[0_0_50px_rgba(239,68,68,0.4)] ring-4 ring-red-500/20'
                                            : 'bg-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className={`p-8 rounded-[1.8rem] h-full flex flex-col ${isTheImposter ? 'bg-black/40 backdrop-blur-xl' : 'bg-slate-900/40 backdrop-blur-md border border-white/5'}`}>
                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <h3 className={`text-sm font-black uppercase tracking-widest mb-1 ${isTheImposter ? 'text-red-400' : 'text-indigo-400'}`}>
                                                        {player.name}
                                                    </h3>
                                                    {isTheImposter && (
                                                        <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded uppercase tracking-tighter">
                                                            Der Imposter
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center ${isTheImposter ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/40'}`}>
                                                    <span className="text-lg font-black leading-none">{voteCount}</span>
                                                    <span className="text-[8px] font-bold uppercase">Stimmen</span>
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center py-4">
                                                <p className={`text-2xl font-bold leading-snug break-words ${isTheImposter ? 'text-red-100 italic' : 'text-white'}`}>
                                                    {gameType === 'most-likely' ? player.name : `"${answers[player.id] || "Keine Antwort"}"`}
                                                </p>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-white/5">
                                                <div className="flex -space-x-2">
                                                    {/* In a real scenario, you'd show WHO voted for them here */}
                                                    {[...Array(Math.min(voteCount, 5))].map((_, i) => (
                                                        <div key={i} className={`w-8 h-8 rounded-full border-2 ${isTheImposter ? 'bg-red-900 border-red-500' : 'bg-indigo-900 border-indigo-500'} flex items-center justify-center text-[10px] font-black`}>
                                                            ?
                                                        </div>
                                                    ))}
                                                    {voteCount > 5 && (
                                                        <div className="w-8 h-8 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center text-[10px] font-black text-white/40">
                                                            +{voteCount - 5}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ornamental glow for imposter */}
                                        {isTheImposter && (
                                            <div className="absolute -inset-4 bg-red-500/10 blur-3xl -z-10 rounded-full animate-pulse" />
                                        )}
                                    </motion.div>
                                );
                            })
                        )}
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        className="mt-24 flex flex-col items-center space-y-8"
                    >
                        {isLastRound && (
                            <button
                                onClick={() => window.location.reload()}
                                className="group relative px-16 py-5 overflow-hidden rounded-2xl bg-white text-slate-950 text-xl font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                            >
                                <span className="relative z-10">Nochmal spielen</span>
                                <div className="absolute inset-0 bg-indigo-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            </button>
                        )}
                        {!isLastRound && (
                            <div className="text-center text-white/50 animate-pulse font-bold uppercase tracking-widest">
                                Warte auf den Host für die nächste Runde...
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6">
            {/* TODO: Voting and Reveal UI */}
            <h1 className="text-white">Voting phase coming soon...</h1>
        </main>
    );
}
