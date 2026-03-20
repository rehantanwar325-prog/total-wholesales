"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getSalesPersons, addSalesPerson, updateSalesPerson, deleteSalesPerson, initializeStore } from "@/lib/store";
import type { User } from "@/lib/store";

export default function ManageUsersPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [salesPersons, setSalesPersons] = useState<User[]>([]);

    // Form state
    const [name, setName] = useState("");
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // Edit state
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editName, setEditName] = useState("");
    const [editLoginId, setEditLoginId] = useState("");
    const [editPassword, setEditPassword] = useState("");

    useEffect(() => {
        initializeStore();
        const user = getCurrentUser();
        if (!user || user.role !== "admin") {
            router.replace("/");
            return;
        }
        setSalesPersons(getSalesPersons());
        setMounted(true);
    }, [router]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Simple validation
        if (salesPersons.some(sp => sp.loginId.toLowerCase() === loginId.toLowerCase())) {
            setError("A user with this Login ID already exists.");
            return;
        }

        try {
            addSalesPerson({ name, loginId, password });
            setSuccess(`Successfully added ${name} as a Sales Person.`);
            setName("");
            setLoginId("");
            setPassword("");
            setSalesPersons(getSalesPersons()); // Refresh list
            setTimeout(() => setSuccess(""), 3000);
        } catch {
            setError("Failed to create user.");
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!editingUser) return;

        // Check if new loginId is taken by SOMEONE ELSE
        if (
            editLoginId.toLowerCase() !== editingUser.loginId.toLowerCase() &&
            salesPersons.some(sp => sp.loginId.toLowerCase() === editLoginId.toLowerCase())
        ) {
            setError("A user with this Login ID already exists.");
            return;
        }

        try {
            const updates: Partial<User> = { name: editName, loginId: editLoginId };
            if (editPassword) {
                updates.password = editPassword;
            }
            updateSalesPerson(editingUser.id, updates);
            setSuccess(`Successfully updated ${editName}.`);
            setEditingUser(null);
            setSalesPersons(getSalesPersons()); // Refresh list
            setTimeout(() => setSuccess(""), 3000);
        } catch {
            setError("Failed to update user.");
        }
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
            try {
                const updatedUsers = deleteSalesPerson(id);
                setSalesPersons(updatedUsers);
                setSuccess(`Successfully deleted ${name}.`);
                setTimeout(() => setSuccess(""), 3000);
            } catch {
                setError("Failed to delete user.");
            }
        }
    };

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0a2e" }}>
                <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="dash-page">
            {/* Ambient Background */}
            <div className="dash-bg" style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
                <div className="dash-bg-orb dash-bg-orb-1" style={{ top: "-10%", left: "40%", width: 600, height: 600, transform: "translateX(-50%)", background: "rgba(236, 72, 153, 0.15)" }} />
                <div className="dash-bg-orb dash-bg-orb-2" style={{ top: "40%", right: "-10%", background: "rgba(59, 130, 246, 0.15)" }} />
                <div className="dash-bg-grid" />
            </div>
            {success && (
                <div className="toast" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    {success}
                </div>
            )}
            {error && (
                <div className="toast" style={{ background: "rgba(248, 113, 113, 0.2)", color: "#f87171", border: "1px solid rgba(248, 113, 113, 0.3)" }}>
                    {error}
                </div>
            )}

            {/* Header */}
            <header className="dash-header" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,4,23,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <div className="dash-header-inner" style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="dash-header-left" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button 
                            onClick={() => router.push("/admin/dashboard")} 
                            className="dash-nav-icon" 
                            style={{ '--nav-color': '#94a3b8', width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" } as React.CSSProperties}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <div>
                            <h1 className="dash-header-title" style={{ fontSize: "1.25rem" }}>Manage Staff</h1>
                            <p className="dash-header-sub">View, add, and update sales/delivery personnel</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>
                {/* Add New Staff Form */}
                <div className="dash-section fade-in" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", overflow: "hidden", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                    <div className="mb-6 flex items-center gap-4">
                        <div className="dash-stat-icon-wrap" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 0, background: "rgba(236,72,153,0.1)", color: "#f472b6" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Add New Sales Person</h2>
                            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Create a new account for a delivery/sales driver</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-5 items-end">
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Full Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={{ background: "rgba(0,0,0,0.2)" }}
                                />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    Login ID *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Login ID"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    required
                                    style={{ background: "rgba(0,0,0,0.2)" }}
                                />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Password *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. password123"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    style={{ background: "rgba(0,0,0,0.2)" }}
                                />
                            </div>
                            <div>
                                <button type="submit" className="w-full py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-white font-bold cursor-pointer transition-all hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)", border: "none", boxShadow: "0 4px 15px rgba(236, 72, 153, 0.3)" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    Add 
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Staff List */}
                <div className="dash-section fade-in" style={{ animationDelay: "0.1s", borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", overflow: "hidden", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                    <div className="flex items-center gap-3 mb-6">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Active Sales Persons</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {salesPersons.map((sp) => (
                            <div key={sp.id} className="p-5 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01]" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 font-bold" style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(59,130,246,0.15))", color: "#f472b6", border: "1px solid rgba(236,72,153,0.2)" }}>
                                        {sp.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="truncate">
                                        <div className="font-bold text-base truncate" style={{ color: "#f8fafc" }} title={sp.name}>{sp.name}</div>
                                        <div className="text-sm mt-0.5 truncate flex items-center gap-1.5" style={{ color: "#94a3b8" }} title={sp.loginId}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                            {sp.loginId}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => {
                                            setEditingUser(sp);
                                            setEditName(sp.name);
                                            setEditLoginId(sp.loginId);
                                            setEditPassword(""); // Reset password field
                                        }}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10"
                                        style={{ color: "#60a5fa", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}
                                        title="Edit Staff Member"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sp.id, sp.name)}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10 text-red-400"
                                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
                                        title="Delete Staff Member"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(6, 4, 23, 0.8)", backdropFilter: "blur(8px)" }}>
                    <div className="dash-section w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-200" style={{ borderRadius: 24, background: "rgba(15,10,46,0.9)", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <button
                            onClick={() => setEditingUser(null)}
                            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            style={{ color: "#94a3b8" }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </div>
                            <h2 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Edit Staff Member</h2>
                        </div>

                        <form onSubmit={handleEditSubmit} className="space-y-5">
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                    style={{ background: "rgba(0,0,0,0.3)" }}
                                />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    Login ID *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editLoginId}
                                    onChange={(e) => setEditLoginId(e.target.value)}
                                    required
                                    style={{ background: "rgba(0,0,0,0.3)" }}
                                />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Password
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    placeholder="Leave blank to keep current password"
                                    minLength={6}
                                    style={{ background: "rgba(0,0,0,0.3)" }}
                                />
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 rounded-xl font-bold transition-all" style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#e2e8f0" }}>
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)" }}>
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
