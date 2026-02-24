"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AdminRegister() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Registration failed');
                return;
            }

            // Immediately login after registration
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (loginRes.ok) {
                router.push('/admin/dashboard');
            } else {
                router.push('/admin/login?registered=true');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
            <Link
                href="/admin/login"
                className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 transition-all text-foreground/70 hover:text-foreground font-medium"
            >
                <ArrowLeft size={20} />
                <span>Zurück</span>
            </Link>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-sm kahoot-card border-none"
            >
                <div className="flex justify-center mb-6">
                    <div className="p-4 rounded-full bg-indigo-500/20 shadow-inner">
                        <UserPlus size={48} className="text-indigo-400" />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-center text-foreground mb-2 uppercase tracking-tighter">Hoster Account</h1>
                <p className="text-foreground/50 text-center mb-8 text-sm">Neuen Account erstellen</p>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm font-medium text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Benutzername"
                            className="kahoot-input text-center placeholder:text-foreground/20"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <input
                            type="password"
                            placeholder="Passwort"
                            className="kahoot-input text-center placeholder:text-foreground/20"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full kahoot-button !bg-indigo-600 shadow-indigo-900/40 disabled:opacity-50"
                    >
                        {isLoading ? 'Lädt...' : 'Registrieren'}
                    </button>

                    <div className="text-center mt-4">
                        <Link href="/admin/login" className="text-xs text-foreground/40 hover:text-foreground transition-colors">
                            Bereits einen Account? Hier einloggen.
                        </Link>
                    </div>
                </form>
            </motion.div>
        </main>
    );
}

