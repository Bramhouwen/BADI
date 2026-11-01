import Image from "next/image";
import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "h-7 w-7 text-[11px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
} as const;

const px = { xs: 28, sm: 36, md: 48, lg: 64, xl: 96 } as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
  ring,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  ring?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-card-2 font-semibold text-ice flex items-center justify-center",
        ring && "ring-2 ring-ice/70 ring-offset-2 ring-offset-bg",
        sizes[size],
        className,
      )}
      aria-label={name}
    >
      {src ? (
        <Image src={src} alt={name} width={px[size]} height={px[size]} className="h-full w-full object-cover" unoptimized />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </div>
  );
}
