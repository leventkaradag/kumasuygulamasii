"use client";

import type { ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { cn } from "../lib/cn";

type ImagePickerProps = {
  label?: string;
  accept?: string;
  onSelect?: (file?: File) => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

export function ImagePicker({
  label = "Foto Sec",
  accept = "image/*",
  onSelect,
  className,
  buttonClassName,
  disabled = false,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onSelect?.(file);
    event.target.value = "";
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coffee-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
          buttonClassName
        )}
      >
        <Upload className="h-4 w-4 text-coffee-primary" aria-hidden />
        <span>{label}</span>
      </button>
    </div>
  );
}
