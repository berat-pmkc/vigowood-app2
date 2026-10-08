import { hatRengi } from "@/lib/talimat/hat-renk";
import { cn } from "@/lib/utils";

/** Hat rengini gösteren küçük renkli nokta (tablet ile aynı renk) */
export function HatNokta({
  hat,
  className,
}: {
  hat: { sira: number } | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{ backgroundColor: hatRengi(hat) }}
    />
  );
}
