"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/today", label: "Bugün" },
  { href: "/leagues", label: "Ligler" },
  { href: "/compare", label: "Karşılaştır" },
];

export default function Header() {
  const [isLive, setIsLive] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const channel = supabase.channel("header-status");
    channel.subscribe((status) => {
      setIsLive(status === "SUBSCRIBED");
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header className="border-b border-white/5 bg-[#0d1117] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="text-xl">⚽</span>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">InPlayGuru</h1>
            <p className="text-[10px] text-gray-500 leading-tight">Canlı strateji takibi</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-500/15 text-green-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile nav */}
        <nav className="flex sm:hidden items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  isActive ? "text-green-400" : "text-gray-500 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Live status */}
        <div className="flex items-center gap-2 bg-[#161c27] px-3 py-1.5 rounded-full border border-white/5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              isLive ? "bg-green-400 animate-pulse" : "bg-gray-600"
            }`}
          />
          <span className={`text-xs font-medium hidden sm:inline ${isLive ? "text-green-400" : "text-gray-500"}`}>
            {isLive ? "CANLI" : "Bağlanıyor..."}
          </span>
        </div>
      </div>
    </header>
  );
}
