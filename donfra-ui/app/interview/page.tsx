"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CodePad from "@/components/CodePad";
import { api } from "@/lib/api";

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [isOwner, setIsOwner] = useState<boolean>(false);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        // Get invite token from URL query params
        const token = searchParams.get("token");

        if (!token) {
          setError("Missing invite token. Please use a valid invite link.");
          setLoading(false);
          return;
        }

        // Join the room via API
        const response = await fetch("/api/interview/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invite_token: token }),
          credentials: "include", // Important for cookies
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to join room: ${response.status}`);
        }

        const data = await response.json();
        setRoomId(data.room_id);

        // Check if current user is the room owner (admin)
        try {
          const userResponse = await api.auth.me();
          setIsOwner(userResponse.user?.role === "admin");
        } catch (err) {
          console.log("[Interview] Could not fetch user info, assuming non-owner");
          setIsOwner(false);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error joining room:", err);
        setError(err.message || "Failed to join interview room");
        setLoading(false);
      }
    };

    joinRoom();
  }, [searchParams]);

  const handleExit = useCallback(async () => {
    // If user is the room owner (admin), close the room before exiting
    if (roomId && isOwner) {
      try {
        await api.interview.close(roomId);
        console.log(`[Interview] Room ${roomId} closed by owner`);
      } catch (err) {
        console.error("[Interview] Error closing room:", err);
        // Continue to exit even if close fails
      }
    } else if (roomId) {
      console.log(`[Interview] User leaving room ${roomId} (room will remain open)`);
    }
    router.push("/");
  }, [router, roomId, isOwner]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "16px"
      }}>
        <div style={{ fontSize: "18px", color: "#666" }}>Joining interview room...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "16px"
      }}>
        <div style={{ fontSize: "18px", color: "#e74c3c", marginBottom: "8px" }}>
          ❌ {error}
        </div>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  // Successfully joined - render CodePad with the room_id
  return <CodePad onExit={handleExit} roomId={roomId} />;
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{ fontSize: "18px", color: "#666" }}>Loading...</div>
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
