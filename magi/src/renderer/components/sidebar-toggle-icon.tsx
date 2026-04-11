import { memo } from "react";

interface SidebarToggleIconProps {
  size?: number;
  className?: string;
  variant?: "open" | "closed";
}

function SidebarToggleIconImpl({
  size = 15,
  className,
  variant = "open",
}: SidebarToggleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      {variant === "open" ? (
        <rect
          x="6.2"
          y="7"
          width="4.2"
          height="10"
          rx="1.6"
          fill="currentColor"
          stroke="none"
        />
      ) : (
        <line x1="8" y1="7" x2="8" y2="17" />
      )}
    </svg>
  );
}

export const SidebarToggleIcon = memo(SidebarToggleIconImpl);
