"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    logout,
    getStockSummary,
    getSalesPersonStockStatus,
    getDispatches,
    getSales,
    getTodayString,
    initializeStore,
    getProducts,
} from "@/lib/store";
import type { Product } from "@/lib/store";
import { exportToCSV } from "@/lib/export";

export default function AdminDashboard() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [dateFilter, setDateFilter] = useState(getTodayString());
    const [greeting, setGreeting] = useState("Good Morning");
    const [summary, setSummary] = useState({ totalDispatched: 0, totalSold: 0, remainingStock: 0, totalRevenue: 0 });
    const [salesPersonStatus, setSalesPersonStatus] = useState<ReturnType<typeof getSalesPersonStockStatus>>([]);
    const [recentDispatches, setRecentDispatches] = useState<ReturnType<typeof getDispatches>>([]);
    const [recentSales, setRecentSales] = useState<ReturnType<typeof getSales>>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [activeTab, setActiveTab] = useState<"overview" | "dispatches" | "sales">("overview");
    const [showStockModal, setShowStockModal] = useState(false);
    const [showRevenueModal, setShowRevenueModal] = useState(false);
    const [showStockSoldModal, setShowStockSoldModal] = useState(false);
    const [showStockSentModal, setShowStockSentModal] = useState(false);
    const [shopSearch, setShopSearch] = useState("");

    const loadData = useCallback(() => {
        const s = getStockSummary(undefined, dateFilter);
        setSummary(s);
        setSalesPersonStatus(getSalesPersonStockStatus());
        setRecentDispatches(getDispatches().filter((d) => d.date === dateFilter).reverse());
        setRecentSales(getSales().filter((s) => s.date === dateFilter).reverse());
        setProducts(getProducts());
    }, [dateFilter]);

    useEffect(() => {
        initializeStore();
        const user = getCurrentUser();
        if (!user || user.role !== "admin") {
            router.replace("/");
            return;
        }
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good Morning");
        else if (hour < 17) setGreeting("Good Afternoon");
        else setGreeting("Good Evening");
        
        setMounted(true);
        loadData();
    }, [router, loadData]);

    useEffect(() => {
        if (mounted) loadData();
    }, [dateFilter, mounted, loadData]);

    const handleLogout = () => {
        logout();
        router.replace("/");
    };

    const handleExportDispatches = () => {
        const data = recentDispatches.map((d) => ({
            Date: d.date,
            Product: d.productName,
            Quantity: d.quantity,
            "Price/kg": d.pricePerUnit,
            "Sales Person": d.salesPersonName,
            "Total Value": d.quantity * d.pricePerUnit,
        }));
        exportToCSV(data, `dispatches_${dateFilter}`);
    };

    const handleExportSales = () => {
        const data = recentSales.map((s) => ({
            Date: s.date,
            Product: s.productName,
            "Qty Sold": s.quantitySold,
            "Price/kg": s.pricePerUnit,
            Customer: s.customerName || "—",
            "Sales Person": s.salesPersonName,
            "Total Amount": s.quantitySold * s.pricePerUnit,
        }));
        exportToCSV(data, `sales_${dateFilter}`);
    };


    if (!mounted) {
        return (
            <div className="dash-page">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                    <div className="dash-loader">
                        <div className="dash-loader-ring" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dash-page">
            {/* Ambient Background */}
            <div className="dash-bg" style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
                <div className="dash-bg-orb dash-bg-orb-1" />
                <div className="dash-bg-orb dash-bg-orb-2" />
                <div className="dash-bg-orb dash-bg-orb-3" />
                <div className="dash-bg-grid" />
            </div>

            {/* Header */}
            <header className="dash-header" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,4,23,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <div className="dash-header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="dash-header-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="dash-header-logo">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="dash-header-title">Total Wholesall</h1>
                            <p className="dash-header-sub">Admin Control Center</p>
                        </div>
                    </div>
                    <div className="dash-header-right">
                        <button onClick={handleLogout} className="dash-logout-btn" title="Logout">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Greeting Section */}
                <div className="dash-greeting fade-in" style={{ padding: "24px 28px", borderRadius: 20, background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08))", border: "1px solid rgba(99,102,241,0.15)", position: "relative", overflow: "hidden" }}>
                    <div className="dash-greeting-content" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                        <div>
                            <h2 className="dash-greeting-text">{greeting}, Admin 👋</h2>
                            <p className="dash-greeting-sub">Here&apos;s your business overview for today</p>
                        </div>
                        <div className="dash-date-filter" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.95rem" }}>
                                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                            <span style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>Today</span>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation */}
                <div className="dash-nav-grid fade-in" style={{ animationDelay: "0.05s", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                    {[
                        { label: "New Dispatch", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>, color: "#6366f1", href: "/admin/dispatch", primary: true },
                        { label: "Products", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>, color: "#8b5cf6", href: "/admin/products" },
                        { label: "Staff", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, color: "#06b6d4", href: "/admin/users" },
                        { label: "Drivers", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>, color: "#f59e0b", href: "/admin/drivers" },
                        { label: "Reports", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>, color: "#10b981", href: "/admin/reports" },
                    ].map((item) => (
                        <button
                            key={item.label}
                            onClick={() => router.push(item.href)}
                            className={`dash-nav-item ${item.primary ? 'dash-nav-item-primary' : ''}`}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "18px 12px", borderRadius: 16, border: "1px solid rgba(99,102,241,0.1)", cursor: "pointer", background: item.primary ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.15))" : "rgba(30,27,75,0.4)" }}
                        >
                            <div className="dash-nav-icon" style={{ '--nav-color': item.color, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)", color: item.color } as React.CSSProperties}>
                                {item.icon}
                            </div>
                            <span className="dash-nav-label">{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Stat Cards */}
                <div className="dash-stats-grid fade-in" style={{ animationDelay: "0.1s", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    <button className="dash-stat-card dash-stat-sent" onClick={() => setShowStockSentModal(true)} style={{ textAlign: "left", width: "100%", position: "relative", padding: 24, borderRadius: 20, cursor: "pointer", overflow: "hidden", border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))" }}>
                        <div className="dash-stat-glow" style={{ pointerEvents: "none" }} />
                        <div className="dash-stat-icon-wrap" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                        </div>
                        <div className="dash-stat-value">{summary.totalDispatched.toLocaleString()}</div>
                        <div className="dash-stat-label">Stock Sent</div>
                        <div className="dash-stat-badge">View Details →</div>
                    </button>

                    <button className="dash-stat-card dash-stat-sold" onClick={() => setShowStockSoldModal(true)} style={{ textAlign: "left", width: "100%", position: "relative", padding: 24, borderRadius: 20, cursor: "pointer", overflow: "hidden", border: "1px solid rgba(16,185,129,0.15)", background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))" }}>
                        <div className="dash-stat-glow" style={{ pointerEvents: "none" }} />
                        <div className="dash-stat-icon-wrap" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        <div className="dash-stat-value">{summary.totalSold.toLocaleString()}</div>
                        <div className="dash-stat-label">Stock Sold</div>
                        <div className="dash-stat-badge">View Details →</div>
                    </button>

                    <button className="dash-stat-card dash-stat-warehouse" onClick={() => setShowStockModal(true)} style={{ textAlign: "left", width: "100%", position: "relative", padding: 24, borderRadius: 20, cursor: "pointer", overflow: "hidden", border: "1px solid rgba(139,92,246,0.15)", background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))" }}>
                        <div className="dash-stat-glow" style={{ pointerEvents: "none" }} />
                        <div className="dash-stat-icon-wrap" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                        </div>
                        <div className="dash-stat-value">View All</div>
                        <div className="dash-stat-label">Warehouse Stock</div>
                        <div className="dash-stat-badge">View Details →</div>
                    </button>

                    <button className="dash-stat-card dash-stat-revenue" onClick={() => setShowRevenueModal(true)} style={{ textAlign: "left", width: "100%", position: "relative", padding: 24, borderRadius: 20, cursor: "pointer", overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)", background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))" }}>
                        <div className="dash-stat-glow" style={{ pointerEvents: "none" }} />
                        <div className="dash-stat-icon-wrap" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </div>
                        <div className="dash-stat-value">₹{summary.totalRevenue.toLocaleString()}</div>
                        <div className="dash-stat-label">Total Revenue</div>
                        <div className="dash-stat-badge">View Details →</div>
                    </button>
                </div>

                {/* Tabs */}
                <div className="dash-tabs fade-in" style={{ animationDelay: "0.15s", display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(15,10,46,0.6)", border: "1px solid rgba(99,102,241,0.1)" }}>
                    {(["overview", "dispatches", "sales"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`dash-tab ${activeTab === tab ? 'dash-tab-active' : ''}`}
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "none", background: activeTab === tab ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "transparent", color: activeTab === tab ? "#ffffff" : "#64748b", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}
                        >
                            {tab === "overview" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>}
                            {tab === "dispatches" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
                            {tab === "sales" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>}
                            <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                    <div className="dash-section fade-in" style={{ borderRadius: 20, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.1)", overflow: "hidden" }}>
                        <div className="dash-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(99,102,241,0.08)" }}>
                            <h3 className="dash-section-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                Sales Person Stock Status
                            </h3>
                        </div>
                        <div className="dash-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Sales Person</th>
                                        <th>Dispatched</th>
                                        <th>Sold</th>
                                        <th>Remaining</th>
                                        <th>Revenue</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesPersonStatus.map((sp) => (
                                        <tr key={sp.id}>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div className="dash-avatar" style={{ '--avatar-color': '#6366f1' } as React.CSSProperties}>
                                                        {sp.name.charAt(0)}
                                                    </div>
                                                    <span className="font-medium" style={{ color: "#e2e8f0" }}>{sp.name}</span>
                                                </div>
                                            </td>
                                            <td><span className="dash-num">{sp.totalDispatched}</span></td>
                                            <td><span className="dash-num">{sp.totalSold}</span></td>
                                            <td><span className="dash-num">{sp.remainingStock}</span></td>
                                            <td style={{ color: "#34d399", fontWeight: 600 }}>₹{sp.totalRevenue.toLocaleString()}</td>
                                            <td>
                                                {sp.remainingStock < 0 ? (
                                                    <span className="badge badge-danger">⚠ Mismatch</span>
                                                ) : sp.remainingStock === 0 && sp.totalDispatched > 0 ? (
                                                    <span className="badge badge-success">All Sold</span>
                                                ) : sp.totalDispatched === 0 ? (
                                                    <span className="badge" style={{ background: "rgba(100,116,139,0.15)", color: "#94a3b8" }}>No Stock</span>
                                                ) : (
                                                    <span className="badge badge-warning">In Progress</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {salesPersonStatus.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8" style={{ color: "#64748b" }}>
                                                No sales persons found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Dispatches Tab */}
                {activeTab === "dispatches" && (
                    <div className="dash-section fade-in" style={{ borderRadius: 20, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.1)", overflow: "hidden" }}>
                        <div className="dash-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(99,102,241,0.08)" }}>
                            <h3 className="dash-section-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                                Dispatches — {dateFilter}
                            </h3>
                            <button onClick={handleExportDispatches} className="dash-export-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Export CSV
                            </button>
                        </div>
                        <div className="dash-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Qty</th>
                                        <th>Price/kg</th>
                                        <th>Sales Person</th>
                                        <th>Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentDispatches.map((d) => (
                                        <tr key={d.id}>
                                            <td className="font-medium" style={{ color: "#e2e8f0" }}>{d.productName}</td>
                                            <td><span className="dash-num">{d.quantity}</span></td>
                                            <td>₹{d.pricePerUnit}</td>
                                            <td>{d.salesPersonName}</td>
                                            <td style={{ color: "#818cf8", fontWeight: 600 }}>₹{(d.quantity * d.pricePerUnit).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {recentDispatches.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8" style={{ color: "#64748b" }}>No dispatches for this date</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Sales Tab */}
                {activeTab === "sales" && (
                    <div className="dash-section fade-in" style={{ borderRadius: 20, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.1)", overflow: "hidden" }}>
                        <div className="dash-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(99,102,241,0.08)" }}>
                            <h3 className="dash-section-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                                Sales — {dateFilter}
                            </h3>
                            <button onClick={handleExportSales} className="dash-export-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Export CSV
                            </button>
                        </div>
                        <div className="dash-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Qty Sold</th>
                                        <th>Customer</th>
                                        <th>Sales Person</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSales.map((s) => (
                                        <tr key={s.id}>
                                            <td className="font-medium" style={{ color: "#e2e8f0" }}>{s.productName}</td>
                                            <td><span className="dash-num">{s.quantitySold}</span></td>
                                            <td>{s.customerName || "—"}</td>
                                            <td>{s.salesPersonName}</td>
                                            <td style={{ color: "#34d399", fontWeight: 600 }}>₹{(s.quantitySold * s.pricePerUnit).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {recentSales.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8" style={{ color: "#64748b" }}>No sales for this date</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* ===== MODALS ===== */}

            {/* Warehouse Stock Modal */}
            {showStockModal && (
                <ModalWrapper onClose={() => setShowStockModal(false)} title="Warehouse Stock" subtitle="Current available items in factory" icon="🏢" iconBg="rgba(99, 102, 241, 0.15)">
                    <div className="dash-table-wrap">
                        <table className="data-table w-full mb-0">
                            <thead><tr><th className="text-left pl-4">Product Name</th><th className="text-right">Price/kg</th><th className="text-right pr-4">Total Stock</th></tr></thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr><td colSpan={3} className="text-center py-8 text-slate-400">No products found.</td></tr>
                                ) : (
                                    products.map((p) => (
                                        <tr key={p.id}>
                                            <td className="font-medium pl-4" style={{ color: "#e2e8f0" }}>{p.name}</td>
                                            <td className="text-right" style={{ color: "#34d399" }}>₹{p.pricePerUnit}</td>
                                            <td className="text-right pr-4">
                                                <span className="font-bold px-3 py-1 rounded-lg" style={{ background: p.totalStock > 100 ? "rgba(99, 102, 241, 0.15)" : "rgba(239, 68, 68, 0.15)", color: p.totalStock > 100 ? "#c7d2fe" : "#fca5a5" }}>
                                                    {p.totalStock} kg
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </ModalWrapper>
            )}

            {/* Revenue Breakdown Modal */}
            {showRevenueModal && (
                <ModalWrapper onClose={() => setShowRevenueModal(false)} title="Revenue Breakdown" subtitle="Kis ne, kis din, kya becha, kitna revenue aaya — poori detail" icon="💰" iconBg="rgba(6, 182, 212, 0.15)">
                    <div className="p-5 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        <input type="text" placeholder="Search by name, product, customer, date..." className="input-field w-full" value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} />
                    </div>
                    {/* Summary Cards */}
                    {(() => {
                        const allSales = getSales();
                        const q = shopSearch.toLowerCase();
                        const filtered = allSales.filter(s => {
                            if (!shopSearch) return true;
                            const searchStr = `${s.salesPersonName} ${s.productName} ${s.customerName || ""} ${s.shopNumber || ""} ${s.date}`.toLowerCase();
                            return searchStr.includes(q);
                        }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
                        const grandTotal = filtered.reduce((sum, s) => sum + s.quantitySold * s.pricePerUnit, 0);
                        const totalQty = filtered.reduce((sum, s) => sum + s.quantitySold, 0);

                        // Group by salesperson for summary
                        const spMap: Record<string, { name: string, revenue: number, qty: number }> = {};
                        filtered.forEach(s => {
                            if (!spMap[s.salesPersonId]) spMap[s.salesPersonId] = { name: s.salesPersonName, revenue: 0, qty: 0 };
                            spMap[s.salesPersonId].revenue += s.quantitySold * s.pricePerUnit;
                            spMap[s.salesPersonId].qty += s.quantitySold;
                        });
                        const spSummary = Object.values(spMap).sort((a, b) => b.revenue - a.revenue);

                        return (
                            <>
                                {/* Per-Salesperson Summary */}
                                <div className="p-5 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}>
                                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>Salesperson-wise Revenue</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {spSummary.map((sp, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>{sp.name.charAt(0)}</div>
                                                    <div>
                                                        <div className="font-bold text-sm" style={{ color: "#e2e8f0" }}>{sp.name}</div>
                                                        <div className="text-xs" style={{ color: "#64748b" }}>{sp.qty} items sold</div>
                                                    </div>
                                                </div>
                                                <div className="font-black text-base" style={{ color: "#34d399" }}>₹{sp.revenue.toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Detailed Table */}
                                <div className="dash-table-wrap" style={{ padding: "0" }}>
                                    <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>All Sales — Detail View ({filtered.length} entries)</div>
                                    </div>
                                    <table className="data-table w-full mb-0">
                                        <thead>
                                            <tr>
                                                <th className="text-left pl-4">Date</th>
                                                <th className="text-left">Sales Person</th>
                                                <th className="text-left">Product</th>
                                                <th className="text-left">Customer / Shop</th>
                                                <th className="text-right">Qty</th>
                                                <th className="text-right pr-4">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No revenue data found.</td></tr>
                                            ) : (
                                                <>
                                                    {filtered.map((s, idx) => (
                                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                            <td className="pl-4 text-sm" style={{ color: "#94a3b8" }}>{s.date}</td>
                                                            <td>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>{s.salesPersonName.charAt(0)}</div>
                                                                    <span className="text-sm font-medium" style={{ color: "#e2e8f0" }}>{s.salesPersonName}</span>
                                                                </div>
                                                            </td>
                                                            <td className="text-sm font-semibold" style={{ color: "#60a5fa" }}>{s.productName}</td>
                                                            <td className="text-sm" style={{ color: "#94a3b8" }}>{s.shopNumber || s.customerName || "—"}</td>
                                                            <td className="text-right text-sm font-bold" style={{ color: "#cbd5e1" }}>{s.quantitySold}</td>
                                                            <td className="text-right pr-4 font-bold text-sm" style={{ color: "#34d399" }}>₹{(s.quantitySold * s.pricePerUnit).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Grand Total Row */}
                                                    <tr style={{ borderTop: "2px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)" }}>
                                                        <td colSpan={4} className="pl-4 font-black text-sm" style={{ color: "#e2e8f0" }}>📊 GRAND TOTAL</td>
                                                        <td className="text-right font-black text-sm" style={{ color: "#818cf8" }}>{totalQty}</td>
                                                        <td className="text-right pr-4 font-black text-base" style={{ color: "#34d399" }}>₹{grandTotal.toLocaleString()}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        );
                    })()}
                </ModalWrapper>
            )}

            {/* Stock Sold Breakdown Modal */}
            {showStockSoldModal && (
                <ModalWrapper onClose={() => setShowStockSoldModal(false)} title="Stock Sold Breakdown" subtitle="Kis dukan ko kya samaan aur kitna becha gaya" icon="✅" iconBg="rgba(52, 211, 153, 0.15)">
                    <div className="p-5 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        <input type="text" placeholder="Search by Shop Name, Customer or Product..." className="input-field w-full" value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} />
                    </div>
                    <div className="dash-table-wrap" style={{ padding: "20px" }}>
                        <table className="data-table w-full mb-0">
                            <thead><tr><th className="text-left pl-4">Shop / Customer</th><th className="text-left">Sales Person</th><th className="text-left">Product</th><th className="text-right pr-4">Qty Sold</th></tr></thead>
                            <tbody>
                                {(() => {
                                    const map: Record<string, { shopName: string, salesPerson: string, product: string, qty: number }> = {};
                                    recentSales.forEach(s => {
                                        const shopName = s.shopNumber || s.customerName || "Unknown Shop/Customer";
                                        const searchStr = `${shopName} ${s.customerName} ${s.productName}`.toLowerCase();
                                        if (shopSearch && !searchStr.includes(shopSearch.toLowerCase())) return;
                                        const key = `${shopName}-${s.salesPersonName}-${s.productName}`;
                                        if (!map[key]) map[key] = { shopName, salesPerson: s.salesPersonName, product: s.productName, qty: 0 };
                                        map[key].qty += s.quantitySold;
                                    });
                                    const groupedStock = Object.values(map).sort((a, b) => b.qty - a.qty);
                                    if (groupedStock.length === 0) return (<tr><td colSpan={4} className="text-center py-8 text-slate-400">No stock sold data found.</td></tr>);
                                    return groupedStock.map((item, idx) => (
                                        <tr key={idx}><td className="font-medium pl-4" style={{ color: "#e2e8f0" }}>{item.shopName}</td><td style={{ color: "#94a3b8" }}>{item.salesPerson}</td><td style={{ color: "#60a5fa" }}>{item.product}</td><td className="text-right pr-4 font-bold" style={{ color: "#34d399" }}>{item.qty} kg</td></tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </ModalWrapper>
            )}

            {/* Stock Sent Breakdown Modal */}
            {showStockSentModal && (
                <ModalWrapper onClose={() => setShowStockSentModal(false)} title="Stock Sent Breakdown" subtitle="Kis salesman ko konsa product diya gaya" icon="📦" iconBg="rgba(129, 140, 248, 0.15)">
                    <div className="p-5 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        <input type="text" placeholder="Search by Sales Person or Product Name..." className="input-field w-full" value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} />
                    </div>
                    <div className="dash-table-wrap" style={{ padding: "20px" }}>
                        <table className="data-table w-full mb-0">
                            <thead><tr><th className="text-left pl-4">Sales Person</th><th className="text-left">Product</th><th className="text-right pr-4">Qty Sent</th></tr></thead>
                            <tbody>
                                {(() => {
                                    const map: Record<string, { salesPerson: string, product: string, qty: number }> = {};
                                    recentDispatches.forEach(d => {
                                        const searchStr = `${d.salesPersonName} ${d.productName}`.toLowerCase();
                                        if (shopSearch && !searchStr.includes(shopSearch.toLowerCase())) return;
                                        const key = `${d.salesPersonName}-${d.productName}`;
                                        if (!map[key]) map[key] = { salesPerson: d.salesPersonName, product: d.productName, qty: 0 };
                                        map[key].qty += d.quantity;
                                    });
                                    const groupedSent = Object.values(map).sort((a, b) => b.qty - a.qty);
                                    if (groupedSent.length === 0) return (<tr><td colSpan={3} className="text-center py-8 text-slate-400">No stock sent data found.</td></tr>);
                                    return groupedSent.map((item, idx) => (
                                        <tr key={idx}><td className="font-medium pl-4" style={{ color: "#e2e8f0" }}>{item.salesPerson}</td><td style={{ color: "#60a5fa" }}>{item.product}</td><td className="text-right pr-4 font-bold" style={{ color: "#818cf8" }}>{item.qty} kg</td></tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </ModalWrapper>
            )}
        </div>
    );
}

/* ===== MODAL WRAPPER ===== */
function ModalWrapper({ onClose, title, subtitle, icon, iconBg, children }: {
    onClose: () => void;
    title: string;
    subtitle: string;
    icon: string;
    iconBg: string;
    children: React.ReactNode;
}) {
    return (
        <div className="dash-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="dash-modal fade-in">
                <div className="dash-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="dash-modal-icon" style={{ background: iconBg }}><span style={{ fontSize: "20px" }}>{icon}</span></div>
                        <div>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e8f0" }}>{title}</h2>
                            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{subtitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="dash-modal-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
                {children}
                <div className="dash-modal-footer">
                    <button onClick={onClose} className="btn-secondary px-6">Close</button>
                </div>
            </div>
        </div>
    );
}
