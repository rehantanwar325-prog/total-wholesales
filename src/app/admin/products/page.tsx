"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    getProducts,
    addProduct,
    updateProduct,
    initializeStore,
} from "@/lib/store";
import type { Product } from "@/lib/store";

export default function ProductsPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // Form state
    const [name, setName] = useState("");
    const [pricePerUnit, setPricePerUnit] = useState("");
    const [totalStock, setTotalStock] = useState("");

    // Edit state
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editIdInput, setEditIdInput] = useState("");
    const [editName, setEditName] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editStock, setEditStock] = useState("");
    const [editInStock, setEditInStock] = useState(true);

    useEffect(() => {
        initializeStore();
        const user = getCurrentUser();
        if (!user || user.role !== "admin") {
            router.replace("/");
            return;
        }
        setProducts(getProducts());
        setMounted(true);
    }, [router]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Product name is required");
            return;
        }

        const price = parseFloat(pricePerUnit);
        if (isNaN(price) || price < 0) {
            setError("Please enter a valid price");
            return;
        }

        // Add Product
        addProduct({
            name: name.trim(),
            pricePerUnit: price,
            totalStock: parseInt(totalStock) || 0,
        });

        // Reload products list
        setProducts(getProducts());

        setSuccess(`✅ Added product: ${name.trim()}`);
        setName("");
        setPricePerUnit("");
        setTotalStock("");
        setTimeout(() => setSuccess(""), 3000);
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
                <div className="dash-bg-orb dash-bg-orb-1" style={{ top: "-10%", left: "50%", width: 600, height: 600, transform: "translateX(-50%)", background: "rgba(139, 92, 246, 0.2)" }} />
                <div className="dash-bg-orb dash-bg-orb-2" style={{ top: "40%", right: "-10%", background: "rgba(16, 185, 129, 0.15)" }} />
                <div className="dash-bg-grid" />
            </div>
            {/* Success Toast */}
            {success && (
                <div className="toast" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    {success}
                </div>
            )}

            {/* Error Toast */}
            {error && (
                <div className="toast" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
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
                            <h1 className="dash-header-title" style={{ fontSize: "1.25rem" }}>Manage Products</h1>
                            <p className="dash-header-sub">View, add, and update warehouse items</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

                {/* Add New Product Form */}
                <div className="dash-section fade-in" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", overflow: "hidden", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                    <div className="mb-6 flex items-center gap-4">
                        <div className="dash-stat-icon-wrap" style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 0, background: "rgba(139,92,246,0.1)", color: "#c084fc" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Add New Product</h2>
                            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Create a new product for your factory catalog</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-5 items-end">
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                                    Product Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Energy Drink (500ml)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={{ background: "rgba(0,0,0,0.2)" }}
                                />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                    Price per kg (₹) *
                                </label>
                                <input
                                    type="number"
                                    className="input-field font-bold"
                                    placeholder="e.g. 150"
                                    value={pricePerUnit}
                                    onChange={(e) => setPricePerUnit(e.target.value)}
                                    min="0"
                                    step="0.01"
                                    required
                                    style={{ background: "rgba(0,0,0,0.2)", color: "#22d3ee" }}
                                />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-2 mb-2" style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>
                                    Initial Stock *
                                </label>
                                <input
                                    type="number"
                                    className="input-field font-bold"
                                    placeholder="e.g. 1000"
                                    value={totalStock}
                                    onChange={(e) => setTotalStock(e.target.value)}
                                    min="0"
                                    required
                                    style={{ background: "rgba(0,0,0,0.2)", color: "#34d399" }}
                                />
                            </div>
                            <div>
                                <button type="submit" className="w-full py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-white font-bold cursor-pointer transition-all hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)", border: "none", boxShadow: "0 4px 15px rgba(168, 85, 247, 0.3)" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    Add 
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Products List */}
                <div className="dash-section fade-in" style={{ animationDelay: "0.1s", borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", overflow: "hidden", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                    <div className="flex items-center gap-3 mb-6">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
                        <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Catalog Overview</h3>
                    </div>
                    <div className="dash-table-wrap">
                        <table className="data-table w-full mb-0">
                            <thead>
                                <tr>
                                    <th className="pl-4">Product ID</th>
                                    <th>Name</th>
                                    <th className="text-right">Price/kg</th>
                                    <th className="text-right">Warehouse Stock</th>
                                    <th className="text-center">Status</th>
                                    <th className="text-right pr-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((p) => (
                                    <tr key={p.id}>
                                        {editingProductId === p.id ? (
                                            <>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="input-field py-1 px-2 text-xs font-mono"
                                                        value={editIdInput}
                                                        onChange={(e) => setEditIdInput(e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="input-field py-1 px-2 text-sm"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-1">
                                                        <span style={{ color: "#94a3b8" }}>₹</span>
                                                        <input
                                                            type="number"
                                                            className="input-field py-1 px-2 text-sm max-w-[100px]"
                                                            value={editPrice}
                                                            onChange={(e) => setEditPrice(e.target.value)}
                                                            min="0"
                                                            step="0.01"
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input-field py-1 px-2 text-sm max-w-[100px]"
                                                        value={editStock}
                                                        onChange={(e) => setEditStock(e.target.value)}
                                                        min="0"
                                                    />
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={editInStock}
                                                            onChange={(e) => setEditInStock(e.target.checked)}
                                                            className="w-4 h-4 text-indigo-500 bg-gray-800 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                                                        />
                                                        <span className="text-sm" style={{ color: "#94a3b8" }}>In Stock</span>
                                                    </div>
                                                </td>
                                                <td className="text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const pId = editIdInput.trim();
                                                            const pName = editName.trim();
                                                            const pPrice = parseFloat(editPrice);
                                                            const pStock = parseInt(editStock);
                                                            if (!pId || !pName || isNaN(pPrice) || pPrice < 0 || isNaN(pStock) || pStock < 0) {
                                                                setError("Invalid id, name, price, or stock");
                                                                setTimeout(() => setError(""), 3000);
                                                                return;
                                                            }
                                                            const updated = updateProduct(p.id, { id: pId, name: pName, pricePerUnit: pPrice, totalStock: pStock, inStock: editInStock });
                                                            if (!updated) {
                                                                setError("Failed to update: ID may already exist");
                                                                setTimeout(() => setError(""), 3000);
                                                                return;
                                                            }
                                                            setProducts(getProducts());
                                                            setEditingProductId(null);
                                                            setSuccess(`✅ Updated product: ${pName}`);
                                                            setTimeout(() => setSuccess(""), 3000);
                                                        }}
                                                        className="btn-primary py-1 px-3 text-xs"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingProductId(null)}
                                                        className="btn-secondary py-1 px-3 text-xs"
                                                    >
                                                        Cancel
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="text-sm font-mono pl-4" style={{ color: "#64748b" }}>{p.id}</td>
                                                <td className="font-bold text-base" style={{ color: "#e2e8f0" }}>{p.name}</td>
                                                <td className="text-right font-medium" style={{ color: "#22d3ee" }}>₹{p.pricePerUnit.toLocaleString()}</td>
                                                <td className="text-right font-bold" style={{ color: p.totalStock! > 100 ? "#34d399" : "#fca5a5" }}>
                                                    {p.totalStock?.toLocaleString()} kg
                                                </td>
                                                <td className="text-center">
                                                    {p.inStock !== false ? (
                                                        <span className="font-bold px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" }}>IN STOCK</span>
                                                    ) : (
                                                        <span className="font-bold px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.2)" }}>OUT OF STOCK</span>
                                                    )}
                                                </td>
                                                <td className="text-right pr-4">
                                                    <button
                                                        onClick={() => {
                                                            setEditingProductId(p.id);
                                                            setEditIdInput(p.id);
                                                            setEditName(p.name);
                                                            setEditPrice(p.pricePerUnit.toString());
                                                            setEditStock((p.totalStock || 0).toString());
                                                            setEditInStock(p.inStock !== false);
                                                        }}
                                                        className="text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all hover:bg-white/10"
                                                        style={{ background: "rgba(139, 92, 246, 0.15)", color: "#c084fc", border: "1px solid rgba(139, 92, 246, 0.3)" }}
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {products.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center py-8" style={{ color: "#64748b" }}>
                                            No products available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </main>
        </div>
    );
}
