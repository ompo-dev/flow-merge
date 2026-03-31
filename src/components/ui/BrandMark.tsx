import { Network } from "lucide-react";

interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
}

export function BrandMark({
  className = "",
  iconClassName = "",
}: BrandMarkProps) {
  const rootClassName = [
    "flex items-center justify-center rounded-2xl border border-[#2f6f3e] bg-[#238636] shadow-[0_18px_44px_rgba(35,134,54,0.22)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const glyphClassName = ["text-white", iconClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} aria-hidden="true">
      <Network className={glyphClassName} strokeWidth={2.15} />
    </div>
  );
}
