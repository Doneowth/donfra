"use client";

type User = {
  id: number;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type UserCardProps = {
  user: User;
  isUpdating: boolean;
  onRoleChange: (userId: number, currentRole: string, newRole: string) => void;
  onStatusChange: (userId: number, currentStatus: boolean, newStatus: string, username: string) => void;
};

export default function UserCard({ user, isUpdating, onRoleChange, onStatusChange }: UserCardProps) {
  return (
    <div
      className="user-card"
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "8px",
        padding: "16px 20px",
        backgroundColor: user.isActive ? "rgba(255,255,255,0.02)" : "rgba(255,0,0,0.05)",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: "16px",
        alignItems: "center",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = user.isActive ? "rgba(255,255,255,0.05)" : "rgba(255,0,0,0.08)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = user.isActive ? "rgba(255,255,255,0.02)" : "rgba(255,0,0,0.05)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
      }}
    >
      {/* User ID Badge */}
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          backgroundColor: "rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "600",
          fontSize: "14px",
        }}
      >
        #{user.id}
      </div>

      {/* User Info */}
      <div>
        <div style={{ marginBottom: "4px" }}>
          <span style={{ fontWeight: "600", fontSize: "15px" }}>{user.username}</span>
          <span className="mono" style={{ marginLeft: "12px", fontSize: "13px", color: "#999" }}>
            {user.email}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Role Selector */}
        <div style={{ position: "relative" }}>
          <select
            value={user.role}
            onChange={(e) => onRoleChange(user.id, user.role, e.target.value)}
            disabled={isUpdating}
            style={{
              padding: "6px 28px 6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.2)",
              backgroundColor: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "500",
              cursor: isUpdating ? "not-allowed" : "pointer",
              appearance: "none",
            }}
          >
            <option value="user">User</option>
            <option value="vip">VIP</option>
            <option value="admin">Admin</option>
            <option value="god">God</option>
          </select>
          <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            ▼
          </span>
        </div>

        {/* Status Selector */}
        <div style={{ position: "relative" }}>
          <select
            value={String(user.isActive)}
            onChange={(e) => onStatusChange(user.id, user.isActive, e.target.value, user.username)}
            disabled={isUpdating}
            style={{
              padding: "6px 28px 6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.2)",
              backgroundColor: user.isActive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "500",
              cursor: isUpdating ? "not-allowed" : "pointer",
              appearance: "none",
            }}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            ▼
          </span>
        </div>
      </div>
    </div>
  );
}
