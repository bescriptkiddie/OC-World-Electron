import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { anthropicModelOptions, buildAnthropicSettings, maskApiKey, type AnthropicModel, type AnthropicSettings } from "./llm-config";
import { clearAnthropicSettings, loadAnthropicSettings, saveAnthropicSettings } from "./llm-config-storage";
import { sendAnthropicMessage, verifyAnthropicSettings } from "./llm-client";
import { createSendMessageTransition, resetToLlmConfigState } from "./chat-session-state";
import { starterOcStyles, personalityOptions, appearanceOptions, toneOptions, anthropicModelLabels, type StarterOcStyleId } from "./data";
import { createIosScreenModel } from "./screen-model";
import { type InstallIdentity, createInstallIdentity } from "./install-identity";
import { loadInstallIdentity } from "./install-identity-storage";
import { createInitialOnboardingState, advanceOnboardingStep, retreatOnboardingStep, type OnboardingStep } from "./onboarding-state";
import { readRuntimeConfig } from "./runtime-config";
import { resolveStatusText, toChatMessages } from "./view-state";
import { reduceChatConfigState } from "../../../packages/oc-app-core/src/chat-store-config";

const runtimeConfig = readRuntimeConfig();

type UiMessage = { id: string; role: "user" | "oc"; text: string };

type LocalCharacterDraft = {
  name: string;
  selectedStyle: StarterOcStyleId;
  selectedTone: string;
  selectedPersonality: string[];
  selectedAppearance: string[];
  prompt: string;
};

function buildLocalOcReply(input: { draft: LocalCharacterDraft; userMessage: string }) {
  const prefix = input.draft.name || "TA";
  const style = input.draft.selectedTone || starterOcStyles.find((item) => item.id === input.draft.selectedStyle)?.tone || "轻一点、接住人";
  return `${prefix}：${style}。我先接住这句——${input.userMessage}`;
}

function toggleSelection(current: string[], value: string, limit: number) {
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  if (current.length >= limit) {
    return current;
  }
  return [...current, value];
}

export function OcIosApp() {
  const initialOnboardingState = React.useMemo(() => createInitialOnboardingState(), []);
  const [hasCharacter, setHasCharacter] = React.useState(false);
  const [memoryOpen, setMemoryOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [currentRoute, setCurrentRoute] = React.useState<"chat" | "rewind">("chat");
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [statusText, setStatusText] = React.useState("我在。先说一句今天真实发生的小事。");
  const [installIdentity, setInstallIdentity] = React.useState<InstallIdentity | null>(null);
  const [llmSettings, setLlmSettings] = React.useState<AnthropicSettings | null>(null);
  const [llmForm, setLlmForm] = React.useState({
    apiKey: "",
    model: anthropicModelOptions[0] as AnthropicModel,
  });
  const [llmSaving, setLlmSaving] = React.useState(false);
  const [llmError, setLlmError] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState("");
  const [onboardingStep, setOnboardingStep] = React.useState<OnboardingStep>(initialOnboardingState.step);
  const [ocDraft, setOcDraft] = React.useState<LocalCharacterDraft>(initialOnboardingState.oc);
  const screen = createIosScreenModel({ hasCharacter, memoryOpen, settingsOpen, currentRoute });

  React.useEffect(() => {
    void loadInstallIdentity().then(setInstallIdentity).catch(() => {
      setInstallIdentity(createInstallIdentity());
    });
    void loadAnthropicSettings().then((settings) => {
      setLlmSettings(settings);
      if (settings) {
        setLlmForm({
          apiKey: settings.apiKey,
          model: settings.model,
        });
        setOnboardingStep("name");
      }
    });
  }, []);

  React.useEffect(() => {
    const routeState = reduceChatConfigState({
      hasLlmConfig: Boolean(llmSettings),
      hasCharacter,
    });
    if (routeState.route === "llm") {
      setOnboardingStep("llm");
      return;
    }
    if (routeState.route === "create") {
      if (onboardingStep === "llm") {
        setOnboardingStep("name");
      }
      return;
    }
    setCurrentRoute("chat");
  }, [hasCharacter, llmSettings, onboardingStep]);

  const activeUserId = installIdentity?.userId || "ios-user-pending";

  const saveLlmConfig = async () => {
    setLlmSaving(true);
    setLlmError("");
    try {
      const nextSettings = buildAnthropicSettings({
        provider: "anthropic",
        apiKey: llmForm.apiKey,
        model: llmForm.model,
      });
      await verifyAnthropicSettings(nextSettings);
      await saveAnthropicSettings(nextSettings);
      setLlmSettings(nextSettings);
      setStatusText(`Anthropic 已连接：${anthropicModelLabels[nextSettings.model]}`);
      setOnboardingStep("name");
    } catch (error) {
      setLlmError(error instanceof Error ? error.message : "Anthropic 配置失败");
    } finally {
      setLlmSaving(false);
    }
  };

  const reconfigureModel = async () => {
    setSettingsOpen(false);

    let storageError = "";
    try {
      await clearAnthropicSettings();
    } catch (error) {
      storageError = error instanceof Error ? error.message : "Anthropic 配置清除失败";
    }

    const nextState = resetToLlmConfigState({
      llmSettings,
      llmForm,
      hasCharacter,
      onboardingStep,
      messages,
      statusText,
      ocDraft,
      initialOcDraft: initialOnboardingState.oc,
      storageError,
    });

    setLlmSettings(nextState.llmSettings);
    setLlmForm(nextState.llmForm);
    setHasCharacter(nextState.hasCharacter);
    setOnboardingStep(nextState.onboardingStep);
    setMessages(nextState.messages);
    setStatusText(nextState.statusText);
    setOcDraft(nextState.ocDraft);
    setLlmError(nextState.llmError);
    setLlmSaving(nextState.llmSaving);
    setSendError("");
    setIsSending(false);
    setDraft("");
    setMemoryOpen(false);
  };

  const sendMessage = async () => {
    const transition = createSendMessageTransition({
      draft,
      llmSettings,
      ocDraft,
      messages,
    });

    if (!transition.request) {
      if (transition.sendError) {
        setSendError(transition.sendError);
        setStatusText(transition.sendError);
      }
      return;
    }

    setDraft(transition.nextDraft);
    setMessages(transition.nextMessages);
    setIsSending(transition.isSending);
    setSendError(transition.sendError);

    try {
      const replyText = await sendAnthropicMessage(transition.request);
      const nextStatusText = resolveStatusText({
        greeting: `${ocDraft.name || "TA"} 已经接住这轮对话。`,
        revealText: null,
      });
      const settled = transition.resolveSuccess(replyText, nextStatusText);
      setMessages(settled.nextMessages);
      setIsSending(settled.isSending);
      setSendError(settled.sendError);
      setStatusText(settled.statusText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Anthropic 对话失败";
      const settled = transition.resolveFailure(message);
      setMessages(settled.nextMessages);
      setIsSending(settled.isSending);
      setSendError(settled.sendError);
      setStatusText(settled.statusText);
    }
  };

  const completeCreateFlow = () => {
    setHasCharacter(true);
    setStatusText(`${ocDraft.name || "TA"} 已经准备好了。`);
    setMessages(
      toChatMessages([
        {
          timestamp: Date.now(),
          userMessage: "你好",
          ocResponse: buildLocalOcReply({ draft: ocDraft, userMessage: "你好" }),
          emotion: "thinking",
        },
      ]),
    );
  };

  const nextOnboardingStep = () => {
    const next = advanceOnboardingStep(onboardingStep);
    if (next === onboardingStep) {
      return;
    }
    setOnboardingStep(next);
  };

  const prevOnboardingStep = () => {
    setOnboardingStep(retreatOnboardingStep(onboardingStep));
  };

  if (screen.homeRoute === "onboarding") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>{runtimeConfig.appName}</Text>
        <Text style={styles.title}>先把 TA 带出来</Text>
        <Text style={styles.copy}>先配 Anthropic，再捏出你的 OC，最后进入对话。</Text>
        <View style={styles.card}>
          {onboardingStep === "llm" ? (
            <>
              <Text style={styles.sectionTitle}>先连接 Anthropic</Text>
              <Text style={styles.copy}>密钥只保存在这台设备本地，用来驱动你的 OC 对话。</Text>
              <TextInput
                value={llmForm.apiKey}
                onChangeText={(value) => setLlmForm((current) => ({ ...current, apiKey: value }))}
                style={styles.input}
                placeholder="sk-ant-..."
                placeholderTextColor="#8A8F98"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.sectionTitle}>模型</Text>
              {anthropicModelOptions.map((model) => (
                <TouchableOpacity
                  key={model}
                  style={[styles.option, llmForm.model === model && styles.optionActive]}
                  onPress={() => setLlmForm((current) => ({ ...current, model }))}
                >
                  <Text style={styles.optionTitle}>{anthropicModelLabels[model]}</Text>
                  <Text style={styles.optionCopy}>{model}</Text>
                </TouchableOpacity>
              ))}
              {llmSettings ? <Text style={styles.helperText}>当前已保存：{maskApiKey(llmSettings.apiKey)}</Text> : null}
              {llmError ? <Text style={styles.errorText}>{llmError}</Text> : null}
              <TouchableOpacity style={styles.primaryButton} onPress={() => void saveLlmConfig()}>
                <Text style={styles.primaryButtonText}>{llmSaving ? "验证中…" : "验证并保存"}</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {onboardingStep === "name" ? (
            <>
              <Text style={styles.sectionTitle}>名字</Text>
              <TextInput
                value={ocDraft.name}
                onChangeText={(value) => setOcDraft((current) => ({ ...current, name: value }))}
                style={styles.input}
                placeholder="给 OC 起个名字"
                placeholderTextColor="#8A8F98"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={nextOnboardingStep}>
                <Text style={styles.primaryButtonText}>下一步</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {onboardingStep === "customize" ? (
            <>
              <Text style={styles.sectionTitle}>风格</Text>
              {starterOcStyles.map((style) => (
                <TouchableOpacity
                  key={style.id}
                  style={[styles.option, ocDraft.selectedStyle === style.id && styles.optionActive]}
                  onPress={() => setOcDraft((current) => ({ ...current, selectedStyle: style.id }))}
                >
                  <Text style={styles.optionTitle}>{style.title}</Text>
                  <Text style={styles.optionCopy}>{style.tone}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.sectionTitle}>性格</Text>
              <View style={styles.tagWrap}>
                {personalityOptions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.tag, ocDraft.selectedPersonality.includes(item) && styles.tagActive]}
                    onPress={() =>
                      setOcDraft((current) => ({
                        ...current,
                        selectedPersonality: toggleSelection(current.selectedPersonality, item, 3),
                      }))
                    }
                  >
                    <Text style={styles.tagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionTitle}>外观</Text>
              <View style={styles.tagWrap}>
                {appearanceOptions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.tag, ocDraft.selectedAppearance.includes(item) && styles.tagActive]}
                    onPress={() =>
                      setOcDraft((current) => ({
                        ...current,
                        selectedAppearance: toggleSelection(current.selectedAppearance, item, 2),
                      }))
                    }
                  >
                    <Text style={styles.tagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionTitle}>语气</Text>
              <View style={styles.tagWrap}>
                {toneOptions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.tag, ocDraft.selectedTone === item && styles.tagActive]}
                    onPress={() => setOcDraft((current) => ({ ...current, selectedTone: current.selectedTone === item ? "" : item }))}
                  >
                    <Text style={styles.tagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionTitle}>补充描述</Text>
              <TextInput
                value={ocDraft.prompt}
                onChangeText={(value) => setOcDraft((current) => ({ ...current, prompt: value }))}
                style={styles.textarea}
                placeholder="一句话写出你真正想要的陪伴感"
                placeholderTextColor="#8A8F98"
                multiline
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={prevOnboardingStep}>
                  <Text style={styles.secondaryButtonText}>返回</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButtonInline} onPress={nextOnboardingStep}>
                  <Text style={styles.primaryButtonText}>预览</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {onboardingStep === "preview" ? (
            <>
              <Text style={styles.sectionTitle}>确认你的 OC</Text>
              <Text style={styles.previewTitle}>{ocDraft.name || "未命名"}</Text>
              <Text style={styles.optionCopy}>风格：{starterOcStyles.find((item) => item.id === ocDraft.selectedStyle)?.title}</Text>
              <Text style={styles.optionCopy}>性格：{ocDraft.selectedPersonality.join("、") || "未选"}</Text>
              <Text style={styles.optionCopy}>外观：{ocDraft.selectedAppearance.join("、") || "未选"}</Text>
              <Text style={styles.optionCopy}>语气：{ocDraft.selectedTone || "未选"}</Text>
              <Text style={styles.optionCopy}>描述：{ocDraft.prompt || "未填"}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={prevOnboardingStep}>
                  <Text style={styles.secondaryButtonText}>返回</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButtonInline} onPress={completeCreateFlow}>
                  <Text style={styles.primaryButtonText}>进入对话</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{runtimeConfig.appName}</Text>
          <Text style={styles.headerTitle}>{ocDraft.name || "TA"}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setMemoryOpen(true)}>
            <Text style={styles.ghostButtonText}>纸条</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.ghostButtonText}>设置</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.statusText}>{statusText}</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, currentRoute === "chat" && styles.tabActive]} onPress={() => setCurrentRoute("chat")}>
          <Text style={styles.tabText}>对话</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, currentRoute === "rewind" && styles.tabActive]} onPress={() => setCurrentRoute("rewind")}>
          <Text style={styles.tabText}>回看</Text>
        </TouchableOpacity>
      </View>

      {currentRoute === "chat" ? (
        <>
          <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
            {messages.length === 0 ? <Text style={styles.emptyText}>我在。先说一句今天真实发生的小事。</Text> : null}
            {messages.map((message) => (
              <View key={message.id} style={[styles.messageBubble, message.role === "user" ? styles.userBubble : styles.ocBubble]}>
                <Text style={[styles.messageText, message.role === "user" && styles.userMessageText]}>{message.text}</Text>
              </View>
            ))}
          </ScrollView>
          {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              style={styles.composerInput}
              placeholder="说一句真实发生的事"
              placeholderTextColor="#8A8F98"
              editable={!isSending}
            />
            <TouchableOpacity style={styles.primaryButtonSmall} onPress={() => void sendMessage()} disabled={isSending}>
              <Text style={styles.primaryButtonText}>{isSending ? "发送中…" : "发送"}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.rewindView}>
          <Text style={styles.sectionTitle}>回看</Text>
          <Text style={styles.copy}>这里只看经历和关系变化，不把成长做成面板。</Text>
        </ScrollView>
      )}

      {screen.overlay === "memory" ? (
        <View style={styles.sheet}>
          <Text style={styles.sectionTitle}>纸条</Text>
          <Text style={styles.copy}>这里放 reveal、确认、稍后、不对。</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setMemoryOpen(false)}>
            <Text style={styles.primaryButtonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {screen.overlay === "settings" ? (
        <View style={styles.sheet}>
          <Text style={styles.sectionTitle}>设置</Text>
          <Text style={styles.optionCopy}>Anthropic：{llmSettings ? maskApiKey(llmSettings.apiKey) : "未配置"}</Text>
          <Text style={styles.optionCopy}>模型：{llmSettings ? anthropicModelLabels[llmSettings.model] : "未配置"}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void reconfigureModel()}>
            <Text style={styles.secondaryButtonText}>重新配置模型</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.primaryButtonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 12,
    backgroundColor: "#F7F7F8",
  },
  shell: {
    flex: 1,
    backgroundColor: "#F7F7F8",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1D1F23",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  kicker: {
    fontSize: 12,
    color: "#7A818C",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1D1F23",
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5E6570",
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5E6570",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1F23",
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1D1F23",
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#EEF0F3",
    paddingHorizontal: 14,
    color: "#1D1F23",
  },
  textarea: {
    minHeight: 96,
    borderRadius: 14,
    backgroundColor: "#EEF0F3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1D1F23",
    textAlignVertical: "top",
  },
  option: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9DDE4",
    padding: 14,
    gap: 4,
  },
  optionActive: {
    borderColor: "#1D1F23",
    backgroundColor: "#F0F3F8",
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1F23",
  },
  optionCopy: {
    fontSize: 14,
    color: "#5E6570",
  },
  helperText: {
    fontSize: 13,
    color: "#5E6570",
  },
  errorText: {
    fontSize: 13,
    color: "#C53434",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9DDE4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  tagActive: {
    borderColor: "#1D1F23",
    backgroundColor: "#F0F3F8",
  },
  tagText: {
    color: "#1D1F23",
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#1D1F23",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonInline: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#1D1F23",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonSmall: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#1D1F23",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9DDE4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#1D1F23",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  ghostButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  ghostButtonText: {
    color: "#1D1F23",
    fontSize: 14,
    fontWeight: "600",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#E9EDF4",
  },
  tabText: {
    color: "#1D1F23",
    fontSize: 14,
    fontWeight: "600",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    gap: 10,
    paddingBottom: 20,
  },
  emptyText: {
    color: "#5E6570",
    fontSize: 15,
    lineHeight: 22,
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#1D1F23",
  },
  ocBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
  },
  messageText: {
    color: "#1D1F23",
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  composer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingTop: 12,
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1D1F23",
  },
  rewindView: {
    gap: 12,
  },
  sheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
