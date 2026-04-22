"use client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ear_labs_token");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ear_labs_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem("ear_labs_token");
  localStorage.removeItem("ear_labs_user");
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Wrap fetch calls with the auth token
export async function authFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
}
