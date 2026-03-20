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
    getProducts,
    addReturn,
    getReturns,
} from "@/lib/store";
import { exportToCSV } from "@/lib/export";
import type { User, Product, ReturnEntry } from "@/lib/store";

export default function SalesDashboard() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [stock, setStock] = useState<ReturnType<typeof getProductStockForSalesPerson>>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [summary, setSummary] = useState({ totalDispatched: 0, totalSold: 0, remainingStock: 0, totalRevenue: 0 });
    const [activeView, setActiveView] = useState<"stock" | "sell" | "history" | "prebook" | "prebookings" | "activity" | "returns">("stock");
    const [success, setSuccess] = useState("");
    const [selectedBill, setSelectedBill] = useState<any>(null);

    // Sale form state
    const [items, setItems] = useState([{ productId: "", qtySold: "", customPrice: "" }]);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [date] = useState(getTodayString());
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "online" | "credit">("cash");
    const [creditDueDate, setCreditDueDate] = useState<string>("");

    // Pre-booking form state
    const [deliveryDate, setDeliveryDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
    });

    // History & Pre-bookings
    const [salesHistory, setSalesHistory] = useState<ReturnType<typeof getSales>>([]);
    const [myPrebookings, setMyPrebookings] = useState<ReturnType<typeof getPrebookings>>([]);

    // Return form state
    const [returnType, setReturnType] = useState<"defective" | "return">("defective");
    const [returnItems, setReturnItems] = useState([{ productId: "", qty: "" }]);
    const [returnReason, setReturnReason] = useState("");
    const [returnCustomerName, setReturnCustomerName] = useState("");
    const [returnContactNumber, setReturnContactNumber] = useState("");
    const [myReturns, setMyReturns] = useState<ReturnEntry[]>([]);

    // Location sharing
    const [locationStatus, setLocationStatus] = useState<"sharing" | "denied" | "loading" | "error">("loading");

    const loadData = useCallback((userId: string) => {
        setStock(getProductStockForSalesPerson(userId));
        setAllProducts(getProducts());
        setSummary(getStockSummary(userId));
        setSalesHistory(getSales().filter((s) => s.salesPersonId === userId).reverse());
        setMyPrebookings(getPrebookings().filter((p) => p.salesPersonId === userId).reverse());
        setMyReturns(getReturns().filter((r) => r.salesPersonId === userId).reverse());
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
        const billId = `BILL-${Date.now()}`;
        
        items.forEach(item => {
            const productStock = stock.find((s) => s.product.id === item.productId);
            if (!productStock) return;
            
            totalQty += parseInt(item.qtySold);
            namesPattern.push(productStock.product.name);

            addSale({
                billId,
                productId: item.productId,
                productName: productStock.product.name,
                quantitySold: parseInt(item.qtySold),
                customerName: customerName || "",
                customerPhone: customerPhone || "",
                customerAddress: customerAddress || "",
                salesPersonId: currentUser.id,
                salesPersonName: currentUser.name,
                pricePerUnit: parseFloat(item.customPrice) || productStock.pricePerUnit,
                    warehousePrice: productStock.pricePerUnit,
                    date,
                    paymentMethod,
                    creditDueDate: paymentMethod === "credit" ? creditDueDate : undefined
                });
        });

        const successMessage = namesPattern.length > 1 
            ? `✅ Sold ${totalQty} items across ${namesPattern.length} products` 
            : `✅ Sold ${totalQty} × ${namesPattern[0]}`;

        setSuccess(successMessage);
        setItems([{ productId: "", qtySold: "", customPrice: "" }]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        setPaymentMethod("cash");
        setCreditDueDate("");
        loadData(currentUser.id);
        setActiveView("stock");
        setTimeout(() => setSuccess(""), 3000);
    };

    const handleAddItem = () => {
        setItems([...items, { productId: "", qtySold: "", customPrice: "" }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: "productId" | "qtySold" | "customPrice", value: string) => {
        const newItems = [...items] as any;
        newItems[index][field] = value;
        
        // Auto-fill price when product is selected
        if (field === "productId") {
            const productInfo = allProducts.find((p) => p.id === value);
            if (productInfo) {
                newItems[index].customPrice = productInfo.pricePerUnit.toString();
            } else {
                newItems[index].customPrice = "";
            }
        }
        
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
            const prod = allProducts.find((p) => p.id === item.productId);
            // We use allProducts array here just to get product name and price. We don't check remaining stock for prebookings.
            if (!prod) return;

            totalQty += parseInt(item.qtySold);
            namesPattern.push(prod.name);

            addPrebooking({
                productId: item.productId,
                productName: prod.name,
                quantity: parseInt(item.qtySold),
                customerName: customerName || "",
                customerPhone: customerPhone || "",
                customerAddress: customerAddress || "",
                salesPersonId: currentUser.id,
                salesPersonName: currentUser.name,
                pricePerUnit: parseFloat(item.customPrice) || prod.pricePerUnit,
                warehousePrice: prod.pricePerUnit,
                deliveryDate: deliveryDate,
            });
        });

        const successMessage = namesPattern.length > 1
            ? `✅ Pre-booked ${totalQty} items across ${namesPattern.length} products for ${deliveryDate}`
            : `✅ Pre-booked ${totalQty} × ${namesPattern[0]} for ${deliveryDate}`;

        setSuccess(successMessage);
        setItems([{ productId: "", qtySold: "", customPrice: "" }]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDeliveryDate(tomorrow.toISOString().split("T")[0]);
        loadData(currentUser.id);
        setActiveView("prebookings");
        setTimeout(() => setSuccess(""), 3000);
    };

    const handleReturnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || returnItems.length === 0) return;

        let totalQty = 0;
        const namesPattern: string[] = [];

        returnItems.forEach(item => {
            const productStock = stock.find((s) => s.product.id === item.productId);
            const prod = allProducts.find((p) => p.id === item.productId);
            const productName = productStock?.product.name || prod?.name || "Unknown";
            totalQty += parseInt(item.qty);
            namesPattern.push(productName);

            addReturn({
                productId: item.productId,
                productName,
                quantity: parseInt(item.qty),
                reason: returnReason,
                type: returnType,
                salesPersonId: currentUser.id,
                salesPersonName: currentUser.name,
                customerName: returnCustomerName || undefined,
                date: getTodayString(),
            });
        });

        const successMessage = namesPattern.length > 1
            ? `✅ ${returnType === "defective" ? "Defective" : "Return"} recorded: ${totalQty} items across ${namesPattern.length} products`
            : `✅ ${returnType === "defective" ? "Defective" : "Return"} recorded: ${totalQty} × ${namesPattern[0]}`;

        setSuccess(successMessage);
        setReturnItems([{ productId: "", qty: "" }]);
        setReturnReason("");
        setReturnCustomerName("");
        setReturnContactNumber("");
        setReturnType("defective");
        loadData(currentUser.id);
        setTimeout(() => setSuccess(""), 3000);
    };

    const handleAddReturnItem = () => {
        setReturnItems([...returnItems, { productId: "", qty: "" }]);
    };

    const handleRemoveReturnItem = (index: number) => {
        setReturnItems(returnItems.filter((_, i) => i !== index));
    };

    const handleReturnItemChange = (index: number, field: "productId" | "qty", value: string) => {
        const newItems = [...returnItems];
        newItems[index][field] = value;
        setReturnItems(newItems);
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
                
                {/* Credit Reminders Section */}
                {(() => {
                    const today = getTodayString();
                    const duePayments = salesHistory.filter(s => s.paymentMethod === "credit" && s.creditDueDate === today);
                    if (duePayments.length === 0) return null;
                    
                    return (
                        <div className="p-5 rounded-2xl flex flex-col gap-3 animate-in zoom-in-95 duration-500" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)" }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-500">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-base text-amber-100">Aj {duePayments.length} Payment(s) leni hain!</h4>
                                    <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">Credit Collection Reminders</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                {duePayments.map(p => (
                                    <div key={p.id} className="p-3 rounded-xl bg-black/30 border border-white/5 flex justify-between items-center transition-all hover:bg-black/40">
                                        <div>
                                            <p className="text-sm font-bold text-slate-200">{p.customerName || "Customer"}</p>
                                            <p className="text-[10px] text-slate-400">{p.productName} • {p.quantitySold}kg</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-amber-400">₹{(p.quantitySold * p.pricePerUnit).toLocaleString()}</p>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">{p.customerPhone}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* Tabs */}
                <div className="flex gap-3 p-2 rounded-2xl w-full overflow-x-auto tabs-container" style={{ background: "rgba(15, 10, 46, 0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99, 102, 241, 0.1)" }}>
                    {([
                        { key: "stock", label: "My Stock", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> },
                        { key: "sell", label: "New Sale", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> },
                        { key: "returns", label: "Return", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg> },
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
                        (paymentMethod !== "credit" || creditDueDate !== "");
                    
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
                    if (paymentMethod === "credit" && !creditDueDate) missingFields.push("Credit Due Date");
                    
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
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div className="md:col-span-2">
                                                    <select
                                                        className="input-field py-2.5 text-sm"
                                                        value={item.productId}
                                                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                                                        required
                                                        style={{ borderColor: item.productId ? "rgba(16,185,129,0.3)" : undefined }}
                                                    >
                                                        <option value="">Select product...</option>
                                                        {stock.filter((s) => s.remaining > 0).map((s) => (
                                                            <option key={s.product.id} value={s.product.id}>
                                                                {s.product.name} (Current: ₹{s.pricePerUnit} • {s.remaining} left)
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
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Selling Price (₹)</label>
                                                    <input
                                                        type="number"
                                                        className="input-field py-2.5 text-sm"
                                                        placeholder="Price"
                                                        value={item.customPrice}
                                                        onChange={(e) => handleItemChange(index, "customPrice", e.target.value)}
                                                        min="1"
                                                        step="0.01"
                                                        required
                                                        style={{ borderColor: parseFloat(item.customPrice) > 0 ? "rgba(16,185,129,0.3)" : undefined }}
                                                    />
                                                    {itemStock && (
                                                        <div className="mt-1.5 px-2.5 py-1 rounded-lg flex items-center justify-between border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.05)" }}>
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Warehouse Rate</span>
                                                            <span className="text-[11px] font-black text-slate-300">₹{itemStock.pricePerUnit}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {hasStockError && (
                                                <div className="p-2 rounded-lg text-xs font-bold" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                                                    ⚠ Only {itemStock?.remaining} available!
                                                </div>
                                            )}
                                            
                                            {itemStock && qtyNum > 0 && parseFloat(item.customPrice) > 0 && !hasStockError && (
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                                                        {qtyNum} × ₹{item.customPrice} = 
                                                    </span>
                                                    <span className="text-sm font-bold" style={{ color: "#34d399" }}>
                                                        ₹{(qtyNum * parseFloat(item.customPrice)).toLocaleString()}
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
                                    placeholder=""
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                    style={{ borderColor: customerName.trim() ? "rgba(16,185,129,0.3)" : undefined }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Phone Number *</label>
                                    <input
                                        type="tel"
                                        className="input-field"
                                        placeholder=""
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        required
                                        style={{ borderColor: customerPhone.trim() ? "rgba(16,185,129,0.3)" : undefined }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Address / Location</label>
                                <textarea
                                    className="input-field min-h-[80px]"
                                    placeholder=""
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="form-label">Payment Method *</label>
                                <div className="grid grid-cols-3 gap-3 mt-1 mb-4">
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "cash" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
                                        <input type="radio" name="payment" value="cash" className="hidden" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} />
                                        <span className="font-bold text-[10px] sm:text-xs">💵 Cash</span>
                                    </label>
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "online" ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
                                        <input type="radio" name="payment" value="online" className="hidden" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} />
                                        <span className="font-bold text-[10px] sm:text-xs">📱 Online</span>
                                    </label>
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "credit" ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
                                        <input type="radio" name="payment" value="credit" className="hidden" checked={paymentMethod === "credit"} onChange={() => setPaymentMethod("credit")} />
                                        <span className="font-bold text-[10px] sm:text-xs">💳 Credit</span>
                                    </label>
                                </div>
                                {paymentMethod === "credit" && (
                                    <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="form-label">Payment Due Date (Kab pessa milay ga?) *</label>
                                        <input
                                            type="date"
                                            className="input-field"
                                            value={creditDueDate}
                                            onChange={(e) => setCreditDueDate(e.target.value)}
                                            min={getTodayString()}
                                            required
                                            style={{ borderColor: creditDueDate ? "rgba(245,158,11,0.3)" : undefined }}
                                        />
                                        <p className="text-[10px] mt-1 text-amber-400/70 ml-1">Admin ko is date par reminder notification jaye ga.</p>
                                    </div>
                                )}
                                {paymentMethod === "online" && totalAmount > 0 && (
                                    <div className="mb-6 flex flex-col items-center p-6 rounded-2xl" style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.3)" }}>
                                        <h4 className="text-lg font-bold mb-2" style={{ color: "#818cf8" }}>Scan to Pay ₹{totalAmount.toLocaleString()}</h4>
                                        <div className="p-3 rounded-xl bg-white shadow-xl relative mt-2 group overflow-hidden">
                                            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                            <img src="/qr-payment.jpg" alt="Payment QR" className="w-[180px] h-[180px] object-contain transition-transform duration-500 group-hover:scale-105" />
                                        </div>
                                    </div>
                                )}
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
                            {!isFormValid && (items[0].productId || customerName || customerPhone) && (
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
                        ) : (() => {
                            // Group sales by billId
                            const billsMap = salesHistory.reduce((acc, sale) => {
                                const key = sale.billId || sale.id;
                                if (!acc[key]) {
                                    acc[key] = {
                                        id: key,
                                        isBill: !!sale.billId,
                                        date: sale.createdAt,
                                        displayDate: sale.date,
                                        customerName: sale.customerName,
                                        paymentMethod: sale.paymentMethod,
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
                            
                            const bills = Object.values(billsMap).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

                            return (
                                <div className="space-y-4">
                                    {bills.map((bill: any) => (
                                        <div key={bill.id} className="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors hover:bg-white/5" style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-base flex flex-wrap gap-2 items-center" style={{ color: "#f8fafc" }}>
                                                        {bill.isBill ? bill.id : bill.sales[0].productName}
                                                        {bill.paymentMethod === "online" && <span className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 align-middle">ONLINE</span>}
                                                    </p>
                                                    <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>
                                                        {bill.customerName ? `${bill.customerName} • ` : ""}{bill.displayDate}
                                                    </p>
                                                    
                                                    {bill.isBill && (
                                                        <div className="mt-2 text-xs" style={{ color: "#94a3b8" }}>
                                                            {bill.sales.map((s: any) => `${s.quantitySold}x ${s.productName}`).join(", ")}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right w-full sm:w-auto px-4 py-2 sm:p-0 rounded-lg sm:bg-transparent flex flex-col items-start sm:items-end gap-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                                                <div>
                                                    <p className="font-black text-lg" style={{ color: "#34d399" }}>₹{bill.totalAmount.toLocaleString()}</p>
                                                    <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>{bill.totalItems} units total</p>
                                                </div>
                                                <button onClick={() => setSelectedBill(bill)} className="text-xs font-bold px-4 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors flex items-center gap-1.5">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    View Bill
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
                {/* Pre-book Form */}
                 {activeView === "prebook" && (() => {
                     const isFormValid = items.length > 0 && items.every(item => {
                         const qtyNum = parseInt(item.qtySold) || 0;
                         // For prebooking, we don't validate against current remaining stock, just that a product is selected and qty > 0
                         return item.productId !== "" && qtyNum > 0 && parseFloat(item.customPrice) > 0;
                     }) &&
                         customerName.trim() !== "" &&
                         customerPhone.trim() !== "" &&
                         deliveryDate !== "";
                     
                     const missingFields: string[] = [];
                     let hasInvalidItems = false;
                     
                     items.forEach((item) => {
                         if (!item.productId) hasInvalidItems = true;
                         if (parseInt(item.qtySold) <= 0 || !item.qtySold) hasInvalidItems = true;
                         if (parseFloat(item.customPrice) <= 0 || !item.customPrice) hasInvalidItems = true;
                     });

                     if (hasInvalidItems) missingFields.push("All Products, Qty & Selling Price");
                     if (!customerName.trim()) missingFields.push("Customer Name");
                     if (!customerPhone.trim()) missingFields.push("Phone Number");
                     if (!deliveryDate) missingFields.push("Delivery Date");
                     
                     // Calculate total
                     const totalAmount = items.reduce((sum, item) => {
                         const price = parseFloat(item.customPrice) || 0;
                         if (item.qtySold && price > 0) {
                             return sum + ((parseInt(item.qtySold) || 0) * price);
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
                                     const prod = allProducts.find((p) => p.id === item.productId);

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
                                                         {/* Show all warehouse products */}
                                                         {allProducts.map((p) => (
                                                             <option key={p.id} value={p.id}>
                                                                 {p.name} (Factory Price: ₹{p.pricePerUnit})
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
                                             
                                             {prod && qtyNum > 0 && (
                                                 <div className="flex justify-between items-center px-1">
                                                     <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                                                         {qtyNum} × ₹{prod.pricePerUnit} = 
                                                     </span>
                                                     <span className="text-sm font-bold" style={{ color: "#ec4899" }}>
                                                         ₹{(qtyNum * prod.pricePerUnit).toLocaleString()}
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
                                     placeholder=""
                                     value={customerName}
                                     onChange={(e) => setCustomerName(e.target.value)}
                                     required
                                     style={{ borderColor: customerName.trim() ? "rgba(236,72,153,0.3)" : undefined }}
                                 />
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 <div>
                                     <label className="form-label">Phone Number *</label>
                                     <input
                                         type="tel"
                                         className="input-field"
                                         placeholder=""
                                         value={customerPhone}
                                         onChange={(e) => setCustomerPhone(e.target.value)}
                                         required
                                         style={{ borderColor: customerPhone.trim() ? "rgba(236,72,153,0.3)" : undefined }}
                                     />
                                 </div>
                             </div>

                             <div>
                                 <label className="form-label">Address / Location</label>
                                 <textarea
                                     className="input-field min-h-[80px]"
                                     placeholder=""
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
                             {!isFormValid && (items[0].productId || customerName || customerPhone) && (
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
                            const act = a as { quantitySold?: number; quantity?: number; date?: string; deliveryDate?: string; status?: string; paymentMethod?: string; };
                            const quantity = isSale ? act.quantitySold : act.quantity;
                            const dateValue = isSale ? act.date : act.deliveryDate;
                            const statusValue = act.status || "Completed";

                            return {
                                Type: a.type.toUpperCase(),
                                Date: dateValue,
                                Product: a.productName,
                                Quantity: quantity || 0,
                                Customer: a.customerName || "N/A",
                                Amount: (quantity || 0) * a.pricePerUnit,
                                Payment: act.paymentMethod || (isSale ? "cash" : "N/A"),
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
                                                        {a.type === "sale" && (a as any).paymentMethod === "online" && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 align-middle">ONLINE</span>}
                                                    </p>
                                                    <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>
                                                        {a.customerName ? `${a.customerName} • ` : ""}{new Date(a.timestamp).toLocaleString("en-PK")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right w-full sm:w-auto px-4 py-2 sm:p-0 rounded-lg sm:bg-transparent" style={{ background: "rgba(255,255,255,0.03)" }}>
                                                <p className="font-black text-lg" style={{ color: a.type === "sale" ? "#34d399" : "#ec4899" }}>
                                                    ₹{(((a as { quantitySold?: number; quantity?: number }).quantitySold || (a as { quantitySold?: number; quantity?: number }).quantity || 0) * a.pricePerUnit).toLocaleString()}
                                                </p>
                                                <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>
                                                    {(a as { quantitySold?: number; quantity?: number }).quantitySold || (a as { quantitySold?: number; quantity?: number }).quantity || 0} units
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Return / Defective Form + History */}
                {activeView === "returns" && (() => {
                    const isReturnFormValid = returnItems.length > 0 && returnItems.every(item => item.productId !== "" && parseInt(item.qty) > 0) && returnReason.trim() !== "";
                    return (
                        <div className="space-y-6">
                            {/* Return Form */}
                            <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: `1px solid ${returnType === "defective" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: returnType === "defective" ? "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2))" : "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.2))", color: returnType === "defective" ? "#f87171" : "#fbbf24", border: `1px solid ${returnType === "defective" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>Return / Defective Product</h3>
                                        <p className="text-xs mt-1" style={{ color: "#64748b" }}>Product defective hai ya customer ne return kiya? Yahan record karein</p>
                                    </div>
                                </div>
                                <form onSubmit={handleReturnSubmit} className="space-y-4">
                                    {/* Type Selector */}
                                    <div>
                                        <label className="form-label">Type *</label>
                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                            <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${returnType === "defective" ? "border-red-500 bg-red-500/10" : "border-slate-700 bg-slate-800/50"}`}>
                                                <input type="radio" name="returnType" value="defective" className="hidden" checked={returnType === "defective"} onChange={() => setReturnType("defective")} />
                                                <span className="text-2xl mb-1">🔴</span>
                                                <span className="font-bold text-sm" style={{ color: returnType === "defective" ? "#f87171" : "#94a3b8" }}>Defective</span>
                                                <span className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>Product kharab hai</span>
                                            </label>
                                            <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${returnType === "return" ? "border-amber-500 bg-amber-500/10" : "border-slate-700 bg-slate-800/50"}`}>
                                                <input type="radio" name="returnType" value="return" className="hidden" checked={returnType === "return"} onChange={() => setReturnType("return")} />
                                                <span className="text-2xl mb-1">🟡</span>
                                                <span className="font-bold text-sm" style={{ color: returnType === "return" ? "#fbbf24" : "#94a3b8" }}>Customer Return</span>
                                                <span className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>Customer ne wapas kiya</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Dynamic Products List */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <label className="form-label mb-0">Products *</label>
                                            <button
                                                type="button"
                                                onClick={handleAddReturnItem}
                                                className="text-sm font-black flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors shadow-lg hover:scale-105 active:scale-95 duration-200"
                                                style={{ background: returnType === "defective" ? "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.25))" : "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.25))", color: returnType === "defective" ? "#f87171" : "#fbbf24", border: `1px solid ${returnType === "defective" ? "rgba(239,68,68,0.5)" : "rgba(245,158,11,0.5)"}`, boxShadow: returnType === "defective" ? "0 4px 15px -3px rgba(239,68,68,0.3)" : "0 4px 15px -3px rgba(245,158,11,0.3)" }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                Add Another Product
                                            </button>
                                        </div>

                                        {returnItems.map((item, index) => (
                                            <div key={index} className="p-4 rounded-xl space-y-3 relative" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                                {returnItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveReturnItem(index)}
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
                                                            onChange={(e) => handleReturnItemChange(index, "productId", e.target.value)}
                                                            required
                                                            style={{ borderColor: item.productId ? (returnType === "defective" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)") : undefined }}
                                                        >
                                                            <option value="">Select product</option>
                                                            {stock.filter(s => s.dispatched > 0).map((s) => (
                                                                <option key={s.product.id} value={s.product.id}>{s.product.name} ({s.remaining} in hand)</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="number"
                                                            className="input-field py-2.5 text-sm"
                                                            placeholder="Qty"
                                                            value={item.qty}
                                                            onChange={(e) => handleReturnItemChange(index, "qty", e.target.value)}
                                                            min="1"
                                                            required
                                                            style={{ borderColor: parseInt(item.qty) > 0 ? (returnType === "defective" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)") : undefined }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <label className="form-label">Reason *</label>
                                        <textarea className="input-field min-h-[80px]" placeholder="" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} required style={{ borderColor: returnReason.trim() ? (returnType === "defective" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)") : undefined }} />
                                    </div>

                                    {/* Customer/Contact */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="form-label">Customer Name</label>
                                            <input type="text" className="input-field" placeholder="" value={returnCustomerName} onChange={(e) => setReturnCustomerName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="form-label">Contact Number</label>
                                            <input type="tel" className="input-field" placeholder="" value={returnContactNumber} onChange={(e) => setReturnContactNumber(e.target.value)} />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={!isReturnFormValid} className="btn-primary w-full justify-center py-4 text-base mt-4" style={{ background: isReturnFormValid ? (returnType === "defective" ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #f59e0b, #d97706)") : "rgba(100,116,139,0.2)", boxShadow: isReturnFormValid ? (returnType === "defective" ? "0 10px 25px -5px rgba(239,68,68,0.4)" : "0 10px 25px -5px rgba(245,158,11,0.4)") : "none", color: isReturnFormValid ? "#fff" : "#64748b", cursor: isReturnFormValid ? "pointer" : "not-allowed", opacity: isReturnFormValid ? 1 : 0.6, border: isReturnFormValid ? "none" : "1px solid rgba(100,116,139,0.2)" }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                                        {isReturnFormValid ? (returnType === "defective" ? "🔴 Record Defective" : "🟡 Record Return") : "🔒 Fill All Details First"}
                                    </button>
                                </form>
                            </div>

                            {/* Return History */}
                            <div className="dash-section p-6 md:p-8" style={{ borderRadius: 24, background: "rgba(15,10,46,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </div>
                                    <h3 className="text-xl font-bold" style={{ color: "#f8fafc" }}>My Returns History</h3>
                                </div>
                                {myReturns.length === 0 ? (
                                    <div className="text-center py-12" style={{ color: "#64748b" }}>
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-slate-400 mb-4">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                                        </div>
                                        <p className="font-bold text-base">No returns recorded yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {myReturns.map((r) => (
                                            <div key={r.id} className="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors hover:bg-white/5" style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border" style={{ background: r.type === "defective" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: r.type === "defective" ? "#f87171" : "#fbbf24", borderColor: r.type === "defective" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)" }}>
                                                        {r.type === "defective" ? (
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                                        ) : (
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-base" style={{ color: "#f8fafc" }}>
                                                            {r.productName}
                                                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider align-middle" style={{ background: r.type === "defective" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", color: r.type === "defective" ? "#f87171" : "#fbbf24", border: `1px solid ${r.type === "defective" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                                                                {r.type === "defective" ? "DEFECTIVE" : "RETURN"}
                                                            </span>
                                                        </p>
                                                        <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "#64748b" }}>
                                                            {r.reason} • {r.date}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-left sm:text-right w-full sm:w-auto px-4 py-2 sm:p-0 rounded-lg sm:bg-transparent" style={{ background: "rgba(255,255,255,0.03)" }}>
                                                    <p className="font-black text-lg" style={{ color: r.type === "defective" ? "#f87171" : "#fbbf24" }}>{r.quantity} units</p>
                                                    <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>{r.customerName || "—"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                    <p className="text-sm font-bold text-slate-500 mt-1">Salesperson: <span className="text-slate-800">{selectedBill.sales[0]?.salesPersonName || currentUser?.name || "N/A"}</span></p>
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
