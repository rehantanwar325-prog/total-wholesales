"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    getCurrentUser,
    getProductStockForSalesPerson,
    addSale,
    getTodayString,
    getStockSummary,
    getSales,
    getPrebookings,
    addPrebooking,
    initializeStore,
    updateDriverLocation,
} from "@/lib/store";
import { exportToCSV } from "@/lib/export";
import type { User } from "@/lib/store";

export default function SalesDashboard() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [stock, setStock] = useState<ReturnType<typeof getProductStockForSalesPerson>>([]);
    const [summary, setSummary] = useState({ totalDispatched: 0, totalSold: 0, remainingStock: 0, totalRevenue: 0 });
    const [activeView, setActiveView] = useState<"stock" | "sell" | "history" | "prebook" | "prebookings" | "activity">("stock");
    const [success, setSuccess] = useState("");

    // Sale form state
    const [items, setItems] = useState([{ productId: "", qtySold: "" }]);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [shopNumber, setShopNumber] = useState("");
    const [date] = useState(getTodayString());

    // Pre-booking form state
    const [deliveryDate, setDeliveryDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
    });

    // History & Pre-bookings
    const [salesHistory, setSalesHistory] = useState<ReturnType<typeof getSales>>([]);
    const [myPrebookings, setMyPrebookings] = useState<ReturnType<typeof getPrebookings>>([]);

    // Location sharing
    const [locationStatus, setLocationStatus] = useState<"sharing" | "denied" | "loading" | "error">("loading");

    const loadData = useCallback((userId: string) => {
        setStock(getProductStockForSalesPerson(userId));
        setSummary(getStockSummary(userId));
        setSalesHistory(getSales().filter((s) => s.salesPersonId === userId).reverse());
        setMyPrebookings(getPrebookings().filter((p) => p.salesPersonId === userId).reverse());
    }, []);

    // GPS location tracking - continuous with watchPosition
    const updateLocation = useCallback(async (user: User, position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        let areaName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`);
            const data = await res.json();
            if (data.address) {
                const a = data.address;
                areaName = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.city || areaName;
                if (a.city && areaName !== a.city) areaName += `, ${a.city}`;
            }
        } catch { /* Use coordinates as fallback */ }
        updateDriverLocation({
            userId: user.id,
            userName: user.name,
            latitude,
            longitude,
            areaName,
        });
        setLocationStatus("sharing");
    }, []);

    useEffect(() => {
        initializeStore();
        const user = getCurrentUser();
        if (!user || user.role !== "sales") {
            router.replace("/");
            return;
        }
        setCurrentUser(user);
        loadData(user.id);
        setMounted(true);

        // Start continuous location tracking immediately
        if (!navigator.geolocation) {
            setLocationStatus("error");
            return;
        }

        // watchPosition for real-time continuous tracking
        const watchId = navigator.geolocation.watchPosition(
            (position) => updateLocation(user, position),
            (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                    setLocationStatus("denied");
                } else {
                    setLocationStatus("error");
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );

        // Also do a backup interval update every 2 minutes
        const locationInterval = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (position) => updateLocation(user, position),
                () => {},
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }, 2 * 60 * 1000);

        return () => {
            navigator.geolocation.clearWatch(watchId);
            clearInterval(locationInterval);
        };
    }, [router, loadData, updateLocation]);

    const handleSale = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || items.length === 0) return;

        let totalQty = 0;
        const namesPattern: string[] = [];
        
        items.forEach(item => {
            const productStock = stock.find((s) => s.product.id === item.productId);
            if (!productStock) return;
            
            totalQty += parseInt(item.qtySold);
            namesPattern.push(productStock.product.name);

            addSale({
                productId: item.productId,
                productName: productStock.product.name,
                quantitySold: parseInt(item.qtySold),
                customerName: customerName || "",
                customerPhone: customerPhone || "",
                customerAddress: customerAddress || "",
                shopNumber: shopNumber || "",
                salesPersonId: currentUser.id,
                salesPersonName: currentUser.name,
                pricePerUnit: productStock.pricePerUnit,
                date,
            });
        });

        const successMessage = namesPattern.length > 1 
            ? `✅ Sold ${totalQty} items across ${namesPattern.length} products` 
            : `✅ Sold ${totalQty} × ${namesPattern[0]}`;

        setSuccess(successMessage);
        setItems([{ productId: "", qtySold: "" }]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        setShopNumber("");
        loadData(currentUser.id);
        setActiveView("stock");
        setTimeout(() => setSuccess(""), 3000);
    };

    const handleAddItem = () => {
        setItems([...items, { productId: "", qtySold: "" }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: "productId" | "qtySold", value: string) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleLogout = () => {
        import("@/lib/store").then(({ logout }) => {
            logout();
            router.replace("/");
        });
    };

    const handlePrebook = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || items.length === 0) return;

        let totalQty = 0;
        const namesPattern: string[] = [];

        items.forEach(item => {
            const productStock = stock.find((s) => s.product.id === item.productId);
            // We use stock array here just to get product name and price. We don't check remaining stock for prebookings.
            if (!productStock) return;

            totalQty += parseInt(item.qtySold);
            namesPattern.push(productStock.product.name);

            addPrebooking({
                productId: item.productId,
                productName: productStock.product.name,
                quantity: parseInt(item.qtySold),
                customerName: customerName || "",
                customerPhone: customerPhone || "",
                customerAddress: customerAddress || "",
                shopNumber: shopNumber || "",
                salesPersonId: currentUser.id,
                salesPersonName: currentUser.name,
                pricePerUnit: productStock.pricePerUnit,
                deliveryDate: deliveryDate,
            });
        });

        const successMessage = namesPattern.length > 1
            ? `✅ Pre-booked ${totalQty} items across ${namesPattern.length} products for ${deliveryDate}`
            : `✅ Pre-booked ${totalQty} × ${namesPattern[0]} for ${deliveryDate}`;

        setSuccess(successMessage);
        setItems([{ productId: "", qtySold: "" }]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        setShopNumber("");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDeliveryDate(tomorrow.toISOString().split("T")[0]);
        loadData(currentUser.id);
        setActiveView("prebookings");
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
                <div className="dash-bg-orb dash-bg-orb-1" style={{ top: "-10%", left: "30%", width: 500, height: 500, transform: "translateX(-50%)", background: "rgba(16, 185, 129, 0.15)" }} />
                <div className="dash-bg-orb dash-bg-orb-2" style={{ top: "40%", right: "-10%", background: "rgba(6, 182, 212, 0.15)" }} />
                <div className="dash-bg-grid" />
            </div>
            {/* Success Toast */}
            {success && (
                <div className="toast" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)", backdropFilter: "blur(12px)" }}>
                    {success}
                </div>
            )}

            {/* Header */}
            <header className="dash-header" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,4,23,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <div className="dash-header-inner" style={{ maxWidth: 800, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                            <span className="text-xl font-bold">{currentUser?.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                            <h1 className="dash-header-title text-xl font-bold" style={{ color: "#e2e8f0", display: "flex", alignItems: "center", gap: "8px" }}>
                                Hi, {currentUser?.name?.split(" ")[0]} 👋
                            </h1>
                            <p className="dash-header-sub text-xs flex items-center gap-2 mt-0.5">
                                Sales Dashboard
                                {locationStatus === "sharing" && <span className="flex items-center gap-1" style={{ color: "#34d399" }}><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live</span>}
                                {locationStatus === "denied" && <span className="flex items-center gap-1" style={{ color: "#f59e0b" }}><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Off</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171", fontWeight: "bold", fontSize: "0.85rem" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        Logout
                    </button>
                </div>
            </header>

            <main className="dash-main" style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl flex flex-col justify-center items-center gap-1 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(99,102,241,0.05))", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                        <div className="text-3xl font-black" style={{ color: "#818cf8" }}>{summary.totalDispatched}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "#64748b" }}>Received</div>
                    </div>
                    <div className="p-5 rounded-2xl flex flex-col justify-center items-center gap-1 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                        <div className="text-3xl font-black" style={{ color: "#34d399" }}>{summary.totalSold}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "#64748b" }}>Sold</div>
                    </div>
                    <div className="p-5 rounded-2xl flex flex-col justify-center items-center gap-1 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.2)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                        <div className="text-3xl font-black" style={{ color: summary.remainingStock < 0 ? "#f87171" : "#fbbf24" }}>{summary.remainingStock}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "#64748b" }}>Remaining</div>
                    </div>
                    <div className="p-5 rounded-2xl flex flex-col justify-center items-center gap-1 transition-all duration-300 hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, rgba(15,10,46,0.6), rgba(6,182,212,0.05))", border: "1px solid rgba(6,182,212,0.2)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                        <div className="text-xl md:text-2xl font-black" style={{ color: "#06b6d4", wordBreak: "break-all" }}>₹{summary.totalRevenue.toLocaleString()}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "#64748b" }}>Revenue</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-3 p-2 rounded-2xl w-full overflow-x-auto tabs-container" style={{ background: "rgba(15, 10, 46, 0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99, 102, 241, 0.1)" }}>
                    {([
                        { key: "stock", label: "My Stock", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> },
                        { key: "sell", label: "New Sale", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> },
                        { key: "history", label: "History", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
                        { key: "prebook", label: "Pre-book", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
                        { key: "prebookings", label: "My Pre-bookings", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
                        { key: "activity", label: "Activity", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> },
                    ] as const).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveView(tab.key)}
                            className="flex-none py-3 px-4 sm:px-8 rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 sm:gap-3 transition-all whitespace-nowrap"
                            style={{
                                background: activeView === tab.key ? "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.25))" : "transparent",
                                color: activeView === tab.key ? "#fff" : "#94a3b8",
                                border: `1.5px solid ${activeView === tab.key ? "rgba(16,185,129,0.4)" : "transparent"}`,
                                boxShadow: activeView === tab.key ? "0 6px 15px rgba(0,0,0,0.3)" : "none",
                            }}
                        >
                            <span className="shrink-0 scale-90 sm:scale-100">{tab.icon}</span> 
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* My Stock View */}
                {activeView === "stock" && (
                    <div className="space-y-3">
                        {stock.length === 0 ? (
                            <div className="dash-section p-12 text-center" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px dashed rgba(99,102,241,0.2)" }}>
                                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                </div>
                                <h3 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>No stock assigned yet</h3>
                                <p className="text-sm mt-2" style={{ color: "#64748b" }}>Ask admin to dispatch products to your inventory</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stock.map((item) => (
                                    <div key={item.product.id} className="dash-section p-5 relative overflow-hidden" style={{ borderRadius: 20, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-base" style={{ color: "#f8fafc" }}>{item.product.name}</h4>
                                                    <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>₹{item.pricePerUnit} / unit</p>
                                                </div>
                                            </div>
                                            <div className="px-2.5 py-1 rounded-md text-xs font-bold" style={{
                                                background: item.remaining < 0 ? "rgba(239, 68, 68, 0.15)" : item.remaining === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                                color: item.remaining < 0 ? "#f87171" : item.remaining === 0 ? "#34d399" : "#fbbf24",
                                                border: `1px solid ${item.remaining < 0 ? "rgba(239, 68, 68, 0.3)" : item.remaining === 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`
                                            }}>
                                                {item.remaining} left
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ color: "#94a3b8" }}>Received: <span style={{ color: "#818cf8" }}>{item.dispatched}</span></div>
                                            <div style={{ color: "#94a3b8" }}>Sold: <span style={{ color: "#34d399" }}>{item.sold}</span></div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(99, 102, 241, 0.1)" }}>
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${item.dispatched > 0 ? Math.min(100, (item.sold / item.dispatched) * 100) : 0}%`,
                                                    background: "linear-gradient(90deg, #6366f1, #06b6d4)",
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* New Sale Form */}
                {activeView === "sell" && (() => {
                    const isFormValid = items.length > 0 && items.every(item => {
                        const qtyNum = parseInt(item.qtySold) || 0;
                        const itemStock = stock.find((s) => s.product.id === item.productId);
                        
                        // Check if total quantity for this product across all rows exceeds stock
                        const totalQtyForProduct = items
                            .filter(i => i.productId === item.productId)
                            .reduce((sum, i) => sum + (parseInt(i.qtySold) || 0), 0);
                            
                        return item.productId !== "" && 
                            qtyNum > 0 && 
                            itemStock !== undefined &&
                            totalQtyForProduct <= (itemStock?.remaining || 0);
                    }) &&
                        customerName.trim() !== "" &&
                        customerPhone.trim() !== "" &&
                        shopNumber.trim() !== "";
                    
                    const missingFields: string[] = [];
                    let hasInvalidItems = false;
                    let hasStockIssue = false;
                    
                    items.forEach((item) => {
                        if (!item.productId) hasInvalidItems = true;
                        if (parseInt(item.qtySold) <= 0 || !item.qtySold) hasInvalidItems = true;
                        
                        if (item.productId) {
                             const itemStock = stock.find((s) => s.product.id === item.productId);
                             const totalQtyForProduct = items
                                .filter(i => i.productId === item.productId)
                                .reduce((sum, i) => sum + (parseInt(i.qtySold) || 0), 0);
                                
                             if (itemStock && totalQtyForProduct > itemStock.remaining) {
                                 hasStockIssue = true;
                             }
                        }
                    });

                    if (hasInvalidItems) missingFields.push("All Products & Quantities");
                    if (hasStockIssue) missingFields.push("Quantity exceeds stock for some items");
                    if (!customerName.trim()) missingFields.push("Customer Name");
                    if (!customerPhone.trim()) missingFields.push("Phone Number");
                    if (!shopNumber.trim()) missingFields.push("Shop Number");
                    
                    // Calculate total
                    const totalAmount = items.reduce((sum, item) => {
                        const itemStock = stock.find(s => s.product.id === item.productId);
                        if (itemStock && item.qtySold) {
                            return sum + (parseInt(item.qtySold) * itemStock.pricePerUnit);
                        }
                        return sum;
                    }, 0);

                    return (
                    <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Record a Sale</h3>
                                <p className="text-xs mt-1" style={{ color: "#64748b" }}>Sab fields (*) bharna zaroori hai</p>
                            </div>
                        </div>
                        <form onSubmit={handleSale} className="space-y-4">
                            {/* Dynamic Products List */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <label className="form-label mb-0">Products *</label>
                                    <button 
                                        type="button" 
                                        onClick={handleAddItem}
                                        className="text-sm font-black flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors shadow-lg hover:scale-105 active:scale-95 duration-200"
                                        style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.25))", color: "#34d399", border: "1px solid rgba(16,185,129,0.5)", boxShadow: "0 4px 15px -3px rgba(16, 185, 129, 0.3)" }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add Another Product
                                    </button>
                                </div>
                                
                                {items.map((item, index) => {
                                    const qtyNum = parseInt(item.qtySold) || 0;
                                    const itemStock = stock.find((s) => s.product.id === item.productId);
                                    
                                    const totalQtyForProduct = items
                                        .filter(i => i.productId === item.productId)
                                        .reduce((sum, i) => sum + (parseInt(i.qtySold) || 0), 0);
                                        
                                    const hasStockError = itemStock && totalQtyForProduct > itemStock.remaining;

                                    return (
                                        <div key={index} className="p-4 rounded-xl space-y-3 relative" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            {items.length > 1 && (
                                                <button 
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/40 transition-colors z-10"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            )}
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="md:col-span-2">
                                                    <select
                                                        className="input-field py-2.5 text-sm"
                                                        value={item.productId}
                                                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                                                        required
                                                        style={{ borderColor: item.productId ? "rgba(16,185,129,0.3)" : undefined }}
                                                    >
                                                        <option value="">Select product</option>
                                                        {stock.filter((s) => s.remaining > 0).map((s) => (
                                                            <option key={s.product.id} value={s.product.id}>
                                                                {s.product.name} ({s.remaining} left)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <input
                                                        type="number"
                                                        className="input-field py-2.5 text-sm"
                                                        placeholder="Qty"
                                                        value={item.qtySold}
                                                        onChange={(e) => handleItemChange(index, "qtySold", e.target.value)}
                                                        min="1"
                                                        max={itemStock?.remaining || 9999}
                                                        required
                                                        style={{ borderColor: qtyNum > 0 && !hasStockError ? "rgba(16,185,129,0.3)" : hasStockError ? "rgba(239,68,68,0.5)" : undefined }}
                                                    />
                                                </div>
                                            </div>

                                            {hasStockError && (
                                                <div className="p-2 rounded-lg text-xs font-bold" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                                                    ⚠ Only {itemStock?.remaining} available!
                                                </div>
                                            )}
                                            
                                            {itemStock && qtyNum > 0 && !hasStockError && (
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                                                        {qtyNum} × ₹{itemStock.pricePerUnit} = 
                                                    </span>
                                                    <span className="text-sm font-bold" style={{ color: "#34d399" }}>
                                                        ₹{(qtyNum * itemStock.pricePerUnit).toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                
                                {totalAmount > 0 && (
                                    <div className="flex justify-between items-center p-4 rounded-xl mt-2" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                                        <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>Total Amount:</span>
                                        <span className="font-black text-xl" style={{ color: "#34d399" }}>₹{totalAmount.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="form-label">Customer Name *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Khan Store"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                    style={{ borderColor: customerName.trim() ? "rgba(16,185,129,0.3)" : undefined }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Phone Number *</label>
                                    <input
                                        type="tel"
                                        className="input-field"
                                        placeholder="e.g. 03001234567"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        required
                                        style={{ borderColor: customerPhone.trim() ? "rgba(16,185,129,0.3)" : undefined }}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Shop Number *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="e.g. Shop 12"
                                        value={shopNumber}
                                        onChange={(e) => setShopNumber(e.target.value)}
                                        required
                                        style={{ borderColor: shopNumber.trim() ? "rgba(16,185,129,0.3)" : undefined }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Address / Location</label>
                                <textarea
                                    className="input-field min-h-[80px]"
                                    placeholder="e.g. Main Market, Block 4"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="form-label">Date (Auto-filled)</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={date}
                                    readOnly
                                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                                />
                            </div>

                            {/* Validation Status */}
                            {!isFormValid && (items[0].productId || customerName || customerPhone || shopNumber) && (
                                <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}>
                                    <div className="font-bold mb-1">⚠ Ye fields bharna zaroori hai:</div>
                                    <div style={{ color: "#f59e0b" }}>{missingFields.join(", ")}</div>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={!isFormValid}
                                className="btn-primary w-full justify-center py-4 text-base mt-4" 
                                style={{ 
                                    background: isFormValid ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(100,116,139,0.2)", 
                                    boxShadow: isFormValid ? "0 10px 25px -5px rgba(16, 185, 129, 0.4)" : "none",
                                    color: isFormValid ? "#fff" : "#64748b",
                                    cursor: isFormValid ? "pointer" : "not-allowed",
                                    opacity: isFormValid ? 1 : 0.6,
                                    border: isFormValid ? "none" : "1px solid rgba(100,116,139,0.2)",
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                {isFormValid ? "✅ Confirm Sale" : "🔒 Fill All Details First"}
                            </button>
                        </form>
                    </div>
                    );
                })()}

                {/* History */}
                {activeView === "history" && (
                    <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Recent Sales</h3>
                        </div>
                        
                        {salesHistory.length === 0 ? (
                            <div className="text-center py-12" style={{ color: "#64748b" }}>
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-slate-400 mb-4">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </div>
                                <p className="font-bold text-base">No sales recorded yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {salesHistory.slice(0, 20).map((s) => (
                                    <div key={s.id} className="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors hover:bg-white/5" style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-base" style={{ color: "#f8fafc" }}>{s.productName}</p>
                                                <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>
                                                    {s.customerName ? `${s.customerName} • ` : ""}{s.date}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right w-full sm:w-auto px-4 py-2 sm:p-0 rounded-lg sm:bg-transparent" style={{ background: "rgba(255,255,255,0.03)" }}>
                                            <p className="font-black text-lg" style={{ color: "#34d399" }}>₹{(s.quantitySold * s.pricePerUnit).toLocaleString()}</p>
                                            <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>{s.quantitySold} units</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {/* Pre-book Form */}
                 {activeView === "prebook" && (() => {
                     const isFormValid = items.length > 0 && items.every(item => {
                         const qtyNum = parseInt(item.qtySold) || 0;
                         // For prebooking, we don't validate against current remaining stock, just that a product is selected and qty > 0
                         return item.productId !== "" && qtyNum > 0;
                     }) &&
                         customerName.trim() !== "" &&
                         customerPhone.trim() !== "" &&
                         shopNumber.trim() !== "" &&
                         deliveryDate !== "";
                     
                     const missingFields: string[] = [];
                     let hasInvalidItems = false;
                     
                     items.forEach((item) => {
                         if (!item.productId) hasInvalidItems = true;
                         if (parseInt(item.qtySold) <= 0 || !item.qtySold) hasInvalidItems = true;
                     });

                     if (hasInvalidItems) missingFields.push("All Products & Quantities");
                     if (!customerName.trim()) missingFields.push("Customer Name");
                     if (!customerPhone.trim()) missingFields.push("Phone Number");
                     if (!shopNumber.trim()) missingFields.push("Shop Number");
                     if (!deliveryDate) missingFields.push("Delivery Date");
                     
                     // Calculate total
                     const totalAmount = items.reduce((sum, item) => {
                         const itemStock = stock.find(s => s.product.id === item.productId);
                         if (itemStock && item.qtySold) {
                             return sum + (parseInt(item.qtySold) * itemStock.pricePerUnit);
                         }
                         return sum;
                     }, 0);

                     return (
                     <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                         <div className="flex items-center gap-3 mb-6">
                             <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(139,92,246,0.2))", color: "#ec4899", border: "1px solid rgba(236,72,153,0.3)" }}>
                                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                             </div>
                             <div>
                                 <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Pre-book an Order</h3>
                                 <p className="text-xs mt-1" style={{ color: "#64748b" }}>Agay ki date ke liye order record karein</p>
                             </div>
                         </div>
                         <form onSubmit={handlePrebook} className="space-y-4 md:space-y-6">
                             {/* Dynamic Products List */}
                             <div className="space-y-4">
                                 <div className="flex justify-between items-end">
                                     <label className="form-label mb-0">Products *</label>
                                     <button 
                                         type="button" 
                                         onClick={handleAddItem}
                                         className="text-sm font-black flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors shadow-lg hover:scale-105 active:scale-95 duration-200"
                                         style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.25), rgba(139,92,246,0.25))", color: "#ec4899", border: "1px solid rgba(236,72,153,0.5)", boxShadow: "0 4px 15px -3px rgba(236, 72, 153, 0.3)" }}
                                     >
                                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                         Add Another Product
                                     </button>
                                 </div>
                                 
                                 {items.map((item, index) => {
                                     const qtyNum = parseInt(item.qtySold) || 0;
                                     const itemStock = stock.find((s) => s.product.id === item.productId);

                                     return (
                                         <div key={index} className="p-4 rounded-xl space-y-3 relative" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                             {items.length > 1 && (
                                                 <button 
                                                     type="button"
                                                     onClick={() => handleRemoveItem(index)}
                                                     className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/40 transition-colors z-10"
                                                 >
                                                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                 </button>
                                             )}
                                             
                                             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                 <div className="md:col-span-2">
                                                     <select
                                                         className="input-field py-2.5 text-sm"
                                                         value={item.productId}
                                                         onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                                                         required
                                                         style={{ borderColor: item.productId ? "rgba(236,72,153,0.3)" : undefined }}
                                                     >
                                                         <option value="">Select product to pre-book</option>
                                                         {/* Show all products, not just those with remaining stock */}
                                                         {stock.map((s) => (
                                                             <option key={s.product.id} value={s.product.id}>
                                                                 {s.product.name} (Factory Price: ₹{s.product.pricePerUnit})
                                                             </option>
                                                         ))}
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <input
                                                         type="number"
                                                         className="input-field py-2.5 text-sm"
                                                         placeholder="Qty"
                                                         value={item.qtySold}
                                                         onChange={(e) => handleItemChange(index, "qtySold", e.target.value)}
                                                         min="1"
                                                         required
                                                         style={{ borderColor: qtyNum > 0 ? "rgba(236,72,153,0.3)" : undefined }}
                                                     />
                                                 </div>
                                             </div>
                                             
                                             {itemStock && qtyNum > 0 && (
                                                 <div className="flex justify-between items-center px-1">
                                                     <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                                                         {qtyNum} × ₹{itemStock.pricePerUnit} = 
                                                     </span>
                                                     <span className="text-sm font-bold" style={{ color: "#ec4899" }}>
                                                         ₹{(qtyNum * itemStock.pricePerUnit).toLocaleString()}
                                                     </span>
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })}
                                 
                                 {totalAmount > 0 && (
                                     <div className="flex justify-between items-center p-4 rounded-xl mt-2" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)" }}>
                                         <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>Total Expected Amount:</span>
                                         <span className="font-black text-xl" style={{ color: "#ec4899" }}>₹{totalAmount.toLocaleString()}</span>
                                     </div>
                                 )}
                             </div>

                             <div>
                                 <label className="form-label">Customer Name *</label>
                                 <input
                                     type="text"
                                     className="input-field"
                                     placeholder="e.g. Khan Store"
                                     value={customerName}
                                     onChange={(e) => setCustomerName(e.target.value)}
                                     required
                                     style={{ borderColor: customerName.trim() ? "rgba(236,72,153,0.3)" : undefined }}
                                 />
                             </div>

                             <div className="grid grid-cols-2 gap-3">
                                 <div>
                                     <label className="form-label">Phone Number *</label>
                                     <input
                                         type="tel"
                                         className="input-field"
                                         placeholder="e.g. 03001234567"
                                         value={customerPhone}
                                         onChange={(e) => setCustomerPhone(e.target.value)}
                                         required
                                         style={{ borderColor: customerPhone.trim() ? "rgba(236,72,153,0.3)" : undefined }}
                                     />
                                 </div>
                                 <div>
                                     <label className="form-label">Shop Number *</label>
                                     <input
                                         type="text"
                                         className="input-field"
                                         placeholder="e.g. Shop 12"
                                         value={shopNumber}
                                         onChange={(e) => setShopNumber(e.target.value)}
                                         required
                                         style={{ borderColor: shopNumber.trim() ? "rgba(236,72,153,0.3)" : undefined }}
                                     />
                                 </div>
                             </div>

                             <div>
                                 <label className="form-label">Address / Location</label>
                                 <textarea
                                     className="input-field min-h-[80px]"
                                     placeholder="e.g. Main Market, Block 4"
                                     value={customerAddress}
                                     onChange={(e) => setCustomerAddress(e.target.value)}
                                 />
                             </div>

                             <div>
                                 <label className="form-label">Delivery Date *</label>
                                 <input
                                     type="date"
                                     className="input-field cursor-pointer"
                                     value={deliveryDate}
                                     onChange={(e) => setDeliveryDate(e.target.value)}
                                     min={new Date().toISOString().split("T")[0]}
                                     required
                                     style={{ borderColor: deliveryDate ? "rgba(236,72,153,0.3)" : undefined }}
                                 />
                                 <p className="text-xs text-gray-400 mt-1 ml-1">Select the exact date Admin needs to dispatch this</p>
                             </div>

                             {/* Validation Status */}
                             {!isFormValid && (items[0].productId || customerName || customerPhone || shopNumber) && (
                                 <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}>
                                     <div className="font-bold mb-1">⚠ Ye fields bharna zaroori hai:</div>
                                     <div style={{ color: "#f59e0b" }}>{missingFields.join(", ")}</div>
                                 </div>
                             )}

                             <button 
                                 type="submit" 
                                 disabled={!isFormValid}
                                 className="btn-primary w-full justify-center py-4 text-base mt-4" 
                                 style={{ 
                                     background: isFormValid ? "linear-gradient(135deg, #ec4899, #be185d)" : "rgba(100,116,139,0.2)", 
                                     boxShadow: isFormValid ? "0 10px 25px -5px rgba(236, 72, 153, 0.4)" : "none",
                                     color: isFormValid ? "#fff" : "#64748b",
                                     cursor: isFormValid ? "pointer" : "not-allowed",
                                     opacity: isFormValid ? 1 : 0.6,
                                     border: isFormValid ? "none" : "1px solid rgba(100,116,139,0.2)",
                                 }}
                             >
                                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                 {isFormValid ? "✅ Confirm Pre-booking" : "🔒 Fill All Details First"}
                             </button>
                         </form>
                     </div>
                     );
                 })()}

                {/* My Prebookings History View */}
                {activeView === "prebookings" && (
                    <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(139,92,246,0.2))", color: "#ec4899", border: "1px solid rgba(236,72,153,0.3)" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>My Pre-bookings</h3>
                        </div>
                        
                        {myPrebookings.length === 0 ? (
                            <div className="text-center py-12" style={{ color: "#64748b" }}>
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-slate-400 mb-4">
                                     <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </div>
                                <p className="font-bold text-base">No pre-bookings yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myPrebookings.map((p) => (
                                    <div key={p.id} className="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors hover:bg-white/5" style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border" style={{
                                                background: p.status === "pending" ? "rgba(245,158,11,0.1)" : p.status === "fulfilled" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                                                color: p.status === "pending" ? "#fbbf24" : p.status === "fulfilled" ? "#34d399" : "#f87171",
                                                borderColor: p.status === "pending" ? "rgba(245,158,11,0.2)" : p.status === "fulfilled" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-base" style={{ color: "#f8fafc" }}>{p.productName}</p>
                                                <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>
                                                    {p.customerName ? `${p.customerName} • ` : ""}Delivery: <span style={{ color: "#e2e8f0" }}>{p.deliveryDate}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right w-full sm:w-auto px-4 py-2 sm:p-0 rounded-lg sm:bg-transparent" style={{ background: "rgba(255,255,255,0.03)" }}>
                                            <p className="font-black text-lg" style={{ color: "#ec4899" }}>₹{(p.quantity * p.pricePerUnit).toLocaleString()}</p>
                                            <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>{p.quantity} units</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Activity Feed View */}
                {activeView === "activity" && (() => {
                    const activities = [
                        ...salesHistory.map(s => ({ ...s, type: "sale" as const, timestamp: s.createdAt })),
                        ...myPrebookings.map(p => ({ ...p, type: "prebook" as const, timestamp: p.createdAt })),
                    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                    const handleExportCSV = () => {
                        if (activities.length === 0) return;
                        
                        const data = activities.map(a => {
                            const isSale = a.type === "sale";
                            const quantity = isSale ? (a as any).quantitySold : (a as any).quantity;
                            const dateValue = isSale ? (a as any).date : (a as any).deliveryDate;
                            const statusValue = (a as any).status || "Completed";

                            return {
                                Type: a.type.toUpperCase(),
                                Date: dateValue,
                                Product: a.productName,
                                Quantity: quantity || 0,
                                Customer: a.customerName || "N/A",
                                Amount: (quantity || 0) * a.pricePerUnit,
                                Status: statusValue
                            };
                        });

                        exportToCSV(data, `activity_export_${new Date().toISOString().split("T")[0]}`);
                    };

                    return (
                        <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                    </div>
                                    <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Recent Activity</h3>
                                </div>
                                
                                {activities.length > 0 && (
                                    <button 
                                        onClick={handleExportCSV}
                                        className="btn-primary py-2 px-4 shadow-lg flex items-center gap-2 text-sm"
                                        style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Export CSV
                                    </button>
                                )}
                            </div>

                            {activities.length === 0 ? (
                                <div className="text-center py-12" style={{ color: "#64748b" }}>
                                    <p className="font-bold text-base">No recent activity detected</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activities.map((a, idx) => (
                                        <div key={idx} className="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors hover:bg-white/5" style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border" style={{
                                                    background: a.type === "sale" ? "rgba(16,185,129,0.1)" : "rgba(236,72,153,0.1)",
                                                    color: a.type === "sale" ? "#34d399" : "#ec4899",
                                                    borderColor: a.type === "sale" ? "rgba(16,185,129,0.2)" : "rgba(236,72,153,0.2)"
                                                }}>
                                                    {a.type === "sale" ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                                    ) : (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-base" style={{ color: "#f8fafc" }}>
                                                        {a.type === "sale" ? "New Sale" : "Pre-booking"}: {a.productName}
                                                    </p>
                                                    <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>
                                                        {a.customerName ? `${a.customerName} • ` : ""}{new Date(a.timestamp).toLocaleString("en-PK")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right w-full sm:w-auto px-4 py-2 sm:p-0 rounded-lg sm:bg-transparent" style={{ background: "rgba(255,255,255,0.03)" }}>
                                                <p className="font-black text-lg" style={{ color: a.type === "sale" ? "#34d399" : "#ec4899" }}>
                                                    ₹{(((a as any).quantitySold || (a as any).quantity || 0) * a.pricePerUnit).toLocaleString()}
                                                </p>
                                                <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>
                                                    {(a as any).quantitySold || (a as any).quantity || 0} units
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </main>

            {/* Bottom Quick Action - Mobile */}
            <div className="fixed bottom-0 left-0 right-0 p-4 sm:hidden z-50 pointer-events-none" style={{ background: "linear-gradient(transparent, rgba(6, 4, 23, 0.95) 40%)" }}>
                <button
                    onClick={() => setActiveView("sell")}
                    className="w-full justify-center py-4 text-base font-bold rounded-2xl flex items-center gap-2 pointer-events-auto"
                    style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)" }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    Quick Sale
                </button>
            </div>
        </div>
    );
}
