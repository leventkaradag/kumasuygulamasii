import type { ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { cn } from "../lib/cn";

type ImagePickerProps = {
  label?: string;
  accept?: string;
  onSelect?: (file?: File) => void;
  className?: string;
};

export function ImagePicker({
  label = "Foto Seç",
  accept = "image/*",
  onSelect,
  className,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onSelect?.(file);
    // Allow re-selecting the same file
    event.target.value = "";
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coffee-primary"
      >
        <Upload className="h-4 w-4 text-coffee-primary" aria-hidden />
        <span>{label}</span>
      </button>
    </div>
  );
}
