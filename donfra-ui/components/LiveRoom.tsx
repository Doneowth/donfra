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

// Custom participant list that filters hidden participants
function StealthAwareParticipantList() {
  const { localParticipant } = useLocalParticipant();
  const localMeta = parseMetadata(localParticipant?.metadata);
  const canStealth = localMeta.canStealth || false;

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  // Get unique participants
  const participants = useMemo(() => {
    const seen = new Set<string>();
    return tracks
      .filter(track => {
        if (seen.has(track.participant.identity)) return false;
        seen.add(track.participant.identity);
        const meta = parseMetadata(track.participant.metadata);
        return !meta.isHidden || canStealth;
      })
      .map(track => ({
        identity: track.participant.identity,
        name: track.participant.name || track.participant.identity,
        isHidden: parseMetadata(track.participant.metadata).isHidden || false,
        isLocal: track.participant.identity === localParticipant?.identity,
      }));
  }, [tracks, canStealth, localParticipant?.identity]);

  return (
    <div className="lk-participant-list-container">
      <div className="lk-participant-list-header">
        Participants ({participants.length})
      </div>
      <div className="lk-participant-list">
        {participants.map(p => (
          <div
            key={p.identity}
            className={`lk-participant-item ${p.isHidden ? "lk-participant-hidden" : ""}`}
          >
            {p.isHidden && <span className="lk-hidden-badge">👻</span>}
            <span className="lk-participant-name">
              {p.name}
              {p.isLocal && " (You)"}
            </span>
          </div>
        ))}
      </div>
    </div>
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
  const [showParticipants, setShowParticipants] = useState(false);

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
          {showParticipants && (
            <div className="lk-sidebar">
              <StealthAwareParticipantList />
            </div>
          )}
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
        <button
          className="lk-participants-toggle"
          onClick={() => setShowParticipants(!showParticipants)}
          title={showParticipants ? "Hide participants" : "Show participants"}
        >
          {showParticipants ? "Hide" : "Show"} Participants
        </button>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
