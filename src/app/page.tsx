"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code && name) {
      // Logic to join lobby via socket will go here or in a separate context
      router.push(`/game/${code.toUpperCase()}?name=${encodeURIComponent(name)}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
      <Link
        href="/admin/login"
        className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 transition-all text-foreground/70 hover:text-foreground font-medium"
      >
        <LogIn size={20} />
        <span>Admin Login</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md kahoot-card"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-2xl bg-foreground/10 shadow-inner">
            <Gamepad2 size={48} className="text-foreground" />
          </div>
        </div>

        <h1 className="kahoot-title">Game Box</h1>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/50 uppercase ml-1">Spiel-PIN</label>
            <input
              type="text"
              placeholder="000000"
              className="kahoot-input text-center text-3xl tracking-widest font-black uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/50 uppercase ml-1">Spitzname</label>
            <input
              type="text"
              placeholder="Dein Name"
              className="kahoot-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="w-full kahoot-button text-xl uppercase tracking-wider">
            Spiel beitreten
          </button>
        </form>
      </motion.div>

      <div className="mt-12 text-foreground/30 text-sm font-medium">
        Von Janik270
      </div>
    </main >
  );
}

