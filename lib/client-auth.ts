"use client";

export type UserRole = "student" | "staff" | "admin";

export interface StoredAuth {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    department?: { _id?: string; name?: string } | null;
  };
}

const STORAGE_KEY = "scit_auth";

export function saveAuth(auth: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch (err) {
    console.error("Failed to parse auth", err);
    return null;
  }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getRedirectPath(role: UserRole) {
  if (role === "student") return "/student/dashboard";
  if (role === "staff") return "/staff/dashboard";
  return "/admin/dashboard";
}

export async function authFetch(url: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  const res = await fetch(url, { ...options, headers });
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