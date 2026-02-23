"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Users, Play, LogOut, Copy, Check, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";

export default function AdminDashboardContent() {
    const { socket, connected } = useSocket();
    const [lobbyCode, setLobbyCode] = useState<string | null>(null);
    const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);
    const [gameData, setGameData] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");
    const [networkInfo, setNetworkInfo] = useState<{ networkIps: string[], publicIp: string } | null>(null);

    useEffect(() => {
        setBaseUrl(window.location.origin);
    }, []);

    useEffect(() => {
        if (socket && !lobbyCode) {
            socket.emit("create-lobby", {});
        }

        if (socket) {
            socket.on("lobby-created", ({ lobbyCode, networkInfo }) => {
                console.log("Dashboard: Lobby created", lobbyCode);
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
            socket.emit("start-game", { lobbyCode, gameType: "who-is-lying" });
        }
    };

    return (
        <main className="flex min-h-screen flex-col p-8 md:p-12 relative overflow-hidden notranslate" translate="no">
            {/* Header */}
            <div className="flex justify-between items-center mb-12 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Users className="text-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">Host Dashboard</h1>
                </div>

                <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors">
                    <LogOut size={20} />
                    <span className="font-bold" translate="no">Sitzung beenden</span>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                {/* Left: Lobby Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="kahoot-card border-indigo-500/20 bg-indigo-500/5">
                        <p className="text-xs font-bold text-indigo-300 uppercase mb-2">Spiel-PIN</p>
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-6xl font-black text-white tracking-widest">
                                {lobbyCode || "------"}
                            </h2>
                            <button
                                onClick={copyCode}
                                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white/50 hover:text-white"
                            >
                                {copied ? <Check size={24} className="text-green-400" /> : <Copy size={24} />}
                            </button>
                        </div>

                        {lobbyCode ? (
                            <div className="mt-6 flex flex-col items-center gap-4 p-6 rounded-xl bg-indigo-500/20 border-2 border-indigo-500/50">
                                <p className="text-[10px] font-bold text-white uppercase italic">QR-Code wird generiert...</p>
                                <div className="p-4 bg-white rounded-2xl shadow-2xl ring-8 ring-white/10">
                                    <QRCodeCanvas
                                        value={
                                            networkInfo?.networkIps && networkInfo.networkIps.length > 0
                                                ? `http://${networkInfo.networkIps[0]}:3000/game/${lobbyCode}`
                                                : networkInfo?.publicIp
                                                    ? `http://${networkInfo.publicIp}:3000/game/${lobbyCode}`
                                                    : baseUrl
                                                        ? `${baseUrl}/game/${lobbyCode}`
                                                        : typeof window !== 'undefined'
                                                            ? `${window.location.protocol}//${window.location.hostname}:3000/game/${lobbyCode}`
                                                            : `http://localhost:3000/game/${lobbyCode}`
                                        }
                                        size={200}
                                        level={"H"}
                                        includeMargin={true}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-black uppercase text-white tracking-widest bg-indigo-600 px-3 py-1 rounded-full">
                                    <Users size={14} />
                                    Scannen zum Mitspielen
                                </div>
                                <div className="flex flex-col items-center gap-2 w-full">
                                    {networkInfo?.publicIp && (
                                        <div className="bg-black/40 p-2 rounded-lg w-full text-center group cursor-pointer hover:bg-black/60 transition-colors"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`http://${networkInfo.publicIp}:3000/game/${lobbyCode}`);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}>
                                            <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">Öffentliche IP</p>
                                            <p className="text-[10px] text-white font-mono break-all">
                                                http://{networkInfo.publicIp}:3000/game/{lobbyCode}
                                            </p>
                                        </div>
                                    )}
                                    {networkInfo?.networkIps.map(ip => (
                                        <div key={ip} className="bg-black/40 p-2 rounded-lg w-full text-center group cursor-pointer hover:bg-black/60 transition-colors"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`http://${ip}:3000/game/${lobbyCode}`);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}>
                                            <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">Lokale IP</p>
                                            <p className="text-[10px] text-white font-mono break-all">
                                                http://{ip}:3000/game/{lobbyCode}
                                            </p>
                                        </div>
                                    ))}
                                    {!networkInfo && (
                                        <p className="text-[10px] text-white/50 font-mono break-all text-center">
                                            Lade Netzwerk-Info...
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 p-8 border-2 border-dashed border-white/10 rounded-xl text-center">
                                <p className="text-sm text-white/20 italic">Kein Lobby-Code vorhanden</p>
                            </div>
                        )}
                        <p className="mt-4 text-sm text-white/40">Teile diesen Code oder den QR-Code mit den Spielern.</p>
                    </div>

                    <div className="kahoot-card">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Play size={20} className="text-green-400" />
                            Spiel-Einstellungen
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <p className="font-bold text-white">Wer ist der Imposter?</p>
                                <p className="text-xs text-white/40 mt-1">Standard-Spielmodus ausgewählt.</p>
                            </div>

                            <button
                                onClick={startGame}
                                disabled={players.length < 3 || isStarting}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${players.length >= 3 && !isStarting
                                    ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/40"
                                    : "bg-white/5 text-white/20 cursor-not-allowed grayscale"
                                    }`}
                            >
                                {isStarting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        Wird gestartet...
                                    </span>
                                ) : players.length >= 3 ? (
                                    "Spiel starten"
                                ) : (
                                    "Mindestens 3 Spieler"
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
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Spielverlauf</h3>
                                <span className="px-4 py-1 rounded-full bg-indigo-500 text-[10px] font-black uppercase tracking-widest text-white">
                                    {gameData.status === 'question' ? 'Frage' : gameData.status === 'voting' ? 'Voting' : 'Reveal'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {players.map(player => {
                                    const hasAnswered = !!gameData.answers[player.id];
                                    const hasVoted = !!gameData.votes[player.id];
                                    const isTheImposter = player.id === gameData.imposterId;

                                    return (
                                        <div key={player.id} className={`p-4 rounded-xl border ${isTheImposter ? 'bg-red-900/40 border-red-400/30' : 'bg-white/5 border-white/10'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white">{player.name}</span>
                                                    {isTheImposter && (
                                                        <span className="text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded uppercase tracking-tighter w-fit mt-1">
                                                            Der Imposter
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${hasAnswered ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/20'}`}>
                                                        Geantwortet
                                                    </span>
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${hasVoted ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/20'}`}>
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
                                                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-white/40 uppercase">Erhaltene Stimmen</span>
                                                    <span className="text-lg font-black text-white">
                                                        {Object.values(gameData.votes).filter(v => v === player.id).length}
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
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    Spieler
                                    <span className="px-3 py-1 rounded-full bg-white/10 text-sm font-bold text-indigo-300">
                                        {players.length}
                                    </span>
                                </h3>
                            </div>

                            {players.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-white/20 space-y-4">
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
                                                className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 group hover:border-indigo-500/50 transition-all"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-300">
                                                    {player.name[0].toUpperCase()}
                                                </div>
                                                <span className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
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
                <span className="text-[10px] uppercase font-black tracking-widest text-white/20">
                    {connected ? "Verbunden" : "Getrennt"}
                </span>
            </div>
        </main>
    );
}
