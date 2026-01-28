"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Toast, { ToastType } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

interface InterviewRoom {
  id: number;
  room_id: string;
  owner_id: number;
  headcount: number;
  code_snapshot: string;
  invite_link: string;
  created_at: string;
  updated_at: string;
}

export default function UserPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<InterviewRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Password update form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("info");

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");

  useEffect(() => {
    document.body.style.margin = "0";
  }, []);

  // Helper to show toast
  const showToast = (message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setToastOpen(true);
  };

  // Helper to show confirm dialog
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };

  // Redirect to home if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Fetch rooms for any logged-in user (backend will enforce permissions)
  useEffect(() => {
    if (user) {
      fetchRooms();
    } else {
      setLoadingRooms(false);
    }
  }, [user]);

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const response = await api.interview.getMyRooms();
      setRooms(response.rooms || []);
    } catch (err: any) {
      console.error("Failed to fetch rooms:", err);
      // Silently fail if user doesn't have permission
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      setCreatingRoom(true);
      const response = await api.interview.init();
      // Refresh rooms list
      await fetchRooms();
      // Show success message
      showToast("Room created successfully!", "success");
    } catch (err: any) {
      console.error("Failed to create room:", err);
      showToast(err.message || "Failed to create room. Please try again.", "error");
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = (inviteLink: string) => {
    window.open(inviteLink, "_blank");
  };

  const handleCloseRoom = (roomId: string) => {
    showConfirm(
      "Close Room",
      "Are you sure you want to close this room? This action cannot be undone.",
      async () => {
        try {
          await api.interview.close(roomId);
          // Refresh rooms list
          await fetchRooms();
          showToast("Room closed successfully", "success");
        } catch (err: any) {
          console.error("Failed to close room:", err);
          showToast(err.message || "Failed to close room. Please try again.", "error");
        }
      }
    );
  };

  const handleCopyInviteLink = async (inviteLink: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    showToast("Invite link copied to clipboard!", "success");
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("Failed to copy link. Please try manually. ", "error");
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("All fields are required", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }

    try {
      setUpdatingPassword(true);
      await api.auth.updatePassword(currentPassword, newPassword);
      showToast("Password updated successfully!", "success");
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showToast(err.message || "Failed to update password", "error");
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <div className="admin-shell">
        <video className="admin-hero-video" autoPlay loop muted playsInline>
          <source src="/SFV2.mp4" type="video/mp4" />
        </video>
        <div className="admin-vignette" />
        <div className="admin-bg-grid" />
        <div className="admin-wrapper">
          <p className="lead" style={{ textAlign: "center" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <main className="admin-shell">
      {/* Background Video */}
      <video className="admin-hero-video" autoPlay loop muted playsInline>
        <source src="/SFV2.mp4" type="video/mp4" />
      </video>
      <div className="admin-vignette" />
      <div className="admin-bg-grid" />

      {/* Content */}
      <div className="admin-wrapper">
        {/* Header */}
        <div className="admin-headline">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            User Profile
          </motion.h1>
          <motion.p
            className="lede"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Manage your account settings and interview rooms.
          </motion.p>
        </div>

        {/* User Info Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ marginTop: 48 }}
        >
          <h2 className="display h2" style={{ marginBottom: 24 }}>
            Account Information
          </h2>
          <div className="card panel-deeper" style={{ maxWidth: 720 }}>
            <div className="form-group">
              <div className="form-label">Username</div>
              <div className="user-info-value">{user.username}</div>
            </div>
            <div className="form-group">
              <div className="form-label">Email</div>
              <div className="user-info-value">{user.email}</div>
            </div>
            <div className="form-group">
              <div className="form-label">Role</div>
              <div className="user-info-value" style={{ textTransform: "uppercase" }}>
                {user.role}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="form-label">Member Since</div>
              <div className="user-info-value">
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Interview Rooms Section - Backend enforces admin+ permissions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ marginTop: 48 }}
        >
          <div style={{ marginBottom: 24 }}>
            <div className="flex-row" style={{ alignItems: "center" }}>
              <h2 className="display h2" style={{ margin: 0 }}>
                Interview Rooms
              </h2>
              <button
                className="btn-elegant"
                onClick={handleCreateRoom}
                disabled={creatingRoom}
              >
                {creatingRoom ? "Creating..." : "+ Create Room"}
              </button>
            </div>
          </div>

          {loadingRooms ? (
            <p className="muted">Loading rooms...</p>
          ) : rooms.length === 0 ? (
            <div className="card panel-deeper" style={{ textAlign: "center", padding: 48 }}>
              <p className="muted" style={{ marginBottom: 16 }}>
                No active interview rooms.
              </p>
              <p className="small muted">
                Create a room to start a collaborative coding session.
              </p>
            </div>
          ) : (
            <div className="grid grid-3" style={{ gap: 24 }}>
              {rooms.map((room) => (
                <div key={room.id} className="card panel-deeper">
                  <div className="flex-row" style={{ marginBottom: 12 }}>
                    <span className="semibold" style={{ fontSize: 14 }}>
                      Room {room.room_id.slice(0, 8)}...
                    </span>
                    <span className="chip chip--ghost">
                      {room.headcount} {room.headcount === 1 ? "user" : "users"}
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <div className="form-label">Created</div>
                    <div className="small muted">
                      {new Date(room.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <div className="form-label">Invite Link</div>
                    <div
                      className="small muted"
                      style={{
                        wordBreak: "break-all",
                        cursor: "pointer",
                        padding: "8px",
                        background: "rgba(169,142,100,0.08)",
                        borderRadius: "6px",
                        border: "1px solid rgba(169,142,100,0.25)",
                      }}
                      onClick={() => handleCopyInviteLink(room.invite_link)}
                      title="Click to copy"
                    >
                      {room.invite_link}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-strong"
                      style={{ flex: 1 }}
                      onClick={() => handleJoinRoom(room.invite_link)}
                    >
                      Join
                    </button>
                    <button
                      className="btn-danger"
                      style={{ flex: 1 }}
                      onClick={() => handleCloseRoom(room.room_id)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Password Update Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ marginTop: 48, marginBottom: 80 }}
        >
          <h2 className="display h2" style={{ marginBottom: 24 }}>
            Update Password
          </h2>
          <div className="card panel-deeper" style={{ maxWidth: 720 }}>
            <form onSubmit={handlePasswordUpdate}>
              <div className="form-group">
                <label className="form-label" htmlFor="current-password">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={updatingPassword}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  disabled={updatingPassword}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={updatingPassword}
                />
              </div>

              <button
                type="submit"
                className="btn-strong btn-full"
                disabled={updatingPassword}
              >
                {updatingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </motion.section>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ textAlign: "center", marginBottom: 40 }}
        >
          <button
            className="btn-ghost"
            onClick={() => router.push("/")}
          >
            ← Back to Home
          </button>
        </motion.div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isOpen={toastOpen}
        onClose={() => setToastOpen(false)}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
        confirmStyle="danger"
      />
    </main>
  );
}
