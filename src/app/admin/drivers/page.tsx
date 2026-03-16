"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    getSalesPersons,
    getDriverLocations,
    initializeStore,
} from "@/lib/store";
import type { User, DriverLocation } from "@/lib/store";

function timeAgo(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
}

function isActive(lastUpdated: string): boolean {
    const diff = Date.now() - new Date(lastUpdated).getTime();
    return diff < 30 * 60 * 1000; // 30 minutes
}

export default function DriversPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [salesPersons, setSalesPersons] = useState<User[]>([]);
    const [locations, setLocations] = useState<DriverLocation[]>([]);
    const [search, setSearch] = useState("");

    const loadData = useCallback(() => {
        setSalesPersons(getSalesPersons());
        setLocations(getDriverLocations());
    }, []);

    useEffect(() => {
        initializeStore();
        const user = getCurrentUser();
        if (!user || user.role !== "admin") {
            router.replace("/");
            return;
        }
        setMounted(true);
        loadData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [router, loadData]);

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0a2e" }}>
                <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    // Merge salespersons with their locations
    const driverData = salesPersons
        .filter(sp => sp.name.toLowerCase().includes(search.toLowerCase()))
        .map(sp => {
            const loc = locations.find(l => l.userId === sp.id);
            return { ...sp, location: loc || null };
        });

    const activeCount = driverData.filter(d => d.location && isActive(d.location.lastUpdated)).length;
    const offlineCount = driverData.length - activeCount;

    return (
        <div className="dash-page">
            {/* Ambient Background */}
            <div className="dash-bg" style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
                <div className="dash-bg-orb dash-bg-orb-1" style={{ top: "-10%", left: "50%", width: 600, height: 600, transform: "translateX(-50%)", background: "rgba(52, 211, 153, 0.15)" }} />
                <div className="dash-bg-orb dash-bg-orb-2" style={{ top: "40%", right: "-10%", background: "rgba(245, 158, 11, 0.15)" }} />
                <div className="dash-bg-grid" />
            </div>
            {/* Header */}
            <header className="dash-header" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,4,23,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <div className="dash-header-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="dash-header-left" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button 
                            onClick={() => router.push("/admin/dashboard")} 
                            className="dash-nav-icon" 
                            style={{ '--nav-color': '#94a3b8', width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" } as React.CSSProperties}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <div>
                            <h1 className="dash-header-title" style={{ fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                Driver Locations
                            </h1>
                            <p className="dash-header-sub">Track active sales personnel in real-time</p>
                        </div>
                    </div>
                    <button onClick={loadData} className="px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontWeight: "bold", fontSize: "0.85rem" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Refresh
                    </button>
                </div>
            </header>

            <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>
                {/* Stats Row */}
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl flex items-center gap-4 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(99,102,241,0.05))", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div>
                            <div className="text-3xl font-black" style={{ color: "#e2e8f0" }}>{driverData.length}</div>
                            <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Total Drivers</div>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl flex items-center gap-4 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }}>
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
                        <div className="w-14 h-14 rounded-full flex items-center justify-center relative z-10" style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-3xl font-black" style={{ color: "#34d399" }}>{activeCount}</div>
                            <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Active Now</div>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl flex items-center gap-4 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(100,116,139,0.05))", border: "1px solid rgba(100,116,139,0.2)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(100,116,139,0.15)", color: "#94a3b8" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div>
                            <div className="text-3xl font-black" style={{ color: "#94a3b8" }}>{offlineCount}</div>
                            <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Offline</div>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="relative fade-in" style={{ animationDelay: "0.1s" }}>
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <input
                        type="text"
                        className="w-full py-4 pl-12 pr-4 rounded-2xl text-lg transition-all focus:outline-none"
                        placeholder="Search driver by name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ 
                            background: "rgba(255,255,255,0.03)", 
                            border: "1px solid rgba(255,255,255,0.1)", 
                            color: "#f8fafc",
                            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)"
                        }}
                    />
                </div>

                {/* Driver Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {driverData.map((driver) => {
                        const loc = driver.location;
                        const active = loc ? isActive(loc.lastUpdated) : false;

                        return (
                            <div key={driver.id} className="glass-card p-5 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg" style={{ borderLeft: `3px solid ${active ? "#34d399" : "#475569"}` }}>
                                {/* Glow effect for active */}
                                {active && (
                                    <div className="absolute top-0 right-0 w-24 h-24 rounded-full" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
                                )}

                                {/* Header row */}
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 shadow-lg relative z-10" style={{ background: active ? "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.3))" : "linear-gradient(135deg, rgba(148,163,184,0.1), rgba(100,116,139,0.2))", color: active ? "#34d399" : "#94a3b8", border: `1px solid ${active ? "rgba(52,211,153,0.4)" : "rgba(148,163,184,0.2)"}` }}>
                                            {driver.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="relative z-10">
                                            <div className="font-bold text-lg" style={{ color: "#f8fafc" }}>{driver.name}</div>
                                            <div className="text-xs font-medium flex items-center gap-1.5 mt-0.5" style={{ color: "#94a3b8" }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                                ID: {driver.loginId}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative z-10 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase flex items-center gap-1.5" style={{
                                        background: active ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                        color: active ? "#34d399" : "#64748b",
                                        border: `1px solid ${active ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
                                    }}>
                                        {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                        {active ? "Active" : "Offline"}
                                    </div>
                                </div>

                                {/* Location info */}
                                {loc ? (
                                    <div className="space-y-3 relative z-10 p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.03)" }}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                            </div>
                                            <div>
                                                <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: "#64748b" }}>Current Location</div>
                                                <a 
                                                    href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-base font-bold leading-tight hover:underline flex items-center gap-1.5" 
                                                    style={{ color: "#fbbf24" }}
                                                    title="Open in Google Maps"
                                                >
                                                    {loc.areaName}
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                </a>
                                                <div className="text-[11px] font-mono mt-2 flex items-center gap-1.5" style={{ color: "#94a3b8" }}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                                                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                <span className="text-xs font-semibold" style={{ color: "#64748b" }}>Updated</span>
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: "#cbd5e1" }}>{timeAgo(loc.lastUpdated)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center relative z-10 rounded-xl" style={{ background: "rgba(0,0,0,0.1)", border: "1px dashed rgba(255,255,255,0.05)" }}>
                                        <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                                        </div>
                                        <p className="text-sm font-bold" style={{ color: "#64748b" }}>No Location Data</p>
                                        <p className="text-xs mt-1" style={{ color: "#475569" }}>Waiting for driver to login</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {driverData.length === 0 && (
                    <div className="glass-card p-12 text-center">
                        <div className="text-4xl mb-3 opacity-50">🚗</div>
                        <p style={{ color: "#64748b" }}>No drivers found</p>
                    </div>
                )}

                {/* Info note */}
                <div className="p-4 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-white/5" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                        <span style={{ color: "#e2e8f0" }}>Real-time syncing:</span> Locations auto-refresh every 30 seconds when drivers log into their panel.
                    </p>
                </div>
            </main>
        </div>
    );
}
