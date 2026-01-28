"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import ConfirmModal from "@/components/ConfirmModal";
import UserCard from "@/components/admin/UserCard";
import Toast, { ToastType } from "@/components/Toast";

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
  isActive: boolean;
  createdAt: string;
};

type Tab = "rooms" | "users";

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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("info");

  // Check if user is god user via user authentication (admin-dashboard is god-only)
  const isGodUser = user?.role === "god";

  const showToast = (message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setToastOpen(true);
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

        {/* Confirmation Dialog */}
        <ConfirmModal
          isOpen={confirmDialog.show}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={hideConfirm}
          confirmStyle="danger"
        />

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
                    <UserCard
                      key={u.id}
                      user={u}
                      isUpdating={updatingUserId === u.id}
                      onRoleChange={handleUpdateUserRole}
                      onStatusChange={handleUpdateUserStatus}
                    />
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

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isOpen={toastOpen}
        onClose={() => setToastOpen(false)}
      />
    </main>
  );
}
