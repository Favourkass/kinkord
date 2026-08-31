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
  const frame =
    shape === "circle"
      ? "mx-auto h-44 w-44 rounded-full lg:h-[220px] lg:w-[220px]"
      : "h-40 w-full rounded-[12px] lg:h-[210px]";

  return (
    <div className="w-full">
      <p className="mb-3 text-[15px] font-semibold text-white lg:text-[20px]">
        {label}{" "}
        {required && (
          <span className="text-[12px] font-normal text-kink-gold-bright lg:text-[16px]">
            (required)
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className={`relative flex items-center justify-center overflow-hidden border-[1.5px] border-dashed transition hover:border-kink-gold-bright ${
          error ? "border-red-500/70" : "border-[rgba(200,146,42,0.6)]"
        } bg-[#181818] ${frame}`}
        style={{ boxShadow: "0 0 32px rgba(255,186,31,0.14)" }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- S3-presigned preview, remote domain varies
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-4 text-center">
            <span className="flex items-start">
              <Icon size={26} className="text-kink-gold-bright" />
              <span className="-mt-1 text-[16px] font-light leading-none text-kink-gold-bright">
                +
              </span>
            </span>
            <span className="text-[14px] font-semibold text-white lg:text-[16px]">
              {uploading ? "Uploading…" : "Tap to upload"}
            </span>
            <span className="text-[11px] text-kink-help lg:text-[13px]">
              JPG, PNG or WEBP · Max {maxMb}MB
            </span>
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
      {error && <p className="mt-1.5 text-[11px] text-red-400 lg:text-[14px]">{error}</p>}
    </div>
  );
}
