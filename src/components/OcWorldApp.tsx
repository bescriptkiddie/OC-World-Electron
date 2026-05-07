import { useEffect, useMemo, useState } from "react";
import { useRuntime } from "../runtime/use-runtime";
import { useChat } from "../hooks/useChat";
import { ChatView } from "./ChatView";
import { CreateView } from "./CreateView";
import { MemoryView } from "./MemoryView";
import { MyOcView } from "./MyOcView";
import { OcDesktopShell } from "./OcDesktopShell";
import { OcProfileCard } from "./OcProfileCard";
import { OcWorkspaceHeader } from "./OcWorkspaceHeader";
import { RewindView } from "./RewindView";
import { SettingsView } from "./SettingsView";
import { type SessionId, type ViewId, resolveInitialView, visibleMessages } from "./shared";
import type { OcVisualProfile } from "../types";

export function OcWorldApp() {
  const { client, capabilities } = useRuntime();
  const chat = useChat();
  const [view, setView] = useState<ViewId>("oc");
  const [selectedSession, setSelectedSession] = useState<SessionId>("live");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialViewResolved, setInitialViewResolved] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [floatingOcOpen, setFloatingOcOpen] = useState(false);
  const floatingOcAvailable = Boolean(capabilities.floatingOc);
  const workspaceView = view === "memory" ? "chat" : view;
  const headerView = settingsOpen ? "settings" : memoryOpen ? "memory" : workspaceView;

  const messages = useMemo(
    () => visibleMessages(chat.history, chat.pendingMessages, chat.isSending, selectedSession),
    [chat.history, chat.isSending, chat.pendingMessages, selectedSession],
  );

  useEffect(() => {
    if (initialViewResolved || !chat.relationship) {
      return;
    }

    setView(resolveInitialView(chat.character));
    setInitialViewResolved(true);
  }, [chat.character, chat.relationship, initialViewResolved]);

  useEffect(() => {
    if (!capabilities.floatingOc) {
      return;
    }

    let cancelled = false;
    capabilities.floatingOc.getState().then((state) => {
      if (!cancelled) {
        setFloatingOcOpen(state.open);
      }
    }).catch(() => {
      if (!cancelled) {
        setFloatingOcOpen(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [capabilities.floatingOc]);

  const handleViewChange = (nextView: ViewId) => {
    setSettingsOpen(false);
    if (nextView === "memory") {
      setMemoryOpen(true);
      if (view === "memory") {
        setView("chat");
      }
      return;
    }
    setMemoryOpen(false);
    setView(nextView);
  };

  const closeMemory = () => {
    setMemoryOpen(false);
    if (view === "memory") {
      setView("chat");
    }
  };

  const sendPrompt = async (text: string) => {
    if (!text.trim()) return;
    setSelectedSession("live");
    setView("chat");
    await chat.sendMessage(text);
  };

  const startBlankChat = () => {
    setSelectedSession("new");
    setView("chat");
  };

  const toggleFloatingOc = async () => {
    if (!capabilities.floatingOc) {
      return;
    }

    const state = await capabilities.floatingOc.toggle();
    setFloatingOcOpen(state.open);
  };

  const handleCreateSave = async (data: { name: string; personality: string; catchphrase: string; relationshipSetup: string; avatarPath?: string; visualProfile?: OcVisualProfile }) => {
    const nextCharacter = {
      id: "char-001",
      name: data.name,
      personality: data.personality,
      catchphrase: data.catchphrase,
      relationshipSetup: data.relationshipSetup,
      avatarLabel: data.name,
      avatarPath: data.avatarPath,
      visualProfile: data.visualProfile,
    };

    await client.character.saveCurrent({
      characterId: "char-001",
      character: nextCharacter,
    });

    await chat.refreshState();
    setInitialViewResolved(true);
    setSelectedSession("live");
    setMemoryOpen(false);
    setView("chat");
  };

  const handleUserNameChange = async (name: string) => {
    if (!chat.relationship) {
      throw new Error("Relationship not available");
    }

    await client.relationship.save({
      userId: chat.relationship.userId,
      relationship: { ...chat.relationship, userName: name },
    });

    await chat.refreshState();
  };

  const leftPanel = (
    <OcProfileCard
      character={chat.character}
      relationship={chat.relationship}
      greeting={chat.greeting}
      ttsEnabled={chat.ttsEnabled}
      growthInsights={chat.growthInsights}
      growthProfile={chat.growthProfile}
      revealHint={chat.activeReveal}
      onTtsToggle={() => chat.setTtsEnabled(!chat.ttsEnabled)}
      onOpenChat={() => {
        setView("chat");
        setMemoryOpen(false);
      }}
      onOpenMemory={() => setMemoryOpen(true)}
    />
  );

  const header = (
    <OcWorkspaceHeader
      current={headerView}
      floatingOpen={floatingOcOpen}
      floatingAvailable={floatingOcAvailable}
      onChange={handleViewChange}
      onOpenSettings={() => {
        setMemoryOpen(false);
        setSettingsOpen(true);
      }}
      onToggleFloating={toggleFloatingOc}
    />
  );

  const content = !initialViewResolved ? (
    <WorkspaceLoading />
  ) : settingsOpen ? (
    <SettingsView
      character={chat.character}
      relationship={chat.relationship}
      onUserNameChange={handleUserNameChange}
      onRecreateOC={() => {
        setSettingsOpen(false);
        setView("create");
      }}
      onBack={() => setSettingsOpen(false)}
    />
  ) : renderView({
    view: memoryOpen ? "chat" : workspaceView,
    messages,
    selectedSession,
    chat,
    pendingCount: chat.pendingMessages.length,
    onSend: sendPrompt,
    onCreateSave: handleCreateSave,
    onCancelCreate: () => setView("chat"),
    canCancelCreate: Boolean(chat.character?.name?.trim()),
    onOpenChat: () => {
      setView("chat");
      setMemoryOpen(false);
    },
    onOpenCreate: () => setView("create"),
    onOpenRewind: () => setView("rewind"),
    onOpenMemory: () => setMemoryOpen(true),
    onCloseMemory: closeMemory,
    memoryOpen,
    onNewChat: startBlankChat,
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "var(--bg-page)" }}>
      <OcDesktopShell left={leftPanel} header={header}>
        {content}
      </OcDesktopShell>
    </div>
  );
}

function renderView({
  view,
  messages,
  selectedSession,
  chat,
  pendingCount,
  onSend,
  onCreateSave,
  onCancelCreate,
  canCancelCreate,
  onOpenChat,
  onOpenCreate,
  onOpenRewind,
  onOpenMemory,
  onCloseMemory,
  memoryOpen,
  onNewChat,
}: {
  view: ViewId;
  messages: ReturnType<typeof visibleMessages>;
  selectedSession: SessionId;
  chat: ReturnType<typeof useChat>;
  pendingCount: number;
  onSend: (text: string) => Promise<void>;
  onCreateSave: (data: { name: string; personality: string; catchphrase: string; relationshipSetup: string; avatarPath?: string; visualProfile?: OcVisualProfile }) => Promise<void>;
  onCancelCreate: () => void;
  canCancelCreate: boolean;
  onOpenChat: () => void;
  onOpenCreate: () => void;
  onOpenRewind: () => void;
  onOpenMemory: () => void;
  onCloseMemory: () => void;
  memoryOpen: boolean;
  onNewChat: () => void;
}) {
  if (view === "create") {
    return <CreateView onSave={onCreateSave} onCancel={onCancelCreate} canCancel={canCancelCreate} />;
  }

  if (view === "oc") {
    return (
      <MyOcView
        character={chat.character}
        relationship={chat.relationship}
        greeting={chat.greeting}
        onOpenChat={onOpenChat}
        onOpenCreate={onOpenCreate}
        onOpenRewind={onOpenRewind}
        onOpenMemory={onOpenMemory}
      />
    );
  }

  if (view === "chat") {
    return (
      <>
        <ChatView
          character={chat.character}
          messages={messages}
          isSending={chat.isSending}
          pendingCount={pendingCount}
          selectedSession={selectedSession}
          ttsEnabled={chat.ttsEnabled}
          voiceInputState={chat.voiceInputState}
          voiceTranscript={chat.voiceTranscript}
          relationship={chat.relationship}
          ocAvatarPath={chat.character?.avatarPath}
          revealHint={chat.activeReveal}
          revealBusy={chat.revealBusy}
          recallHint={chat.activeRecallHint}
          onSend={onSend}
          onInterrupt={chat.interruptActiveTurn}
          onTtsToggle={() => chat.setTtsEnabled(!chat.ttsEnabled)}
          onVoiceToggle={chat.toggleVoiceInput}
          onDismissReveal={chat.dismissReveal}
          onRejectReveal={chat.rejectReveal}
          onDismissRecallHint={chat.dismissRecallHint}
          onOpenMemory={onOpenMemory}
          onNewChat={onNewChat}
        />
        <MemoryView
          relationship={chat.relationship}
          timeline={chat.timeline}
          growthProfile={chat.growthProfile}
          growthInsights={chat.growthInsights}
          revealHint={chat.activeReveal}
          revealBusy={chat.revealBusy}
          open={memoryOpen}
          onClose={onCloseMemory}
          onConfirmReveal={chat.confirmReveal}
          onDismissReveal={chat.dismissReveal}
          onRejectReveal={chat.rejectReveal}
        />
      </>
    );
  }

  if (view === "rewind") {
    return <RewindView timeline={chat.timeline} relationship={chat.relationship} />;
  }

  return (
    <MemoryView
      relationship={chat.relationship}
      timeline={chat.timeline}
      growthProfile={chat.growthProfile}
      growthInsights={chat.growthInsights}
      revealHint={chat.activeReveal}
      revealBusy={chat.revealBusy}
      open={true}
      onClose={onCloseMemory}
      onConfirmReveal={chat.confirmReveal}
      onDismissReveal={chat.dismissReveal}
      onRejectReveal={chat.rejectReveal}
    />
  );
}

function WorkspaceLoading() {
  return (
    <div className="oc-page oc-loading-page">
      <section className="oc-hero-card">
        <div>
          <p className="oc-kicker mono">RESTORING</p>
          <h2 className="oc-page-title serif">正在恢复你的 OC 世界</h2>
          <p className="oc-page-copy">角色、关系和最近上下文正在接回当前会话。</p>
        </div>
      </section>
    </div>
  );
}
