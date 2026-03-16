// Local data store using localStorage for offline-first experience
// Can be replaced with Supabase client when backend is connected

export interface User {
    id: string;
    name: string;
    loginId: string;
    role: "admin" | "sales";
    password: string;
}

export interface Product {
    id: string;
    name: string;
    pricePerUnit: number;
    totalStock: number; // Warehouse stock
    inStock?: boolean;
}

export interface DispatchEntry {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    pricePerUnit: number;
    salesPersonId: string;
    salesPersonName: string;
    date: string;
    createdAt: string;
}

export interface SaleEntry {
    id: string;
    productId: string;
    productName: string;
    quantitySold: number;
    customerName: string;
    customerPhone?: string;
    customerAddress?: string;
    shopNumber?: string;
    salesPersonId: string;
    salesPersonName: string;
    pricePerUnit: number;
    date: string;
    createdAt: string;
}

export interface DriverLocation {
    userId: string;
    userName: string;
    latitude: number;
    longitude: number;
    areaName: string;
    lastUpdated: string;
}

// Generate unique ID
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Safe JSON parse
function safeGet<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch {
        return fallback;
    }
}

function safeSet(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
}

// ===== SEED DATA =====
const DEFAULT_USERS: User[] = [
    { id: "admin1", name: "Admin Owner", loginId: "admin", role: "admin", password: "admin123" },
    { id: "sales1", name: "Ahmed Khan", loginId: "ahmed", role: "sales", password: "sales123" },
    { id: "sales2", name: "Bilal Sheikh", loginId: "bilal", role: "sales", password: "sales123" },
    { id: "sales3", name: "Farhan Ali", loginId: "farhan", role: "sales", password: "sales123" },
];

const DEFAULT_PRODUCTS: Product[] = [
    { id: "prod1", name: "Mineral Water (1.5L Pack)", pricePerUnit: 120, totalStock: 1000, inStock: true },
    { id: "prod2", name: "Mineral Water (500ml Pack)", pricePerUnit: 80, totalStock: 1500, inStock: true },
    { id: "prod3", name: "Juice Box (1L)", pricePerUnit: 200, totalStock: 500, inStock: true },
    { id: "prod4", name: "Cold Drink (2L)", pricePerUnit: 150, totalStock: 800, inStock: true },
    { id: "prod5", name: "Energy Drink (250ml)", pricePerUnit: 180, totalStock: 1200, inStock: true },
    { id: "prod6", name: "Milk Pack (1L)", pricePerUnit: 220, totalStock: 600, inStock: true },
];

// ===== INITIALIZER =====
export function initializeStore(): void {
    if (typeof window === "undefined") return;

    // Ensure all default users exist (fixes missing accounts from old localStorage data)
    let users = safeGet<User[]>("tw_users", []);
    if (users.length === 0) {
        safeSet("tw_users", DEFAULT_USERS);
    } else {
        let updated = false;

        // Migrate old email-based users to loginId format
        users = users.map(u => {
            const uRecord = u as unknown as Record<string, unknown>;
            if (!u.loginId && typeof uRecord.email === "string") {
                updated = true;
                return { ...u, loginId: uRecord.email.split("@")[0] };
            }
            return u;
        });

        // Deduplicate by id and ensure defaults exist
        DEFAULT_USERS.forEach(defUser => {
            if (!users.find(u => u.id === defUser.id)) {
                users.push(defUser);
                updated = true;
            }
        });
        if (updated) safeSet("tw_users", users);
    }
    if (!localStorage.getItem("tw_products")) {
        safeSet("tw_products", DEFAULT_PRODUCTS);
    } else {
        // Migrate old products to have totalStock
        let products = safeGet<Product[]>("tw_products", []);
        let productsUpdated = false;
        products = products.map(p => {
            if (p.totalStock === undefined) {
                productsUpdated = true;
                return { ...p, totalStock: 0 };
            }
            return p;
        });
        if (productsUpdated) safeSet("tw_products", products);
    }
    if (!localStorage.getItem("tw_dispatches")) {
        safeSet("tw_dispatches", []);
    }
    if (!localStorage.getItem("tw_sales")) {
        safeSet("tw_sales", []);
    }
}

// ===== AUTH =====
export function login(loginId: string, password: string): User | null {
    const users = getUsers();
    const cleanLoginId = loginId.trim().toLowerCase();
    const cleanPassword = password.trim();
    const user = users.find((u) => u.loginId.toLowerCase() === cleanLoginId && u.password === cleanPassword);
    if (user) {
        safeSet("tw_current_user", user);
        return user;
    }
    return null;
}

export function logout(): void {
    if (typeof window !== "undefined") {
        localStorage.removeItem("tw_current_user");
    }
}

export function getCurrentUser(): User | null {
    return safeGet<User | null>("tw_current_user", null);
}

// ===== USERS =====
export function getUsers(): User[] {
    return safeGet<User[]>("tw_users", DEFAULT_USERS);
}

export function getSalesPersons(): User[] {
    return getUsers().filter((u) => u.role === "sales");
}

export function addSalesPerson(user: Omit<User, "id" | "role">): string {
    const users = getUsers();
    const newUser: User = {
        id: generateId(),
        role: "sales",
        ...user,
    };
    users.push(newUser);
    safeSet("tw_users", users);
    return newUser.id;
}

export function updateSalesPerson(id: string, updates: Partial<User>): User | null {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === id && u.role === "sales");
    if (index === -1) return null;

    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;
    safeSet("tw_users", users);

    // Update cascading refs for name changes
    if (updates.name && updates.name !== users[index].name) {
        const dispatches = getDispatches();
        let dispatchesChanged = false;
        dispatches.forEach((d) => {
            if (d.salesPersonId === id) {
                d.salesPersonName = updates.name as string;
                dispatchesChanged = true;
            }
        });
        if (dispatchesChanged) safeSet("tw_dispatches", dispatches);

        const sales = getSales();
        let salesChanged = false;
        sales.forEach((s) => {
            if (s.salesPersonId === id) {
                s.salesPersonName = updates.name as string;
                salesChanged = true;
            }
        });
        if (salesChanged) safeSet("tw_sales", sales);
    }

    return updatedUser;
}

export function deleteSalesPerson(id: string): User[] {
    const users = getUsers();
    const updatedUsers = users.filter((u) => u.id !== id);
    safeSet("tw_users", updatedUsers);

    // Filter out dispatches and sales?
    // Since we preserve history, we won't delete past sales or dispatches. 
    // Just remove them from active users so they can no longer login or be assigned.

    return updatedUsers.filter((u) => u.role === "sales");
}

export function addUser(user: Omit<User, "id">): User {
    const users = getUsers();
    const newUser: User = { ...user, id: generateId() };
    users.push(newUser);
    safeSet("tw_users", users);
    return newUser;
}

// ===== PRODUCTS =====
export function getProducts(): Product[] {
    return safeGet<Product[]>("tw_products", DEFAULT_PRODUCTS);
}

export function addProduct(product: Omit<Product, "id">): Product {
    const products = getProducts();
    const newProduct: Product = { ...product, id: generateId(), inStock: true };
    products.push(newProduct);
    safeSet("tw_products", products);
    return newProduct;
}

export function updateProduct(id: string, updates: Partial<Product>): Product | null {
    const products = getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const newId = updates.id || id;
    if (newId !== id && products.some((p) => p.id === newId)) {
        return null;
    }

    // Merge existing product with updates
    const updatedProduct = { ...products[index], ...updates, id: newId };
    products[index] = updatedProduct;
    safeSet("tw_products", products);

    // Update cascading refs
    if (newId !== id) {
        const dispatches = getDispatches();
        let dispatchesChanged = false;
        dispatches.forEach((d) => {
            if (d.productId === id) {
                d.productId = newId;
                dispatchesChanged = true;
            }
        });
        if (dispatchesChanged) safeSet("tw_dispatches", dispatches);

        const sales = getSales();
        let salesChanged = false;
        sales.forEach((s) => {
            if (s.productId === id) {
                s.productId = newId;
                salesChanged = true;
            }
        });
        if (salesChanged) safeSet("tw_sales", sales);
    }

    return updatedProduct;
}

// ===== DISPATCHES =====
export function getDispatches(): DispatchEntry[] {
    return safeGet<DispatchEntry[]>("tw_dispatches", []);
}

export function addDispatch(entry: Omit<DispatchEntry, "id" | "createdAt">): DispatchEntry {
    const dispatches = getDispatches();
    const products = getProducts();

    // Check stock and deduct
    const productIndex = products.findIndex(p => p.id === entry.productId);
    if (productIndex === -1) throw new Error("Product not found");
    if (products[productIndex].totalStock < entry.quantity) {
        throw new Error("Insufficient warehouse stock");
    }

    products[productIndex].totalStock -= entry.quantity;
    safeSet("tw_products", products);

    const newEntry: DispatchEntry = {
        ...entry,
        id: generateId(),
        createdAt: new Date().toISOString(),
    };
    dispatches.push(newEntry);
    safeSet("tw_dispatches", dispatches);
    return newEntry;
}

// ===== SALES =====
export function getSales(): SaleEntry[] {
    return safeGet<SaleEntry[]>("tw_sales", []);
}

export function addSale(entry: Omit<SaleEntry, "id" | "createdAt">): SaleEntry {
    const sales = getSales();
    const newEntry: SaleEntry = {
        ...entry,
        id: generateId(),
        createdAt: new Date().toISOString(),
    };
    sales.push(newEntry);
    safeSet("tw_sales", sales);
    return newEntry;
}

// ===== CALCULATIONS =====
export function getTodayString(): string {
    return new Date().toISOString().split("T")[0];
}

export function getStockSummary(salesPersonId?: string, date?: string) {
    const dispatches = getDispatches();
    const sales = getSales();

    const filteredDispatches = dispatches.filter((d) => {
        if (salesPersonId && d.salesPersonId !== salesPersonId) return false;
        if (date && d.date !== date) return false;
        return true;
    });

    const filteredSales = sales.filter((s) => {
        if (salesPersonId && s.salesPersonId !== salesPersonId) return false;
        if (date && s.date !== date) return false;
        return true;
    });

    const totalDispatched = filteredDispatches.reduce((sum, d) => sum + d.quantity, 0);
    const totalSold = filteredSales.reduce((sum, s) => sum + s.quantitySold, 0);
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.quantitySold * s.pricePerUnit, 0);
    const remainingStock = totalDispatched - totalSold;

    return { totalDispatched, totalSold, remainingStock, totalRevenue };
}

export function getSalesPersonStockStatus() {
    const salesPersons = getSalesPersons();
    const dispatches = getDispatches();
    const sales = getSales();

    return salesPersons.map((sp) => {
        const spDispatches = dispatches.filter((d) => d.salesPersonId === sp.id);
        const spSales = sales.filter((s) => s.salesPersonId === sp.id);

        const totalDispatched = spDispatches.reduce((sum, d) => sum + d.quantity, 0);
        const totalSold = spSales.reduce((sum, s) => sum + s.quantitySold, 0);
        const totalRevenue = spSales.reduce((sum, s) => sum + s.quantitySold * s.pricePerUnit, 0);
        const remainingStock = totalDispatched - totalSold;

        return {
            ...sp,
            totalDispatched,
            totalSold,
            remainingStock,
            totalRevenue,
        };
    });
}

export function getProductStockForSalesPerson(salesPersonId: string) {
    const dispatches = getDispatches().filter((d) => d.salesPersonId === salesPersonId);
    const sales = getSales().filter((s) => s.salesPersonId === salesPersonId);
    const products = getProducts();

    const stockMap: Record<string, { product: Product; dispatched: number; sold: number; remaining: number; pricePerUnit: number }> = {};

    dispatches.forEach((d) => {
        if (!stockMap[d.productId]) {
            const prod = products.find((p) => p.id === d.productId);
            stockMap[d.productId] = {
                product: prod || { id: d.productId, name: d.productName, pricePerUnit: d.pricePerUnit, totalStock: 0 },
                dispatched: 0,
                sold: 0,
                remaining: 0,
                pricePerUnit: d.pricePerUnit,
            };
        }
        stockMap[d.productId].dispatched += d.quantity;
    });

    sales.forEach((s) => {
        if (!stockMap[s.productId]) {
            const prod = products.find((p) => p.id === s.productId);
            stockMap[s.productId] = {
                product: prod || { id: s.productId, name: s.productName, pricePerUnit: s.pricePerUnit, totalStock: 0 },
                dispatched: 0,
                sold: 0,
                remaining: 0,
                pricePerUnit: s.pricePerUnit,
            };
        }
        stockMap[s.productId].sold += s.quantitySold;
    });

    Object.values(stockMap).forEach((item) => {
        item.remaining = item.dispatched - item.sold;
    });

    return Object.values(stockMap);
}

// ===== DRIVER LOCATIONS =====
export function getDriverLocations(): DriverLocation[] {
    return safeGet<DriverLocation[]>("tw_driver_locations", []);
}

export function getDriverLocation(userId: string): DriverLocation | null {
    const locations = getDriverLocations();
    return locations.find((l) => l.userId === userId) || null;
}

export function updateDriverLocation(location: Omit<DriverLocation, "lastUpdated">): DriverLocation {
    const locations = getDriverLocations();
    const updatedLocation: DriverLocation = {
        ...location,
        lastUpdated: new Date().toISOString(),
    };

    const existingIndex = locations.findIndex((l) => l.userId === location.userId);
    if (existingIndex >= 0) {
        locations[existingIndex] = updatedLocation;
    } else {
        locations.push(updatedLocation);
    }

    safeSet("tw_driver_locations", locations);
    return updatedLocation;
}
