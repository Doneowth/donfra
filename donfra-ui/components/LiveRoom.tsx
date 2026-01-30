"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useLocalParticipant,
  VideoTrack,
  TrackRefContext,
  isTrackReference,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

interface LiveRoomProps {
  sessionId: string;
  token: string;
  serverUrl: string;
  userName: string;
  onDisconnected?: () => void;
}

interface ParticipantMetadata {
  isHidden?: boolean;
  canStealth?: boolean;
}

function parseMetadata(metadata: string | undefined): ParticipantMetadata {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

// Custom video grid that filters hidden participants and supports focus mode for screen shares
function StealthAwareVideoGrid() {
  const { localParticipant } = useLocalParticipant();
  const localMeta = parseMetadata(localParticipant?.metadata);
  const canStealth = localMeta.canStealth || false;

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Filter out hidden participants (unless current user can see them)
  const visibleTracks = useMemo(() => {
    return tracks.filter(track => {
      const meta = parseMetadata(track.participant.metadata);
      // Show if not hidden, or if current user can see hidden participants
      return !meta.isHidden || canStealth;
    });
  }, [tracks, canStealth]);

  // Separate screen share tracks from camera tracks
  const screenShareTracks = useMemo(() => {
    return visibleTracks.filter(
      track => isTrackReference(track) && track.source === Track.Source.ScreenShare
    );
  }, [visibleTracks]);

  const cameraTracks = useMemo(() => {
    return visibleTracks.filter(
      track => !isTrackReference(track) || track.source !== Track.Source.ScreenShare
    );
  }, [visibleTracks]);

  // If there's an active screen share, use focus layout
  if (screenShareTracks.length > 0) {
    const screenShare = screenShareTracks[0];

    // Check if this is a valid, published screen share track
    const hasValidScreenShare = isTrackReference(screenShare) && screenShare.publication;

    return (
      <div className="lk-focus-layout" style={{ height: "calc(100vh - 80px)" }}>
        {/* Main screen share area */}
        <div className="lk-focus-main">
          {hasValidScreenShare ? (
            <TrackRefContext.Provider value={screenShare}>
              <VideoTrack
                trackRef={screenShare}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              <div className="lk-screen-share-label">
                {screenShare.participant.name || screenShare.participant.identity} is sharing screen
              </div>
            </TrackRefContext.Provider>
          ) : (
            <div className="lk-screen-share-loading">
              Connecting to screen share...
            </div>
          )}
        </div>
        {/* Camera feeds in sidebar */}
        {cameraTracks.length > 0 && (
          <div className="lk-focus-sidebar">
            <GridLayout tracks={cameraTracks}>
              <ParticipantTile />
            </GridLayout>
          </div>
        )}
      </div>
    );
  }

  // Default grid layout when no screen share
  return (
    <GridLayout
      tracks={visibleTracks}
      style={{ height: "calc(100vh - 80px)" }}
    >
      <ParticipantTile />
    </GridLayout>
  );
}

// Stealth toggle button for admins
function StealthToggle() {
  const { localParticipant } = useLocalParticipant();
  const [isHidden, setIsHidden] = useState(false);
  const [canStealth, setCanStealth] = useState(false);

  // Sync local state with participant metadata
  useEffect(() => {
    if (!localParticipant) return;

    const updateFromMetadata = () => {
      const meta = parseMetadata(localParticipant.metadata);
      setCanStealth(meta.canStealth || false);
      setIsHidden(meta.isHidden || false);
    };

    // Initial sync
    updateFromMetadata();

    // Listen for metadata changes
    const handleMetadataChanged = () => updateFromMetadata();
    localParticipant.on("participantMetadataChanged", handleMetadataChanged);

    return () => {
      localParticipant.off("participantMetadataChanged", handleMetadataChanged);
    };
  }, [localParticipant]);

  // Only show for users with stealth capability
  if (!canStealth) return null;

  const toggleStealth = async () => {
    if (!localParticipant) return;

    const newIsHidden = !isHidden;
    const currentMeta = parseMetadata(localParticipant.metadata);

    const newMetadata = JSON.stringify({
      ...currentMeta,
      isHidden: newIsHidden,
    });

    // Update local state immediately for responsive UI
    setIsHidden(newIsHidden);

    // Then sync to server
    await localParticipant.setMetadata(newMetadata);
  };

  return (
    <button
      className={`lk-stealth-toggle ${isHidden ? "lk-stealth-active" : ""}`}
      onClick={toggleStealth}
      title={isHidden ? "Exit stealth mode" : "Enter stealth mode"}
    >
      {isHidden ? "👻 Stealth ON" : "👤 Stealth OFF"}
    </button>
  );
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
              maxBitrate: 10_000_000,
              maxFramerate: 30,
            },
            videoEncoding: {
              maxBitrate: 2_500_000,
              maxFramerate: 30,
            },
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
          dynacast: false,
          adaptiveStream: false,
        }}
      >
        <div className="lk-room-container">
          <div className="lk-main-content">
            <StealthAwareVideoGrid />
          </div>
        </div>
        <ControlBar
          variation="minimal"
          controls={{
            camera: true,
            microphone: true,
            screenShare: true,
            leave: true,
            chat: false,
          }}
        />
        <StealthToggle />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
