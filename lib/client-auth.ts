"use client";

export type UserRole = "student" | "faculty" | "staff" | "admin";

export interface StoredAuth {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isDemoUser?: boolean;
    department?: { _id?: string; name?: string } | null;
    academicDepartment?: { _id?: string; name?: string } | null;
    serviceDepartment?: { _id?: string; name?: string } | null;
    studentId?: string | null;
    institute?: string | null;
    course?: string | null;
    mobileNumber?: string | null;
  };
}

const STORAGE_KEY = "scit_auth";
type AuthStorage = "local" | "session";

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };

    if (typeof payload.exp !== "number") return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function sanitizeAuth(auth: StoredAuth | null, storage: AuthStorage): StoredAuth | null {
  if (!auth) return null;

  if (!auth.token || isTokenExpired(auth.token)) {
    if (storage === "session") {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }

  return auth;
}

export function saveAuth(auth: StoredAuth, storage: AuthStorage = "session") {
  const target = storage === "session" ? sessionStorage : localStorage;
  target.setItem(STORAGE_KEY, JSON.stringify(auth));

  // Keep auth ephemeral across browser restarts.
  if (storage === "session") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function loadAuth(storage: AuthStorage | "auto" = "auto"): StoredAuth | null {
  if (typeof window === "undefined") return null;

  const parse = (raw: string | null) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredAuth;
    } catch (err) {
      console.error("Failed to parse auth", err);
      return null;
    }
  };

  if (storage === "local") {
    return sanitizeAuth(parse(localStorage.getItem(STORAGE_KEY)), "local");
  }

  if (storage === "session") {
    return sanitizeAuth(parse(sessionStorage.getItem(STORAGE_KEY)), "session");
  }

  const sessionAuth = sanitizeAuth(parse(sessionStorage.getItem(STORAGE_KEY)), "session");
  if (sessionAuth) return sessionAuth;

  // Remove old persistent auth from previous versions and force a fresh login.
  if (localStorage.getItem(STORAGE_KEY)) {
    localStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem("isAdmin");
}

export function getRedirectPath(role: UserRole) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "staff") return "/staff/dashboard";
  return "/student/dashboard";
}

export async function authFetch(url: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!isFormData) {
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  }

  headers.set("Cache-Control", headers.get("Cache-Control") || "no-cache, no-store, must-revalidate");
  headers.set("Pragma", headers.get("Pragma") || "no-cache");
  headers.set("Expires", headers.get("Expires") || "0");

  const res = await fetch(url, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (token && res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) return res.json();
  return res.text();
}