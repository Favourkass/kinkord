"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface GoldButtonProps {
  children: ReactNode;
  variant?: "solid" | "outline";
  href?: string;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function GoldButton({
  children,
  variant = "solid",
  href,
  onClick,
  className = "",
  size = "md",
}: GoldButtonProps) {
  const sizes = {
    sm: "px-5 py-2 text-xs tracking-widest",
    md: "px-8 py-3.5 text-sm tracking-widest",
    lg: "px-10 py-4 text-base tracking-widest",
  };

  const base =
    "inline-flex items-center justify-center font-semibold uppercase rounded-none transition-all duration-300 cursor-pointer select-none";

  const variants = {
    solid:
      "bg-[#d4af37] text-[#0a0a0a] hover:bg-[#f5e27d] active:scale-95",
    outline:
      "border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0a0a0a] active:scale-95",
  };

  const classes = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  const content = (
    <motion.span
      whileHover={{ letterSpacing: "0.15em" }}
      transition={{ duration: 0.2 }}
      className="inline-block"
    >
      {children}
    </motion.span>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        className={classes}
        whileTap={{ scale: 0.96 }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className={classes}
      whileTap={{ scale: 0.96 }}
    >
      {content}
    </motion.button>
  );
}
