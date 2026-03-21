/**
 * VipBadge component
 * Reusable VIP badge indicator with consistent styling
 */

interface VipBadgeProps {
  className?: string;
}

export function VipBadge({ className = "" }: VipBadgeProps) {
  return (
    <span
      className={className}
      style={{
        fontSize: 12,
        color: "#ffd700",
        fontWeight: 700,
        background: "linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.1) 100%)",
        padding: "3px 8px",
        borderRadius: 8,
        border: "1px solid rgba(255,215,0,0.3)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        boxShadow: "0 2px 4px rgba(255,215,0,0.1)",
      }}
    >
      <span style={{ fontSize: 14 }}>👑</span>
      VIP
    </span>
  );
}
