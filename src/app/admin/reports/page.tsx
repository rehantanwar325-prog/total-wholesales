"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    getDispatches,
    getSales,
    getSalesPersons,
    initializeStore,
} from "@/lib/store";
import { exportToCSV } from "@/lib/export";
import type { User } from "@/lib/store";

export default function ReportsPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [activeReport, setActiveReport] = useState<"daily" | "driver" | "inventory">("daily");
    const [dateFilter, setDateFilter] = useState("");
    const [driverFilter, setDriverFilter] = useState("");
    const [salesPersons, setSalesPersons] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBill, setSelectedBill] = useState<any>(null);

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

    const getFilteredData = useCallback(() => {
        const dispatches = getDispatches();
        const sales = getSales();

        let filteredDispatches = dispatches;
        let filteredSales = sales;

        if (dateFilter) {
            filteredDispatches = filteredDispatches.filter((d) => d.date === dateFilter);
            filteredSales = filteredSales.filter((s) => s.date === dateFilter);
        }

        if (driverFilter) {
            filteredDispatches = filteredDispatches.filter((d) => d.salesPersonId === driverFilter);
            filteredSales = filteredSales.filter((s) => s.salesPersonId === driverFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredDispatches = filteredDispatches.filter((d) =>
                d.productName.toLowerCase().includes(q) ||
                d.salesPersonName.toLowerCase().includes(q) ||
                d.date.includes(q)
            );
            filteredSales = filteredSales.filter((s) =>
                s.productName.toLowerCase().includes(q) ||
                s.salesPersonName.toLowerCase().includes(q) ||
                s.date.includes(q) ||
                (s.customerName && s.customerName.toLowerCase().includes(q)) ||
                (s.customerPhone && s.customerPhone.toLowerCase().includes(q)) ||
                (s.customerAddress && s.customerAddress.toLowerCase().includes(q))
            );
        }

        return { dispatches: filteredDispatches.reverse(), sales: filteredSales.reverse() };
    }, [dateFilter, driverFilter, searchQuery]);

    const handleExport = () => {
        const { dispatches, sales } = getFilteredData();
        if (activeReport === "daily" || activeReport === "driver") {
            const data = sales.map((s) => ({
                "Bill ID": s.billId || s.id,
                Date: s.date,
                Product: s.productName,
                "Qty Sold": s.quantitySold,
                "Whse Price": s.warehousePrice || s.pricePerUnit,
                "Sale Price/kg": s.pricePerUnit,
                Customer: s.customerName || "—",
                "Sales Person": s.salesPersonName,
                Payment: s.paymentMethod === "credit" ? `CREDIT (Due: ${s.creditDueDate || "N/A"})` : s.paymentMethod?.toUpperCase() || "CASH",
                "Due Date": s.creditDueDate || "—",
                Amount: s.quantitySold * s.pricePerUnit,
            }));
            exportToCSV(data, `sales_report_${activeReport}`);
        } else {
            const data = dispatches.map((d) => ({
                Date: d.date,
                Product: d.productName,
                "Qty Dispatched": d.quantity,
                "Price/kg": d.pricePerUnit,
                "Sales Person": d.salesPersonName,
                "Total Value": d.quantity * d.pricePerUnit,
            }));
            exportToCSV(data, `inventory_report`);
        }
    };

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0a2e" }}>
                <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    const { sales } = getFilteredData();

    // Inventory summary: aggregate by product
    const inventoryMap: Record<string, { product: string; dispatched: number; sold: number; remaining: number }> = {};
    getDispatches()
        .filter((d) => !dateFilter || d.date === dateFilter)
        .filter((d) => !driverFilter || d.salesPersonId === driverFilter)
        .forEach((d) => {
            if (!inventoryMap[d.productId]) inventoryMap[d.productId] = { product: d.productName, dispatched: 0, sold: 0, remaining: 0 };
            inventoryMap[d.productId].dispatched += d.quantity;
        });
    getSales()
        .filter((s) => !dateFilter || s.date === dateFilter)
        .filter((s) => !driverFilter || s.salesPersonId === driverFilter)
        .forEach((s) => {
            if (!inventoryMap[s.productId]) inventoryMap[s.productId] = { product: s.productName, dispatched: 0, sold: 0, remaining: 0 };
            inventoryMap[s.productId].sold += s.quantitySold;
        });
    Object.values(inventoryMap).forEach((item) => {
        item.remaining = item.dispatched - item.sold;
    });

    return (
        <div className="dash-page">
            {/* Ambient Background */}
            <div className="dash-bg" style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
                <div className="dash-bg-orb dash-bg-orb-1" style={{ top: "-10%", left: "40%", width: 600, height: 600, transform: "translateX(-50%)", background: "rgba(99, 102, 241, 0.15)" }} />
                <div className="dash-bg-orb dash-bg-orb-2" style={{ top: "40%", right: "-10%", background: "rgba(139, 92, 246, 0.15)" }} />
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
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                Reports & Analytics
                            </h1>
                            <p className="dash-header-sub">View sales records, driver performance, and inventory</p>
                        </div>
                    </div>
                    <button onClick={handleExport} className="px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", fontWeight: "bold", fontSize: "0.85rem" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Export CSV
                    </button>
                </div>
            </header>

            <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>
                {/* Utilities Bar (Tabs + Filters) */}
                <div className="flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between mb-8">
                    {/* Report Tabs */}
                    <div className="flex gap-2 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto" style={{ background: "rgba(15, 10, 46, 0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99, 102, 241, 0.1)" }}>
                        {([
                            { key: "daily", label: "Daily Sales" },
                            { key: "driver", label: "By Driver" },
                            { key: "inventory", label: "Inventory" },
                        ] as const).map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveReport(tab.key)}
                                className="flex-1 lg:flex-none py-3 px-8 rounded-xl text-lg font-bold transition-all whitespace-nowrap box-border"
                                style={{
                                    background: activeReport === tab.key ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))" : "transparent",
                                    color: activeReport === tab.key ? "#fff" : "#94a3b8",
                                    border: `1px solid ${activeReport === tab.key ? "rgba(99,102,241,0.3)" : "transparent"}`,
                                    boxShadow: activeReport === tab.key ? "0 4px 10px rgba(0,0,0,0.2)" : "none"
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Filters Wrapper */}
                    <div className="flex flex-wrap gap-4 w-full lg:w-auto items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </div>
                            <input
                                type="text"
                                className="w-full py-3.5 pl-12 pr-4 rounded-xl text-base focus:outline-none transition-all"
                                placeholder="Search queries..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ background: "rgba(15,10,46,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}
                            />
                        </div>
                        
                        <div className="relative flex-1 min-w-[150px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                            <input
                                type="date"
                                className="w-full py-3.5 pl-12 pr-4 rounded-xl text-base focus:outline-none transition-all"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                style={{ background: "rgba(15,10,46,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}
                            />
                        </div>

                        <div className="relative flex-1 min-w-[150px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <select 
                                className="w-full py-3.5 pl-12 pr-4 rounded-xl text-base focus:outline-none transition-all appearance-none" 
                                value={driverFilter} 
                                onChange={(e) => setDriverFilter(e.target.value)}
                                style={{ background: "rgba(15,10,46,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                            >
                                <option value="">All Drivers</option>
                                {salesPersons.map((sp) => (
                                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                                ))}
                            </select>
                        </div>

                        {(searchQuery || dateFilter || driverFilter) && (
                            <button
                                onClick={() => { setSearchQuery(""); setDateFilter(""); setDriverFilter(""); }}
                                className="p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                                title="Clear Filters"
                                style={{ color: "#f87171", background: "rgba(239, 68, 68, 0.1)" }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Daily Sales / By Driver */}
                {(activeReport === "daily" || activeReport === "driver") && (
                    <div className="dash-section fade-in" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b" style={{ borderColor: "rgba(99,102,241,0.1)" }}>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.2))", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                </div>
                                <h2 className="text-xl font-bold" style={{ color: "#f8fafc" }}>
                                    {activeReport === "daily" ? "Sales Records" : "Sales by Driver"}
                                </h2>
                            </div>

                            {sales.length > 0 && (
                                <div className="flex flex-wrap gap-4 p-4 rounded-xl items-center" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div className="flex items-center gap-3 pr-4 border-r" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#64748b" }}>Total Qty Sold</div>
                                            <div className="font-black text-xl" style={{ color: "#60a5fa" }}>{sales.reduce((s, r) => s + r.quantitySold, 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#64748b" }}>Total Revenue</div>
                                            <div className="font-black text-xl" style={{ color: "#34d399" }}>₹{sales.reduce((s, r) => s + r.quantitySold * r.pricePerUnit, 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="dash-table-wrap overflow-x-auto p-0">
                            <table className="data-table w-full">
                                <thead>
                                    <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Date</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Product</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Qty</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Customer Info</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Driver</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const billsMap = sales.reduce((acc, sale) => {
                                            const key = sale.billId || sale.id;
                                            if (!acc[key]) {
                                                acc[key] = {
                                                    id: key,
                                                    isBill: !!sale.billId,
                                                    date: sale.createdAt,
                                                    displayDate: sale.date,
                                                    customerName: sale.customerName,
                                                    salesPersonName: sale.salesPersonName,
                                                    customerPhone: sale.customerPhone,
                                                    customerAddress: sale.customerAddress,
                                                    paymentMethod: sale.paymentMethod,
                                                    creditDueDate: sale.creditDueDate,
                                                    totalAmount: 0,
                                                    totalItems: 0,
                                                    sales: []
                                                };
                                            }
                                            acc[key].sales.push(sale);
                                            acc[key].totalAmount += sale.quantitySold * sale.pricePerUnit;
                                            acc[key].totalItems += sale.quantitySold;
                                            return acc;
                                        }, {} as Record<string, any>);
                                        
                                        const groupedBills = Object.values(billsMap).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                        if (groupedBills.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-12">
                                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 text-slate-400 mb-3">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                        </div>
                                                        <p className="text-slate-400 font-medium">No sales records found</p>
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return groupedBills.map((bill: any) => (
                                            <tr key={bill.id} className="transition-colors hover:bg-white/5 border-b border-white/5">
                                                <td className="py-4 px-6 text-sm" style={{ color: "#cbd5e1" }}>{bill.displayDate}</td>
                                                <td className="py-4 px-6 text-sm font-bold" style={{ color: "#f8fafc" }}>
                                                    {bill.isBill && <div className="text-xs mb-1" style={{ color: "#818cf8" }}>{bill.id}</div>}
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                        {bill.sales.map((s: any) => (
                                                            <div key={s.id} className="flex flex-col border-b border-white/5 pb-1 last:border-0">
                                                                <span>{s.quantitySold}x {s.productName}</span>
                                                                <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>
                                                                    Whse: ₹{s.warehousePrice || s.pricePerUnit} • Sold: ₹{s.pricePerUnit}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-sm font-bold" style={{ color: "#60a5fa" }}>{bill.totalItems}</td>
                                                <td className="py-4 px-6">
                                                    {bill.customerName || bill.shopNumber || bill.customerPhone || bill.customerAddress ? (
                                                        <div className="flex flex-col gap-1 max-w-[250px]">
                                                            {(bill.customerName || bill.shopNumber) && (
                                                                <div className="inline-flex items-center gap-1.5 font-bold text-sm" style={{ color: "#e2e8f0" }}>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                                    {bill.customerName}{bill.customerName && bill.shopNumber ? " - " : ""}{bill.shopNumber}
                                                                </div>
                                                            )}
                                                            {bill.customerPhone && (
                                                                <div className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "#94a3b8" }}>
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                                    {bill.customerPhone}
                                                                </div>
                                                            )}
                                                            {bill.customerAddress && (
                                                                <div className="inline-flex items-center gap-1.5 text-xs truncate" style={{ color: "#64748b" }} title={bill.customerAddress}>
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                                    {bill.customerAddress}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm italic opacity-50">Not Provided</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-sm">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold transition-all" style={{ 
                                                                background: bill.paymentMethod === "credit" ? "rgba(245,158,11,0.1)" : "rgba(99,102,241,0.1)", 
                                                                color: bill.paymentMethod === "credit" ? "#fbbf24" : "#a78bfa",
                                                                border: `1px solid ${bill.paymentMethod === "credit" ? "rgba(245,158,11,0.2)" : "rgba(99,102,241,0.2)"}`
                                                            }}>
                                                                {bill.paymentMethod === "credit" ? "💳 Credit" : bill.paymentMethod === "online" ? "📱 Online" : "💵 Cash"}
                                                            </div>
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                                                                {bill.salesPersonName}
                                                            </div>
                                                            {bill.paymentMethod === "credit" && bill.creditDueDate && (
                                                                <div className="text-[11px] font-black text-amber-500 mt-1.5 flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                                    <span className="uppercase tracking-tight">Payment Due: {bill.creditDueDate}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                </td>
                                                <td className="py-4 px-6 text-sm font-black" style={{ color: "#34d399" }}>
                                                    <div className="flex flex-col gap-2 items-start">
                                                        <span>₹{bill.totalAmount.toLocaleString()}</span>
                                                        <button 
                                                            onClick={() => setSelectedBill(bill)} 
                                                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors flex items-center gap-1"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                            View Bill
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Inventory Report */}
                {activeReport === "inventory" && (
                    <div className="dash-section fade-in" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="p-6 md:p-8 border-b flex items-center gap-3" style={{ borderColor: "rgba(99,102,241,0.1)" }}>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            </div>
                            <h2 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Remaining Inventory Overview</h2>
                        </div>
                        <div className="dash-table-wrap overflow-x-auto p-0">
                            <table className="data-table w-full">
                                <thead>
                                    <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Product Name</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Total Dispatched</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Total Sold</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Remaining Stock</th>
                                        <th className="py-4 px-6 text-xs font-bold tracking-wider" style={{ color: "#94a3b8", textTransform: "uppercase" }}>Status Label</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(inventoryMap).map((item, idx) => {
                                        const isErr = item.remaining < 0;
                                        const isClear = item.remaining === 0;
                                        return (
                                            <tr key={idx} className="transition-colors hover:bg-white/5 border-b border-white/5">
                                                <td className="py-4 px-6 text-sm font-bold" style={{ color: "#f8fafc" }}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                        {item.product}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-sm font-bold" style={{ color: "#cbd5e1" }}>{item.dispatched}</td>
                                                <td className="py-4 px-6 text-sm font-bold" style={{ color: "#60a5fa" }}>{item.sold}</td>
                                                <td className="py-4 px-6 text-lg font-black" style={{ color: isErr ? "#f87171" : isClear ? "#34d399" : "#fbbf24" }}>
                                                    {item.remaining}
                                                </td>
                                                <td className="py-4 px-6">
                                                    {isErr ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div> ERROR
                                                        </span>
                                                    ) : isClear ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> CLEARED
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> PENDING
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {Object.keys(inventoryMap).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12">
                                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 text-slate-400 mb-3">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                                </div>
                                                <p className="text-slate-400 font-medium">No inventory data found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Invoice Modal */}
            {selectedBill && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 print:p-0" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
                    <style>{`
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #invoice-modal, #invoice-modal * {
                                visibility: visible;
                            }
                            #invoice-modal {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                background: white !important;
                                color: black !important;
                                box-shadow: none !important;
                                margin: 0 !important;
                                padding: 20px !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                    `}</style>
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-black shadow-2xl flex flex-col relative" id="invoice-modal">
                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 p-4 border-b border-gray-100 no-print sticky top-0 bg-white z-10">
                            <button onClick={() => window.print()} className="px-5 py-2 rounded-xl font-bold flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-100">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Print Bill
                            </button>
                            <button onClick={() => setSelectedBill(null)} className="px-5 py-2 rounded-xl font-bold flex items-center gap-2 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                Close
                            </button>
                        </div>
                        
                        {/* Invoice Content */}
                        <div className="p-6 sm:p-10 flex-col flex gap-8">
                            {/* Header */}
                            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight" style={{ color: "#0f172a" }}>TOTAL WHOLESALL</h2>
                                    <p className="text-sm font-bold text-slate-500 mt-1">Salesperson: <span className="text-slate-800">{selectedBill.sales[0]?.salesPersonName || "N/A"}</span></p>
                                </div>
                                <div className="text-right">
                                    <h1 className="text-2xl font-black text-slate-300 uppercase tracking-widest mb-2">INVOICE</h1>
                                    <p className="text-sm font-bold text-slate-800">Bill No: {selectedBill.isBill ? selectedBill.id.split('-')[1] || selectedBill.id : selectedBill.id}</p>
                                    <p className="text-sm font-medium text-slate-500">Date: {selectedBill.displayDate}</p>
                                    <p className="text-sm font-medium text-slate-500">Time: {new Date(selectedBill.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                                </div>
                            </div>
                            
                            {/* Customer Details */}
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To:</p>
                                <h3 className="text-lg font-bold text-slate-800">{selectedBill.customerName || "Cash Customer"}</h3>
                                {selectedBill.sales[0]?.customerPhone && <p className="text-sm font-medium text-slate-600">Ph: {selectedBill.sales[0].customerPhone}</p>}
                                {selectedBill.sales[0]?.customerAddress && <p className="text-sm font-medium text-slate-600">{selectedBill.sales[0].customerAddress}</p>}
                                {selectedBill.sales[0]?.shopNumber && <p className="text-sm font-medium text-slate-600">Shop No: {selectedBill.sales[0].shopNumber}</p>}
                            </div>
                            
                            {/* Table */}
                            <div className="mt-4">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200">
                                            <th className="py-3 font-bold text-slate-800 text-sm">#</th>
                                            <th className="py-3 font-bold text-slate-800 text-sm">Item Description</th>
                                            <th className="py-3 font-bold text-slate-800 text-sm text-center">Qty</th>
                                            <th className="py-3 font-bold text-slate-800 text-sm text-right">Rate</th>
                                            <th className="py-3 font-bold text-slate-800 text-sm text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedBill.sales.map((item: any, idx: number) => (
                                            <tr key={idx} className="border-b border-slate-100">
                                                <td className="py-4 text-sm font-medium text-slate-500">{idx + 1}</td>
                                                <td className="py-4 text-sm font-bold text-slate-800">{item.productName}</td>
                                                <td className="py-4 text-sm font-bold text-slate-800 text-center">{item.quantitySold}</td>
                                                <td className="py-4 text-sm font-medium text-slate-600 text-right">₹{item.pricePerUnit.toLocaleString()}</td>
                                                <td className="py-4 text-sm font-bold text-slate-800 text-right">₹{(item.quantitySold * item.pricePerUnit).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Totals */}
                            <div className="flex justify-between items-end border-t-2 border-slate-800 pt-6 mt-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-500 mb-1">Payment Method: <span className="text-slate-800 uppercase">{selectedBill.paymentMethod || "CASH"}</span></p>
                                    <p className="text-xs text-slate-400 font-bold">Total Items: {selectedBill.totalItems}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-widest">Grand Total</p>
                                    <p className="text-4xl font-black text-slate-800 tracking-tight">₹{selectedBill.totalAmount.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            {/* Footer */}
                            <div className="text-center mt-12 mb-4">
                                <p className="text-sm font-bold text-slate-400 italic">Thank you for your business!</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
