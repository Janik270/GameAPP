"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CreateGame() {
    const [title, setTitle] = useState("");
    const [gameType, setGameType] = useState("who-is-lying");
    const [questions, setQuestions] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const addQuestion = () => {
        if (gameType === "who-is-lying") {
            setQuestions([...questions, { id: Date.now(), normal: "", imposter: "" }]);
        } else if (gameType === "most-likely") {
            setQuestions([...questions, { id: Date.now(), text: "" }]);
        }
    };

    const removeQuestion = (id: number) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const updateQuestion = (id: number, field: string, value: string) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const handleSave = async () => {
        if (!title.trim() || questions.length === 0) return;
        setIsSaving(true);

        try {
            const res = await fetch('/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    gameType,
                    questions: questions.map(({ id, ...rest }) => rest)
                })
            });

            if (res.ok) {
                router.push('/admin/dashboard');
            } else {
                alert("Fehler beim Speichern des Spiels.");
            }
        } catch (error) {
            console.error(error);
            alert("Ein Fehler ist aufgetreten.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col p-8 relative overflow-hidden">
            <div className="flex justify-between items-center mb-12 relative z-10 w-full max-w-4xl mx-auto">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/dashboard"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white/70 hover:text-white mr-4"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm font-bold">Zurück</span>
                    </Link>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">Neues Spiel Erstellen</h1>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving || !title.trim() || questions.length === 0}
                    className="flex justify-center items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg"
                >
                    <Save size={20} />
                    {isSaving ? "Speichert..." : "Spiel speichern"}
                </button>
            </div>

            <div className="w-full max-w-4xl mx-auto space-y-8 relative z-10">
                <div className="kahoot-card">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/50 uppercase ml-1">Titel des Spiels</label>
                            <input
                                type="text"
                                placeholder="z.B. Insider Witze 2026"
                                className="kahoot-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/50 uppercase ml-1">Spiel-Modus</label>
                            <select
                                className="kahoot-input appearance-none bg-indigo-900/50"
                                value={gameType}
                                onChange={(e) => {
                                    setGameType(e.target.value);
                                    setQuestions([]); // Reset questions on type change
                                }}
                            >
                                <option value="who-is-lying">Wer ist der Imposter?</option>
                                <option value="most-likely">Wer würde am ehesten...</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-black text-white">Fragen ({questions.length})</h2>
                        <button
                            onClick={addQuestion}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg transition-all"
                        >
                            <Plus size={16} />
                            {gameType === "who-is-lying" ? "Fragen-Paar" : "Frage"} hinzufügen
                        </button>
                    </div>

                    {questions.length === 0 ? (
                        <div className="p-8 border-2 border-dashed border-white/20 rounded-xl text-center text-white/50">
                            Füge deine erste Frage hinzu!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {questions.map((q, index) => (
                                <motion.div
                                    key={q.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-6 rounded-xl bg-white/5 border border-white/10 relative"
                                >
                                    <div className="absolute top-4 right-4 text-white/20 font-black text-2xl">
                                        {(index + 1).toString().padStart(2, '0')}
                                    </div>

                                    <div className="pr-12">
                                        {gameType === "who-is-lying" ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-green-400 uppercase">Normale Frage</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Frage für die normalen Spieler..."
                                                        className="w-full bg-transparent border-b border-white/20 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500"
                                                        value={q.normal}
                                                        onChange={(e) => updateQuestion(q.id, 'normal', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-red-400 uppercase">Imposter Frage</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Frage für den Imposter..."
                                                        className="w-full bg-transparent border-b border-red-500/30 py-2 text-white placeholder:text-red-300/30 focus:outline-none focus:border-red-500"
                                                        value={q.imposter}
                                                        onChange={(e) => updateQuestion(q.id, 'imposter', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase">Wer würde am ehesten...</label>
                                                <input
                                                    type="text"
                                                    placeholder="...heimlich Popstars hören?"
                                                    className="w-full bg-transparent border-b border-white/20 py-2 text-xl font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500"
                                                    value={q.text}
                                                    onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => removeQuestion(q.id)}
                                        className="mt-4 flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <Trash size={14} /> Entfernen
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
