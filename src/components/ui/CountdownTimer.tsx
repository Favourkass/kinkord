"use client";

import { useEffect, useState } from "react";
import { LAUNCH_DATE } from "@/lib/constants";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface Props {
  size?: "sm" | "lg";
}

export default function CountdownTimer({ size = "lg" }: Props) {
  const [time, setTime] = useState<TimeLeft>(getTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Mins", value: time.minutes },
    { label: "Secs", value: time.seconds },
  ];

  const numClass =
    size === "lg"
      ? "text-3xl md:text-4xl font-bold text-[#d4af37] font-[var(--font-playfair)]"
      : "text-xl font-bold text-[#d4af37] font-[var(--font-playfair)]";

  const labelClass =
    size === "lg"
      ? "text-[10px] uppercase tracking-widest text-[#999] mt-1"
      : "text-[9px] uppercase tracking-widest text-[#999] mt-0.5";

  const blockClass =
    size === "lg" ? "min-w-[64px] px-4" : "min-w-[48px] px-2";

  return (
    <div className="flex items-center gap-1">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center">
          <div className={`flex flex-col items-center ${blockClass}`}>
            <span className={numClass}>{String(u.value).padStart(2, "0")}</span>
            <span className={labelClass}>{u.label}</span>
          </div>
          {i < 3 && (
            <span className="text-[#d4af37] text-xl font-bold mb-4 opacity-60">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
