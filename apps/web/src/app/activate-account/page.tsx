"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";

function subscribeToHashChange(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getActivationToken() {
  return window.location.hash.slice(1);
}

function getServerActivationToken() {
  return "";
}

export default function ActivateAccountPage() {
  const token = useSyncExternalStore(subscribeToHashChange, getActivationToken, getServerActivationToken);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirmation) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>("/auth/activate", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      setSuccess(true);
      setPassword("");
      setPasswordConfirmation("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivasi akun gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FBF9F5] p-4 text-[#20342F]">
      <section className="w-full max-w-md rounded-3xl border border-[#E8ECE6] bg-white p-6 sm:p-8 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#71857B]">WELLFORA</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#1E392F]">Aktivasi Akun Karyawan</h1>
        <p className="mt-2 text-sm text-[#5D7369]">
          Buat password pribadi untuk menyelesaikan aktivasi akun. HRD tidak dapat melihat password ini.
        </p>

        {success ? null : !token ? (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Tautan aktivasi tidak ditemukan. Minta HRD membuat tautan baru.
          </div>
        ) : error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {success ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Akun berhasil diaktifkan. Password Anda hanya diketahui oleh Anda.
            </p>
            <Link
              href="/login"
              className="block rounded-xl bg-[#294D3F] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#1E392F]"
            >
              Masuk ke Wellfora
            </Link>
          </div>
        ) : !token ? null : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="activation-password" className="mb-1 block text-xs font-bold text-[#294D3F]">
                Password baru (minimal 12 karakter)
              </label>
              <input
                id="activation-password"
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#CBD5CD] px-3 py-2.5 text-sm focus:border-[#294D3F] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="activation-password-confirmation" className="mb-1 block text-xs font-bold text-[#294D3F]">
                Konfirmasi password
              </label>
              <input
                id="activation-password-confirmation"
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                className="w-full rounded-xl border border-[#CBD5CD] px-3 py-2.5 text-sm focus:border-[#294D3F] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-xl bg-[#294D3F] px-4 py-3 text-sm font-bold text-white hover:bg-[#1E392F] disabled:opacity-50"
            >
              {loading ? "Mengaktifkan..." : "Aktifkan akun"}
            </button>
            <p className="text-center text-[11px] text-[#71857B]">
              Tautan berlaku 24 jam dan hanya dapat digunakan sekali.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
