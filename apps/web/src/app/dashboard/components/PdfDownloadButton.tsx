"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadPdf } from "@/lib/api";

type Props = {
  path: string;
  filename: string;
};

export default function PdfDownloadButton({ path, filename }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      await downloadPdf(path, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF gagal diunduh.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={handleDownload}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5CD] bg-white hover:bg-[#EAF0EC] text-[#294D3F] font-bold text-[11px] transition-colors disabled:opacity-50"
      >
        <Download size={13} />
        {loading ? "Menyiapkan PDF..." : "Unduh PDF"}
      </button>
      {error && <span role="alert" className="max-w-56 text-[10px] text-red-700">{error}</span>}
    </div>
  );
}
