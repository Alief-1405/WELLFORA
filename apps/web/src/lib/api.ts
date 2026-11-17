const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Terjadi kesalahan saat memproses permintaan.");
  }
  return payload as T;
}

export async function downloadPdf(path: string, filename: string): Promise<void> {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const response = await fetch(url, { credentials: "include" });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "PDF gagal diunduh.");
  }

  if (!response.headers.get("content-type")?.includes("application/pdf")) {
    throw new Error("Server tidak mengembalikan dokumen PDF.");
  }

  const objectUrl = window.URL.createObjectURL(await response.blob());
  const link = window.document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}
