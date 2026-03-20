"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    getProducts,
    getSalesPersons,
    addDispatch,
    getTodayString,
    initializeStore,
} from "@/lib/store";
import type { Product, User } from "@/lib/store";

interface SelectedProduct {
    product: Product;
    quantity: string;
    pricePerUnit: string;
}

export default function DispatchPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesPersons, setSalesPersons] = useState<User[]>([]);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // Multi-select: map of productId -> SelectedProduct
    const [selected, setSelected] = useState<Record<string, SelectedProduct>>({});

    // Search
    const [productSearch, setProductSearch] = useState("");

    // Sales person & date
    const [salesPersonId, setSalesPersonId] = useState("");
    const [spSearch, setSpSearch] = useState("");
    const [date] = useState(getTodayString());

    useEffect(() => {
        initializeStore();
        const user = getCurrentUser();
        if (!user || user.role !== "admin") {
            router.replace("/");
            return;
        }
        setProducts(getProducts());
        setSalesPersons(getSalesPersons());
        setMounted(true);
    }, [router]);

    const toggleProduct = (p: Product) => {
        setSelected(prev => {
            const next = { ...prev };
            if (next[p.id]) {
                delete next[p.id];
            } else {
                next[p.id] = {
                    product: p,
                    quantity: "",
                    pricePerUnit: p.pricePerUnit.toString(),
                };
            }
            return next;
        });
    };

    const updateQuantity = (productId: string, qty: string) => {
        setSelected(prev => ({
            ...prev,
            [productId]: { ...prev[productId], quantity: qty },
        }));
    };

    const updatePrice = (productId: string, price: string) => {
        setSelected(prev => ({
            ...prev,
            [productId]: { ...prev[productId], pricePerUnit: price },
        }));
    };

    const selectedCount = Object.keys(selected).length;

    const grandTotal = Object.values(selected).reduce((sum, item) => {
        const q = parseInt(item.quantity) || 0;
        const p = parseFloat(item.pricePerUnit) || 0;
        return sum + q * p;
    }, 0);

    const totalQty = Object.values(selected).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedCount === 0) {
            setError("Koi product select karo pehle!");
            setTimeout(() => setError(""), 3000);
            return;
        }
        const salesPerson = salesPersons.find((sp) => sp.id === salesPersonId);
        if (!salesPerson) {
            setError("Sales person select karo!");
            setTimeout(() => setError(""), 3000);
            return;
        }

        // Validate all quantities
        for (const item of Object.values(selected)) {
            const q = parseInt(item.quantity);
            if (!q || q <= 0) {
                setError(`"${item.product.name}" ka quantity daalo!`);
                setTimeout(() => setError(""), 3000);
                return;
            }
            if (q > item.product.totalStock) {
                setError(`"${item.product.name}" mein sirf ${item.product.totalStock} kg stock hai!`);
                setTimeout(() => setError(""), 4000);
                return;
            }
        }

        setError("");

        try {
            for (const item of Object.values(selected)) {
                addDispatch({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: parseInt(item.quantity),
                    pricePerUnit: parseFloat(item.pricePerUnit),
                    salesPersonId,
                    salesPersonName: salesPerson.name,
                    date,
                });
            }

            setProducts(getProducts());
            setSuccess(`✅ ${selectedCount} product(s) dispatched successfully!`);
            setSelected({});
            setSalesPersonId("");
            setSpSearch("");
            setTimeout(() => setSuccess(""), 4000);
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to create dispatch");
            setProducts(getProducts());
        }
    };

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0a2e" }}>
                <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    const filteredProducts = products.filter(p => p.inStock !== false && p.name.toLowerCase().includes(productSearch.toLowerCase()));

    return (
        <div className="dash-page">
            {/* Ambient Background */}
            <div className="dash-bg" style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
                <div className="dash-bg-orb dash-bg-orb-1" style={{ top: "-10%", left: "50%", width: 600, height: 600, transform: "translateX(-50%)", background: "rgba(99, 102, 241, 0.25)" }} />
                <div className="dash-bg-orb dash-bg-orb-2" style={{ top: "30%", right: "-10%", background: "rgba(6, 182, 212, 0.2)" }} />
                <div className="dash-bg-grid" />
            </div>

            {/* Toasts */}
            {success && (
                <div className="toast" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    {success}
                </div>
            )}
            {error && (
                <div className="toast" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                    {error}
                </div>
            )}

            {/* Header */}
            <header className="dash-header" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,4,23,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <div className="dash-header-inner" style={{ maxWidth: 900, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="dash-header-left" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button
                            onClick={() => router.push("/admin/dashboard")}
                            className="dash-nav-icon"
                            style={{ '--nav-color': '#94a3b8', width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" } as React.CSSProperties}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                        </button>
                        <div>
                            <h1 className="dash-header-title" style={{ fontSize: "1.25rem" }}>New Dispatch Entry</h1>
                            <p className="dash-header-sub">Send products from factory</p>
                        </div>
                    </div>
                    {selectedCount > 0 && (
                        <span style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontSize: "0.8rem", fontWeight: 700, padding: "6px 14px", borderRadius: 10 }}>
                            {selectedCount} selected
                        </span>
                    )}
                </div>
            </header>

            <form onSubmit={handleSubmit}>
                <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

                    {/* Step 1: Sales Person */}
                    <div className="dash-section fade-in" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", padding: "28px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="mb-5 flex items-center gap-3">
                            <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: "1.1rem", fontWeight: 700 }}>1</div>
                            <div>
                                <h3 style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.1rem" }}>Sales Person & Date</h3>
                                <p style={{ color: "#64748b", fontSize: "0.8rem" }}>Kis driver ko maal dena hai?</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="form-label flex items-center gap-2 mb-3" style={{ fontSize: "0.9rem", color: "#e2e8f0" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                    Sales Person *
                                </label>
                                <div className="space-y-3">
                                    <input type="text" className="input-field w-full" placeholder="Type to filter..." value={spSearch} onChange={(e) => setSpSearch(e.target.value)} style={{ background: "rgba(0,0,0,0.2)" }} />
                                    <select className="input-field w-full" value={salesPersonId} onChange={(e) => setSalesPersonId(e.target.value)} required style={{ background: "rgba(0,0,0,0.2)" }}>
                                        <option value="">-- Assign to --</option>
                                        {salesPersons.filter(sp => sp.name.toLowerCase().includes(spSearch.toLowerCase())).map((sp) => (
                                            <option key={sp.id} value={sp.id}>{sp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-3" style={{ fontSize: "0.9rem", color: "#e2e8f0" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    Dispatch Date *
                                </label>
                                <input type="date" className="input-field w-full" value={date} disabled style={{ background: "rgba(0,0,0,0.1)", opacity: 0.7, cursor: "not-allowed", padding: "12px 16px" }} required />
                                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    Date is automatically set to today
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Select Products (checkboxes) */}
                    <div className="dash-section fade-in" style={{ animationDelay: "0.05s", borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", padding: "28px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="mb-5 flex items-center gap-3">
                            <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontSize: "1.1rem", fontWeight: 700 }}>2</div>
                            <div>
                                <h3 style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.1rem" }}>Select Products</h3>
                                <p style={{ color: "#64748b", fontSize: "0.8rem" }}>Jitne products bhejne hain sab pe tick lagao ✅</p>
                            </div>
                        </div>

                        {/* Search */}
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="🔍 Type product name to filter..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            style={{ background: "rgba(0,0,0,0.2)", marginBottom: 16 }}
                        />

                        {/* Select All / Deselect All */}
                        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const newSelected: Record<string, SelectedProduct> = {};
                                    filteredProducts.forEach(p => {
                                        if (p.totalStock > 0) {
                                            newSelected[p.id] = selected[p.id] || {
                                                product: p,
                                                quantity: "",
                                                pricePerUnit: p.pricePerUnit.toString(),
                                            };
                                        }
                                    });
                                    setSelected(prev => ({ ...prev, ...newSelected }));
                                }}
                                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", fontSize: "0.8rem", fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}
                            >
                                ✅ Select All
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelected({})}
                                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "0.8rem", fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}
                            >
                                ✖ Deselect All
                            </button>
                        </div>

                        {/* Product List with Checkboxes */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
                            {filteredProducts.map((p) => {
                                const isSelected = !!selected[p.id];
                                const noStock = p.totalStock <= 0;
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => { if (!noStock) toggleProduct(p); }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 14,
                                            padding: "14px 16px",
                                            borderRadius: 14,
                                            background: isSelected
                                                ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.1))"
                                                : "rgba(255,255,255,0.03)",
                                            border: isSelected
                                                ? "1.5px solid rgba(99,102,241,0.5)"
                                                : "1px solid rgba(255,255,255,0.08)",
                                            cursor: noStock ? "not-allowed" : "pointer",
                                            opacity: noStock ? 0.4 : 1,
                                            transition: "all 0.2s ease",
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <div style={{
                                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            background: isSelected ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.05)",
                                            border: isSelected ? "none" : "2px solid rgba(255,255,255,0.15)",
                                            transition: "all 0.2s",
                                        }}>
                                            {isSelected && (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: isSelected ? "#c7d2fe" : "#e2e8f0", fontWeight: 600, fontSize: "0.95rem" }}>
                                                {p.name}
                                            </div>
                                            <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: 2 }}>
                                                Stock: {p.totalStock?.toLocaleString() || 0} kg
                                            </div>
                                        </div>

                                        {/* Price Badge */}
                                        <div style={{
                                            color: "#22d3ee", fontWeight: 700, fontSize: "0.9rem",
                                            background: "rgba(6,182,212,0.1)", padding: "4px 10px", borderRadius: 8,
                                            flexShrink: 0,
                                        }}>
                                            ₹{p.pricePerUnit}/kg
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <div style={{ textAlign: "center", padding: "24px 16px", color: "#64748b", fontSize: "0.9rem" }}>
                                    <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>📦</div>
                                    No products found.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Enter Quantities for selected products */}
                    {selectedCount > 0 && (
                        <div className="dash-section fade-in" style={{ animationDelay: "0.1s", borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", padding: "28px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                            <div className="mb-5 flex items-center gap-3">
                                <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "1.1rem", fontWeight: 700 }}>3</div>
                                <div>
                                    <h3 style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.1rem" }}>Enter Quantities</h3>
                                    <p style={{ color: "#64748b", fontSize: "0.8rem" }}>Har product ka quantity aur price daalo</p>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {Object.values(selected).map((item) => {
                                    const q = parseInt(item.quantity) || 0;
                                    const p = parseFloat(item.pricePerUnit) || 0;
                                    const lineTotal = q * p;
                                    return (
                                        <div key={item.product.id} style={{
                                            padding: "16px 18px",
                                            borderRadius: 14,
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                        }}>
                                            {/* Product header */}
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: "0.85rem", fontWeight: 700 }}>📦</div>
                                                    <div>
                                                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.95rem" }}>{item.product.name}</div>
                                                        <div style={{ color: "#64748b", fontSize: "0.75rem" }}>Available: {item.product.totalStock} kg</div>
                                                    </div>
                                                </div>
                                                {lineTotal > 0 && (
                                                    <div style={{ color: "#34d399", fontWeight: 800, fontSize: "1.05rem" }}>
                                                        ₹{lineTotal.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Qty & Price inputs */}
                                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 4, display: "block" }}>Quantity (kg) *</label>
                                                    <input
                                                        type="number"
                                                        className="input-field w-full"
                                                        placeholder="0"
                                                        value={item.quantity}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                                                        min="1"
                                                        max={item.product.totalStock}
                                                        style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", fontSize: "1.05rem", fontWeight: 700 }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 4, display: "block" }}>Price/kg (₹)</label>
                                                    <input
                                                        type="number"
                                                        className="input-field w-full"
                                                        placeholder="0"
                                                        value={item.pricePerUnit}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => updatePrice(item.product.id, e.target.value)}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", fontSize: "1.05rem", fontWeight: 700 }}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleProduct(item.product)}
                                                    style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer", flexShrink: 0, marginTop: 18 }}
                                                    title="Remove"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Grand Total */}
                            <div className="mt-5 p-4 rounded-xl flex justify-between items-center" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.08))", border: "1px solid rgba(99,102,241,0.3)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.2)" }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                                    </div>
                                    <div>
                                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1rem" }}>Grand Total</div>
                                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{totalQty} kg across {selectedCount} product(s)</div>
                                    </div>
                                </div>
                                <div style={{ color: "#818cf8", fontWeight: 900, fontSize: "1.5rem" }}>
                                    ₹{grandTotal.toLocaleString()}
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="pt-6 flex flex-col sm:flex-row gap-4">
                                <button type="button" onClick={() => router.push("/admin/dashboard")} className="btn-secondary py-4 px-8" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600 }}>
                                    Go Back
                                </button>
                                <button type="submit" className="flex-1 py-4 px-8 rounded-xl flex items-center justify-center gap-2 text-white font-bold text-lg cursor-pointer transition-all hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)", border: "none", boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.4)" }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    Confirm Dispatch ({selectedCount} Products)
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </form>
        </div>
    );
}
