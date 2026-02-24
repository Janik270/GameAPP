"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Users, Play, LogOut, Copy, Check, QrCode, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";

export default function AdminDashboardContent() {
    const { socket, connected } = useSocket();
    const router = useRouter();
    const [lobbyCode, setLobbyCode] = useState<string | null>(null);
    const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);
    const [gameData, setGameData] = useState<any>(null);
    const [gameType, setGameType] = useState<string>("who-is-lying");
    const [customGameId, setCustomGameId] = useState<string | null>(null);
    const [customGames, setCustomGames] = useState<any[]>([]);

    const [copied, setCopied] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");
    const [networkInfo, setNetworkInfo] = useState<{ networkIps: string[], publicIp: string } | null>(null);
    const [maxRounds, setMaxRounds] = useState(3);

    useEffect(() => {
        setBaseUrl(window.location.origin);
        fetchCustomGames();
    }, []);

    const fetchCustomGames = async () => {
        try {
            const res = await fetch('/api/games');
            if (res.ok) {
                const data = await res.json();
                setCustomGames(data);
            } else if (res.status === 401) {
                router.push('/admin/login');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
    };

    useEffect(() => {
        if (socket && !lobbyCode) {
            socket.emit("create-lobby", {});
        }

        if (socket) {
            socket.on("lobby-created", ({ lobbyCode, networkInfo }) => {
                setLobbyCode(lobbyCode);
                if (networkInfo) setNetworkInfo(networkInfo);
            });

            socket.on("player-joined", ({ players }) => {
                setPlayers(players);
            });

            socket.on("host-update", (data) => {
                setPlayers(data.players);
                setGameData(data.gameData);
                if (data.networkInfo) setNetworkInfo(data.networkInfo);
            });
        }

        return () => {
            socket?.off("lobby-created");
            socket?.off("player-joined");
            socket?.off("host-update");
        };
    }, [socket, lobbyCode]);

    const copyCode = () => {
        if (lobbyCode) {
            navigator.clipboard.writeText(lobbyCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const startGame = () => {
        if (socket && lobbyCode && !isStarting) {
            setIsStarting(true);
            socket.emit("start-game", { lobbyCode, gameType, maxRounds, customGameId });
        }
    };

    const nextRound = () => {
        if (socket && lobbyCode) {
            socket.emit("next-round", { lobbyCode });
        }
    };

    const handleSelectGame = (type: string, id: string | null = null) => {
        setGameType(type);
        setCustomGameId(id);
    };

    return (
        <main className="flex min-h-screen flex-col p-8 md:p-12 relative overflow-hidden notranslate" translate="no">
            {/* Header */}
            <div className="flex justify-between items-center mb-12 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Users className="text-foreground" size={24} />
                    </div>
                    <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">Host Dashboard</h1>
                </div>

                <button onClick={handleLogout} className="flex items-center gap-2 text-foreground/50 hover:text-foreground transition-colors">
                    <LogOut size={20} />
                    <span className="font-bold">Sitzung beenden</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                {/* Left: Lobby Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="kahoot-card border-indigo-500/20 bg-indigo-500/5">
                        <p className="text-xs font-bold text-indigo-300 uppercase mb-2">Spiel-PIN</p>
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-6xl font-black text-foreground tracking-widest">
                                {lobbyCode || "------"}
                            </h2>
                            <button
                                onClick={copyCode}
                                className="p-3 rounded-xl bg-foreground/10 hover:bg-foreground/20 transition-all text-foreground/50 hover:text-foreground"
                            >
                                {copied ? <Check size={24} className="text-green-400" /> : <Copy size={24} />}
                            </button>
                        </div>

                        {lobbyCode ? (
                            <div className="mt-6 flex flex-col items-center gap-4 p-6 rounded-xl bg-indigo-500/20 border-2 border-indigo-500/50">
                                <p className="text-[10px] font-bold text-foreground uppercase italic">QR-Code wird generiert...</p>
                                <div className="p-4 bg-foreground rounded-2xl shadow-2xl ring-8 ring-foreground/10">
                                    <QRCodeCanvas
                                        value={`https://play.hackerwerkstatt.de/game/${lobbyCode}`}
                                        size={200}
                                        level={"H"}
                                        includeMargin={true}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-black uppercase text-foreground tracking-widest bg-indigo-600 px-3 py-1 rounded-full">
                                    <Users size={14} />
                                    Scannen zum Mitspielen
                                </div>
                                <div className="flex flex-col items-center gap-2 w-full">
                                    <div className="bg-background/40 p-2 rounded-lg w-full text-center group cursor-pointer hover:bg-background/60 transition-colors"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`https://play.hackerwerkstatt.de/game/${lobbyCode}`);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}>
                                        <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">Production URL</p>
                                        <p className="text-[10px] text-foreground font-mono break-all">
                                            https://play.hackerwerkstatt.de/game/{lobbyCode}
                                        </p>
                                    </div>
                                    {networkInfo?.publicIp && (
                                        <div className="bg-background/40 p-2 rounded-lg w-full text-center group cursor-pointer hover:bg-background/60 transition-colors"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`http://${networkInfo.publicIp}:3000/game/${lobbyCode}`);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}>
                                            <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">Öffentliche IP</p>
                                            <p className="text-[10px] text-foreground font-mono break-all">
                                                http://{networkInfo.publicIp}:3000/game/{lobbyCode}
                                            </p>
                                        </div>
                                    )}
                                    {networkInfo?.networkIps.map(ip => (
                                        <div key={ip} className="bg-background/40 p-2 rounded-lg w-full text-center group cursor-pointer hover:bg-background/60 transition-colors"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`http://${ip}:3000/game/${lobbyCode}`);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}>
                                            <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">Lokale IP</p>
                                            <p className="text-[10px] text-foreground font-mono break-all">
                                                http://{ip}:3000/game/{lobbyCode}
                                            </p>
                                        </div>
                                    ))}
                                    {!networkInfo && (
                                        <p className="text-[10px] text-foreground/50 font-mono break-all text-center">
                                            Lade Netzwerk-Info...
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 p-8 border-2 border-dashed border-foreground/10 rounded-xl text-center">
                                <p className="text-sm text-foreground/20 italic">Kein Lobby-Code vorhanden</p>
                            </div>
                        )}
                        <p className="mt-4 text-sm text-foreground/40">Teile diesen Code oder den QR-Code mit den Spielern.</p>
                    </div>

                    <div className="kahoot-card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Play size={20} className="text-green-400" />
                                Spiel-Einstellungen
                            </h3>
                            <Link href="/admin/games/create" className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-lg text-indigo-300 transition-colors">
                                <Plus size={16} />
                            </Link>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Standard Games */}
                                <button
                                    onClick={() => handleSelectGame("who-is-lying")}
                                    className={`p-4 rounded-xl border text-left transition-all ${gameType === 'who-is-lying' && !customGameId ? 'bg-indigo-500/20 border-indigo-500' : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'}`}
                                >
                                    <p className="font-bold text-foreground">Wer ist der Imposter?</p>
                                    <p className="text-[10px] text-foreground/40 mt-1 uppercase">Standard</p>
                                </button>
                                <button
                                    onClick={() => handleSelectGame("most-likely")}
                                    className={`p-4 rounded-xl border text-left transition-all ${gameType === 'most-likely' && !customGameId ? 'bg-indigo-500/20 border-indigo-500' : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'}`}
                                >
                                    <p className="font-bold text-foreground">Wer würde am ehesten...</p>
                                    <p className="text-[10px] text-foreground/40 mt-1 uppercase">Standard</p>
                                </button>
                                <button
                                    onClick={() => handleSelectGame("finance-duel")}
                                    className={`p-4 rounded-xl border text-left transition-all ${gameType === 'finance-duel' && !customGameId ? 'bg-indigo-500/20 border-indigo-500' : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'}`}
                                >
                                    <p className="font-bold text-foreground">💸 Finanz-Duell</p>
                                    <p className="text-[10px] text-foreground/40 mt-1 uppercase">Standard</p>
                                </button>

                                {/* Custom Games */}
                                {customGames.length > 0 && <div className="h-px bg-foreground/10 my-2" />}

                                {customGames.map(game => (
                                    <button
                                        key={game.id}
                                        onClick={() => handleSelectGame(game.gameType, game.id)}
                                        className={`p-4 rounded-xl border text-left transition-all ${customGameId === game.id ? 'bg-indigo-500/20 border-indigo-500' : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'}`}
                                    >
                                        <p className="font-bold text-foreground">{game.title}</p>
                                        <p className="text-[10px] text-indigo-400 mt-1 uppercase">
                                            Eigenschaften: {game.gameType}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2 pt-2 bg-foreground/5 p-4 rounded-xl border border-foreground/10">
                                <div className="flex justify-between items-center text-xs font-bold text-foreground/70 uppercase mb-2">
                                    <span>{gameType === 'finance-duel' ? 'Minuten' : 'Runden'}</span>
                                    <span className="text-xl text-primary">{maxRounds}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="30"
                                        value={maxRounds}
                                        onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                                        className="w-full h-3 bg-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={maxRounds}
                                        onChange={(e) => setMaxRounds(parseInt(e.target.value) || 1)}
                                        className="w-16 p-2 rounded-lg bg-foreground/10 border border-foreground/20 text-center font-bold text-foreground outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={startGame}
                                disabled={(gameType === 'finance-duel' ? players.length < 2 : players.length < 3) || isStarting}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${(gameType === 'finance-duel' ? players.length >= 2 : players.length >= 3) && !isStarting
                                    ? "bg-green-600 hover:bg-green-500 text-foreground shadow-lg shadow-green-900/40"
                                    : "bg-foreground/5 text-foreground/20 cursor-not-allowed grayscale"
                                    }`}
                            >
                                {isStarting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        Wird gestartet...
                                    </span>
                                ) : (gameType === 'finance-duel' ? players.length >= 2 : players.length >= 3) ? (
                                    "Spiel starten"
                                ) : (
                                    gameType === 'finance-duel' ? "Mindestens 2 Spieler" : "Mindestens 3 Spieler"
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Players List */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Live Game Status */}
                    {gameData && gameData.status !== 'lobby' && (
                        <div className="kahoot-card border-indigo-500/30 bg-indigo-500/10">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Spielverlauf</h3>
                                    {gameData.gameType === 'finance-duel' ? (
                                        <p className="text-xs font-bold text-indigo-400 uppercase">
                                            Zeit übrig: {Math.floor(gameData.timeLeft / 60)}:{(gameData.timeLeft % 60).toString().padStart(2, '0')}
                                        </p>
                                    ) : (
                                        <p className="text-xs font-bold text-indigo-400 uppercase">Runde {gameData.currentRound} von {gameData.maxRounds}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {gameData.status === 'reveal' && gameData.gameType !== 'finance-duel' && gameData.currentRound < gameData.maxRounds && (
                                        <button
                                            onClick={nextRound}
                                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-foreground text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-green-900/40"
                                        >
                                            Nächste Runde
                                        </button>
                                    )}
                                    <span className="px-4 py-1 rounded-full bg-indigo-500 text-[10px] font-black uppercase tracking-widest text-foreground">
                                        {gameData.status === 'question' ? 'Frage' : gameData.status === 'voting' ? 'Voting' : gameData.status === 'finance-duel' ? 'Trading' : 'Reveal'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {players.map(player => {
                                    const hasAnswered = !!gameData.answers[player.id];
                                    const hasVoted = !!gameData.votes[player.id];
                                    const isTheImposter = player.id === gameData.imposterId;

                                    return (
                                        <div key={player.id} className={`p-4 rounded-xl border ${isTheImposter ? 'bg-red-900/40 border-red-400/30' : 'bg-foreground/5 border-foreground/10'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">{player.name}</span>
                                                    {isTheImposter && (
                                                        <span className="text-[9px] font-black bg-red-500 text-foreground px-2 py-0.5 rounded uppercase tracking-tighter w-fit mt-1">
                                                            Der Imposter
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${hasAnswered ? 'bg-green-500/20 text-green-400' : 'bg-foreground/5 text-foreground/20'}`}>
                                                        Geantwortet
                                                    </span>
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${hasVoted ? 'bg-blue-500/20 text-blue-400' : 'bg-foreground/5 text-foreground/20'}`}>
                                                        Abgestimmt
                                                    </span>
                                                </div>
                                            </div>

                                            {gameData.status === 'voting' && hasAnswered && (
                                                <p className="text-xs text-indigo-300 italic truncate mt-2">
                                                    "{gameData.answers[player.id]}"
                                                </p>
                                            )}

                                            {gameData.status === 'reveal' && (
                                                <div className="mt-3 pt-3 border-t border-foreground/10 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-foreground/40 uppercase">
                                                        {gameData.gameType === 'finance-duel' ? 'Gesamtvermögen' : 'Erhaltene Stimmen'}
                                                    </span>
                                                    <span className="text-lg font-black text-foreground">
                                                        {gameData.gameType === 'finance-duel'
                                                            ? `$${Math.round(gameData.rankings?.find((r: any) => r.id === player.id)?.netWorth || 0).toLocaleString()}`
                                                            : Object.values(gameData.votes).filter(v => v === player.id).length
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Players List (shown always if not in live game) */}
                    {(!gameData || gameData.status === 'lobby') && (
                        <div className="kahoot-card min-h-[400px] flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
                                    Spieler
                                    <span className="px-3 py-1 rounded-full bg-foreground/10 text-sm font-bold text-indigo-300">
                                        {players.length}
                                    </span>
                                </h3>
                            </div>

                            {players.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-foreground/20 space-y-4">
                                    <Users size={64} strokeWidth={1} />
                                    <p className="text-lg font-medium">Warte auf Spieler...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <AnimatePresence>
                                        {players.map((player, index) => (
                                            <motion.div
                                                key={player.id}
                                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center gap-4 group hover:border-indigo-500/50 transition-all"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-300">
                                                    {player.name[0].toUpperCase()}
                                                </div>
                                                <span className="font-bold text-foreground group-hover:text-indigo-300 transition-colors truncate">
                                                    {player.name}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Connection Status */}
            <div className="absolute bottom-8 right-8 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-[10px] uppercase font-black tracking-widest text-foreground/20">
                    {connected ? "Verbunden" : "Getrennt"}
                </span>
            </div>
        </main>
    );
}

