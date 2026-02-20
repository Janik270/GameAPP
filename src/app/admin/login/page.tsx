"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AdminLogin() {
    const [password, setPassword] = useState("");
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "admin") { // Simple hardcoded password for prototype
            router.push("/admin/dashboard");
        } else {
            alert("Wrong password!");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
            <Link
                href="/"
                className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white/70 hover:text-white font-medium"
            >
                <ArrowLeft size={20} />
                <span>Back</span>
            </Link>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-sm kahoot-card border-none"
            >
                <div className="flex justify-center mb-6">
                    <div className="p-4 rounded-full bg-indigo-500/20 shadow-inner">
                        <ShieldCheck size={48} className="text-indigo-400" />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-center text-white mb-2 uppercase tracking-tighter">Admin Portal</h1>
                <p className="text-white/50 text-center mb-8 text-sm">Access the game host dashboard</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <input
                            type="password"
                            placeholder="Admin Password"
                            className="kahoot-input text-center placeholder:text-white/20"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full kahoot-button !bg-indigo-600 shadow-indigo-900/40">
                        Sign In
                    </button>
                </form>
            </motion.div>
        </main>
    );
}
