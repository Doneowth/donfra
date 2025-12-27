"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";

interface LiveRoomProps {
  sessionId: string;
  token: string;
  serverUrl: string;
  userName: string;
  onDisconnected?: () => void;
}

export default function LiveRoom({
  sessionId,
  token,
  serverUrl,
  userName,
  onDisconnected,
}: LiveRoomProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: "18px"
      }}>
        Loading room...
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        screen={true}
        onDisconnected={onDisconnected}
        data-lk-theme="default"
        style={{ height: "100%" }}
        options={{
          publishDefaults: {
            screenShareEncoding: {
              maxBitrate: 10_000_000, // 10 Mbps for ultra-crisp screen share
              maxFramerate: 30,
            },
            videoEncoding: {
              maxBitrate: 2_500_000, // 2.5 Mbps for camera
              maxFramerate: 30,
            },
            // Disable simulcast - send only one high-quality layer
            videoSimulcastLayers: [],
            screenShareSimulcastLayers: [],
          },
          videoCaptureDefaults: {
            resolution: {
              width: 1920,
              height: 1080,
              frameRate: 30,
            },
          },
          // Disable adaptive stream to always use max quality
          dynacast: false,
          adaptiveStream: false,
        }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
