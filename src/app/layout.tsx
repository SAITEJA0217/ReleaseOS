import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { ShieldCheck, Layers, PlusCircle, Activity, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ReleaseOS — AI Release Communication & Readiness Assistant',
  description: 'Evidence-backed release brief intelligence with deterministic claim verification, human review gating, and version traceability.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian-900 text-slate-100 min-h-screen flex flex-col selection:bg-accent-blue/30 selection:text-white">
        {/* Top Operational Navigation */}
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-obsidian-950/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold tracking-tight text-white text-lg">Release<span className="text-accent-blue">OS</span></span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-950/80 text-accent-blue border border-blue-800/60 font-semibold tracking-wider">
                      Readiness Engine
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Traceable Release Intelligence</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-800">
                <Link
                  href="/"
                  className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-md transition-colors flex items-center space-x-2"
                >
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/releases/create"
                  className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-md transition-colors flex items-center space-x-2"
                >
                  <PlusCircle className="w-4 h-4 text-slate-400" />
                  <span>Create Release</span>
                </Link>
              </nav>
            </div>

            {/* Safety & System Indicator */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Human Review Gated</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Zero-Deploy Safety Lock</span>
              </div>

              <Link
                href="/releases/create"
                className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-glow transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">New Release</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-850 bg-obsidian-950 py-6 mt-16 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-accent-blue" />
              <span>ReleaseOS — Evidence-backed release communication assistant.</span>
            </div>
            <div className="flex items-center space-x-4 text-slate-400">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Prisma Persistent DB</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-accent-blue" />
                <span>Dual AI Mode (Live/Deterministic)</span>
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
