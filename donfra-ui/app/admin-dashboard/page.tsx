"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type InterviewRoom = {
  id: number;
  room_id: string;
  owner_id: number;
  headcount: number;
  code_snapshot: string;
  invite_link: string;
  created_at: string;
  updated_at: string;
};

type User = {
  id: number;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

type Tab = "rooms" | "users";

type Toast = {
  message: string;
  type: "success" | "error" | "info";
};

type ConfirmDialog = {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("rooms");

  // Rooms state
  const [rooms, setRooms] = useState<InterviewRoom[]>([]);
  const [closingRoomId, setClosingRoomId] = useState<string | null>(null);
  const [lastCheckedRooms, setLastCheckedRooms] = useState<Date | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [lastCheckedUsers, setLastCheckedUsers] = useState<Date | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  // UI state
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Check if user is god user via user authentication (admin-dashboard is god-only)
  const isGodUser = user?.role === "god";

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    setToast({ message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ show: true, title, message, onConfirm });
  };

  const hideConfirm = () => {
    setConfirmDialog({ show: false, title: "", message: "", onConfirm: () => {} });
  };

  const refreshRooms = useCallback(async () => {
    try {
      setError("");
      const res = await api.interview.getAllRooms();
      setRooms(res.rooms);
      setLastCheckedRooms(new Date());
    } catch (err: any) {
      setError(err?.message || "Unable to load rooms.");
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      setError("");
      const res = await api.admin.users.list();
      setUsers(res.users);
      setLastCheckedUsers(new Date());
    } catch (err: any) {
      setError(err?.message || "Unable to load users.");
    }
  }, []);

  useEffect(() => {
    if (isGodUser) {
      if (activeTab === "rooms") {
        refreshRooms();
      } else {
        refreshUsers();
      }
    }
  }, [isGodUser, activeTab, refreshRooms, refreshUsers]);


  const closeRoom = async (roomId: string) => {
    try {
      setClosingRoomId(roomId);
      setError("");
      await api.interview.close(roomId);
      await refreshRooms();
      showToast("Room closed successfully", "success");
    } catch (err: any) {
      const msg = err?.message || "Unable to close room.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setClosingRoomId(null);
    }
  };

  const handleCloseRoom = (roomId: string) => {
    showConfirm(
      "Close Room",
      "Are you sure you want to close this interview room? This action cannot be undone.",
      () => {
        hideConfirm();
        closeRoom(roomId);
      }
    );
  };

  const updateUserRole = async (userId: number, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      setError("");
      await api.admin.users.updateRole(userId, newRole);
      await refreshUsers();
      showToast(`User role updated to ${newRole}`, "success");
    } catch (err: any) {
      const msg = err?.message || "Unable to update user role.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateUserRole = (userId: number, currentRole: string, newRole: string) => {
    if (currentRole === newRole) return;

    showConfirm(
      "Update User Role",
      `Are you sure you want to change this user's role from "${currentRole}" to "${newRole}"?`,
      () => {
        hideConfirm();
        updateUserRole(userId, newRole);
      }
    );
  };

  const toggleUserActive = async (userId: number, currentStatus: boolean) => {
    try {
      setUpdatingUserId(userId);
      setError("");
      await api.admin.users.updateActiveStatus(userId, !currentStatus);
      await refreshUsers();
      showToast(`User ${!currentStatus ? "activated" : "deactivated"} successfully`, "success");
    } catch (err: any) {
      const msg = err?.message || "Unable to update user status.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateUserStatus = (userId: number, currentStatus: boolean, newStatus: string, username: string) => {
    const newStatusBool = newStatus === "true";
    if (currentStatus === newStatusBool) return;

    const action = newStatusBool ? "activate" : "deactivate";
    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      `Are you sure you want to ${action} user "${username}"?`,
      () => {
        hideConfirm();
        toggleUserActive(userId, currentStatus);
      }
    );
  };


  const copyInviteLink = async (inviteLink: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast("Invite link copied to clipboard", "info");
    } catch (err) {
      console.error("Failed to copy invite link:", err);
      showToast("Failed to copy invite link", "error");
    }
  };


  if (authLoading) {
    return (
      <main className="admin-shell">
        <video className="admin-hero-video" autoPlay loop muted playsInline>
          <source src="/triumph.mp4" type="video/mp4" />
        </video>
        <div className="admin-vignette" />
        <div className="admin-bg-grid" />
        <div className="admin-wrapper">
          <div className="admin-headline">
            <p className="eyebrow">Admin Mission Control</p>
            <h1>Loading...</h1>
          </div>
        </div>
      </main>
    );
  }

  // Only god users can access admin-dashboard
  if (!isGodUser) {
    return (
      <main className="admin-shell">
        <video className="admin-hero-video" autoPlay loop muted playsInline>
          <source src="/triumph.mp4" type="video/mp4" />
        </video>
        <div className="admin-vignette" />
        <div className="admin-bg-grid" />
        <div className="admin-wrapper">
          <div className="admin-headline">
            <p className="eyebrow">Admin Mission Control</p>
            <h1>Access Denied</h1>
            <p className="lede">This dashboard is only accessible to God users.</p>
          </div>
          <div className="admin-grid">
            <section className="admin-card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Permission Required</p>
                  <h2>God User Access Only</h2>
                </div>
                <span className="pill">Restricted</span>
              </div>
              <div style={{ padding: "24px", textAlign: "center", color: "#999" }}>
                <p style={{ fontSize: "16px", marginBottom: "12px" }}>
                  You need God user privileges to access this dashboard.
                </p>
                <p style={{ fontSize: "14px", marginBottom: "20px" }}>
                  Please contact your system administrator.
                </p>
                <a href="/" className="btn-neutral">
                  Return Home
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <video className="admin-hero-video" autoPlay loop muted playsInline>
        <source src="/triumph.mp4" type="video/mp4" />
      </video>
      <div className="admin-vignette" />
      <div className="admin-bg-grid" />
      <div className="admin-wrapper">
        <div className="admin-headline">
          <p className="eyebrow">Admin Mission Control</p>
          <h1>Dashboard</h1>
          <p className="lede">Manage interview rooms and user accounts.</p>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              padding: "12px 24px",
              borderRadius: "8px",
              backgroundColor: toast.type === "success" ? "#10b981" : toast.type === "error" ? "#ef4444" : "#3b82f6",
              color: "white",
              fontWeight: "500",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
              zIndex: 1000,
              animation: "slideIn 0.3s ease-out",
            }}
          >
            {toast.message}
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog.show && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={hideConfirm}
          >
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "400px",
                width: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600" }}>
                {confirmDialog.title}
              </h3>
              <p style={{ margin: "0 0 24px 0", color: "#999", fontSize: "14px" }}>
                {confirmDialog.message}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button className="btn-neutral" onClick={hideConfirm}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={confirmDialog.onConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", alignItems: "center" }}>
          <button
            className={activeTab === "rooms" ? "btn-strong" : "btn-neutral"}
            onClick={() => setActiveTab("rooms")}
            style={{ padding: "8px 16px" }}
          >
            Interview Rooms ({rooms.length})
          </button>
          <button
            className={activeTab === "users" ? "btn-strong" : "btn-neutral"}
            onClick={() => setActiveTab("users")}
            style={{ padding: "8px 16px" }}
          >
            User Management ({users.length})
          </button>
          <span className="pill pill-ok" style={{ marginLeft: "auto" }}>
            God User: {user?.username || user?.email}
          </span>
        </div>

        <div className="admin-grid">
          {/* Interview Rooms Tab */}
          {activeTab === "rooms" && (
            <section className="admin-card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Active Sessions</p>
                  <h2>Interview Rooms</h2>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span className="pill pill-ok">{rooms.length} Active</span>
                  <button className="btn-neutral" type="button" onClick={refreshRooms}>
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {error && <div className="alert">{error}</div>}

              {rooms.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#666" }}>
                  <p style={{ fontSize: "16px", marginBottom: "8px" }}>No active interview rooms</p>
                  <p style={{ fontSize: "14px" }}>Rooms will appear here when users create them</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "16px" }}>
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        padding: "20px",
                        backgroundColor: "rgba(255,255,255,0.02)",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                      }}
                    >
                      {/* Room Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                        <div>
                          <p className="label" style={{ marginBottom: "4px", fontSize: "12px" }}>Room ID</p>
                          <p className="mono" style={{ fontSize: "16px", fontWeight: "600" }}>{room.room_id}</p>
                        </div>
                        <button
                          className="btn-danger"
                          onClick={() => handleCloseRoom(room.room_id)}
                          disabled={closingRoomId === room.room_id}
                          style={{ padding: "8px 16px", fontSize: "14px" }}
                        >
                          {closingRoomId === room.room_id ? "Closing…" : "✕ Close Room"}
                        </button>
                      </div>

                      {/* Room Stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                        <div>
                          <p className="label" style={{ fontSize: "12px" }}>Owner ID</p>
                          <p className="metric" style={{ fontSize: "18px" }}>{room.owner_id}</p>
                        </div>
                        <div>
                          <p className="label" style={{ fontSize: "12px" }}>Participants</p>
                          <p className="metric" style={{ fontSize: "18px" }}>{room.headcount}</p>
                        </div>
                        <div>
                          <p className="label" style={{ fontSize: "12px" }}>Created</p>
                          <p className="mono" style={{ fontSize: "13px" }}>
                            {new Date(room.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="label" style={{ fontSize: "12px" }}>Last Updated</p>
                          <p className="mono" style={{ fontSize: "13px" }}>
                            {new Date(room.updated_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Invite Link */}
                      <div>
                        <p className="label" style={{ marginBottom: "6px", fontSize: "12px" }}>Invite Link</p>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            type="text"
                            value={room.invite_link}
                            readOnly
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              fontSize: "13px",
                              fontFamily: "monospace",
                              backgroundColor: "rgba(0,0,0,0.3)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "4px",
                              color: "#fff",
                            }}
                          />
                          <button
                            className="btn-neutral"
                            onClick={() => copyInviteLink(room.invite_link)}
                            style={{ padding: "8px 16px", fontSize: "13px", flexShrink: 0 }}
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="footnote" style={{ marginTop: "16px" }}>
                Last refreshed: {lastCheckedRooms ? lastCheckedRooms.toLocaleTimeString() : "—"}
              </p>
            </section>
          )}

          {/* User Management Tab */}
          {activeTab === "users" && (
            <section className="admin-card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">User Accounts</p>
                  <h2>User Management</h2>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span className="pill pill-ok">{users.length} Users</span>
                  <button className="btn-neutral" type="button" onClick={refreshUsers}>
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {error && <div className="alert">{error}</div>}

              {!users || users.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#666" }}>
                  <p style={{ fontSize: "16px", marginBottom: "8px" }}>No users found</p>
                  <p style={{ fontSize: "14px" }}>Users will appear here when they register</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {users.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        padding: "16px 20px",
                        backgroundColor: u.is_active ? "rgba(255,255,255,0.02)" : "rgba(255,0,0,0.05)",
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: "16px",
                        alignItems: "center",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = u.is_active ? "rgba(255,255,255,0.05)" : "rgba(255,0,0,0.08)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = u.is_active ? "rgba(255,255,255,0.02)" : "rgba(255,0,0,0.05)";
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
                        #{u.id}
                      </div>

                      {/* User Info */}
                      <div>
                        <div style={{ marginBottom: "4px" }}>
                          <span style={{ fontWeight: "600", fontSize: "15px" }}>{u.username}</span>
                          <span className="mono" style={{ marginLeft: "12px", fontSize: "13px", color: "#999" }}>
                            {u.email}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        {/* Role Selector */}
                        <div style={{ position: "relative" }}>
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.id, u.role, e.target.value)}
                            disabled={updatingUserId === u.id}
                            style={{
                              padding: "6px 28px 6px 12px",
                              borderRadius: "6px",
                              border: "1px solid rgba(255,255,255,0.2)",
                              backgroundColor: "rgba(0,0,0,0.3)",
                              color: "#fff",
                              fontSize: "13px",
                              fontWeight: "500",
                              cursor: updatingUserId === u.id ? "not-allowed" : "pointer",
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
                            value={String(u.is_active ?? true)}
                            onChange={(e) => handleUpdateUserStatus(u.id, u.is_active ?? true, e.target.value, u.username)}
                            disabled={updatingUserId === u.id}
                            style={{
                              padding: "6px 28px 6px 12px",
                              borderRadius: "6px",
                              border: "1px solid rgba(255,255,255,0.2)",
                              backgroundColor: u.is_active ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                              color: "#fff",
                              fontSize: "13px",
                              fontWeight: "500",
                              cursor: updatingUserId === u.id ? "not-allowed" : "pointer",
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
                  ))}
                </div>
              )}

              <p className="footnote" style={{ marginTop: "16px" }}>
                Last refreshed: {lastCheckedUsers ? lastCheckedUsers.toLocaleTimeString() : "—"}
              </p>
            </section>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
