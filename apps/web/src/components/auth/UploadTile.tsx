"use client";

import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";

interface Props {
  shape: "circle" | "banner";
  label: string;
  required?: boolean;
  maxMb: number;
  previewUrl: string | null;
  onFile: (f: File) => void;
  uploading?: boolean;
  error?: string;
}

/** "Tap to upload" tiles from Build Your Profile: round avatar / wide cover. */
export default function UploadTile({
  shape,
  label,
  required,
  maxMb,
  previewUrl,
  onFile,
  uploading,
  error,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const Icon = shape === "circle" ? Camera : ImagePlus;
  const frame = shape === "circle" ? "mx-auto h-44 w-44 rounded-full" : "h-40 w-full rounded-2xl";

  return (
    <div className="w-full">
      <p className="mb-3 text-[16px] font-semibold text-kink-cream">
        {label}{" "}
        {required && <span className="text-[12px] font-normal text-kink-faint">(required)</span>}
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className={`relative flex items-center justify-center overflow-hidden border-2 border-dashed transition hover:border-kink-gold ${
          error ? "border-red-500/70" : "border-kink-amber/70"
        } bg-kink-surface ${frame}`}
        style={{ boxShadow: "0 0 24px rgba(255,176,20,0.12)" }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- S3-presigned preview, remote domain varies
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-4 text-center">
            <Icon size={22} className="text-kink-gold" />
            <span className="text-[15px] font-semibold text-kink-cream">
              {uploading ? "Uploading…" : "Tap to upload"}
            </span>
            <span className="text-[11px] text-kink-faint">JPG, PNG or WEBP · Max {maxMb}MB</span>
          </span>
        )}
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />
      </button>
      {error && <p className="mt-1.5 text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
