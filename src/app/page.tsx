"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializeStore, login, getCurrentUser } from "@/lib/store";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    initializeStore();
    const user = getCurrentUser();
    if (user) {
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/sales/dashboard");
    }
    setMounted(true);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 500));

    const user = login(loginId, password);
    if (user) {
      router.push(user.role === "admin" ? "/admin/dashboard" : "/sales/dashboard");
    } else {
      setError("Invalid Login ID or password");
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="login-page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Animated Background Orbs */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-grid" />
      </div>

      <div className="login-container">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo-wrap">
            <div className="login-logo-glow" />
            <div className="login-logo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.29 7 12 12 20.71 7" />
                <line x1="12" y1="22" x2="12" y2="12" />
              </svg>
            </div>
          </div>
          <h1 className="login-title">Total Wholesall</h1>
          <p className="login-subtitle">Distribution Intelligence</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-card-highlight" />
          <div className="login-card-inner">
            <h2 className="login-heading">Welcome Back</h2>

            {error && (
              <div className="login-error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="login-form">
              {/* Login ID Field */}
              <div className="login-field">
                <label className="login-label">Login ID</label>
                <div className="login-input-wrap">
                  <div className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. admin"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="login-input-wrap">
                  <div className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    style={{ paddingRight: "3rem" }}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn"
              >
                {loading ? (
                  <span className="login-btn-content">
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  <span className="login-btn-content">
                    Sign In to Dashboard
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="login-footer">
          &copy; 2026 Total Wholesall. Secure local system.
        </p>
      </div>
    </div>
  );
}
