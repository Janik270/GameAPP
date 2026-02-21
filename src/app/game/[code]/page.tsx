"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { Gamepad2, Users, Loader2, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = 'lobby' | 'question' | 'voting' | 'reveal';

export default function GamePage() {
    const { code } = useParams();
    const searchParams = useSearchParams();
    const playerName = searchParams.get("name");
    const { socket, connected } = useSocket();

    const [phase, setPhase] = useState<Phase>('lobby');
    const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);
    const [question, setQuestion] = useState<string>("");
    const [isImposter, setIsImposter] = useState(false);
    const [answer, setAnswer] = useState("");
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [votes, setVotes] = useState<Record<string, number>>({});
    const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
    const [votedPlayers, setVotedPlayers] = useState<string[]>([]);
    const [imposterId, setImposterId] = useState<string | null>(null);

    useEffect(() => {
        if (socket && connected && code && playerName) {
            socket.emit("join-lobby", { lobbyCode: code, playerName });

            socket.on("player-joined", ({ players }) => {
                setPlayers(players);
            });

            socket.on("game-started", ({ gameType, imposterId }) => {
                setPhase('question');
                setIsImposter(socket.id === imposterId);
                setImposterId(imposterId);
                setAnsweredPlayers([]);
                setVotedPlayers([]);
                setAnswers({});
                setVotes({});

                // In a real game, questions would come from server
                const baseQuestion = "Was ist dein Lieblingstier?";
                const imposterQuestion = "Welches Tier findest du am ekeligsten?";

                setQuestion(socket.id === imposterId ? imposterQuestion : baseQuestion);
            });

            socket.on("answer-submitted", ({ playerId, answer }) => {
                setAnsweredPlayers(prev => [...new Set([...prev, playerId])]);
            });

            socket.on("all-answered", ({ answers }) => {
                setAnswers(answers);
                setPhase('voting');
                setAnsweredPlayers([]);
            });

            socket.on("player-voted", ({ voterId }) => {
                setVotedPlayers(prev => [...new Set([...prev, voterId])]);
            });

            socket.on("reveal", ({ imposterId, votes, answers }) => {
                setPhase('reveal');
                setImposterId(imposterId);
                setIsImposter(socket.id === imposterId);
                setAnswers(answers);
                // Calculate vote counts (results)
                const counts: Record<string, number> = {};
                Object.values(votes as Record<string, string>).forEach(votedId => {
                    counts[votedId] = (counts[votedId] || 0) + 1;
                });
                setVotes(counts);
            });

            socket.on("error", ({ message }) => {
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
    }, [socket, connected, code, playerName]);

    const submitAnswer = () => {
        if (socket && answer) {
            socket.emit("submit-answer", { lobbyCode: code, answer });
        }
    };

    const votePlayer = (playerId: string) => {
        if (socket) {
            socket.emit("vote-player", { lobbyCode: code, votedPlayerId: playerId });
        }
    };

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
                            Phase 1: Frage
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
                                    className="w-full kahoot-button flex items-center justify-center gap-2 text-xl"
                                >
                                    <Send size={24} />
                                    Antwort senden
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
                        <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">Wer ist der Imposter?</h2>
                        <p className="text-white/60 text-xl font-medium">Lies die Antworten und stimme für den Imposter ab!</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {players.map((player) => {
                            const hasVoted = votedPlayers.includes(player.id);
                            return (
                                <motion.button
                                    key={player.id}
                                    whileHover={player.id !== socket?.id ? { scale: 1.02 } : {}}
                                    whileTap={player.id !== socket?.id ? { scale: 0.98 } : {}}
                                    onClick={() => player.id !== socket?.id && votePlayer(player.id)}
                                    disabled={votedPlayers.includes(socket?.id || "") || player.id === socket?.id}
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
                                            "{answers[player.id] || "Überlegt noch..."}"
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
                            Wer ist der Imposter?
                        </motion.h2>
                        <div className="h-1 w-24 bg-indigo-500 mx-auto rounded-full mb-6" />
                        <p className="text-white/40 text-xl font-medium tracking-widest uppercase">
                            Wer hat hier gelogen?
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {players.map((player, index) => {
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
                                                "{answers[player.id] || "Keine Antwort"}"
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
                        })}
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        className="mt-24 flex flex-col items-center space-y-8"
                    >
                        <button
                            onClick={() => window.location.reload()}
                            className="group relative px-16 py-5 overflow-hidden rounded-2xl bg-white text-slate-950 text-xl font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                        >
                            <span className="relative z-10">Nochmal spielen</span>
                            <div className="absolute inset-0 bg-indigo-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </button>
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
