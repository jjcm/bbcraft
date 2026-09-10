import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Square, ChevronLeft } from "lucide-react";
import { ClassicIcon } from "./ClassicIcon";
import { sdk } from "@/lib/sdk";
import type { TimelineSystemRow } from "@bb/server-contract";
import { ClassicArt } from "./ClassicArt";
import { windowSpring } from "./classic-motion";
import {
  AgentPanel,
  ClassicError,
  FilesPanel,
  InteractionPanel,
  ProjectPanel,
} from "./ClassicPanels";
import {
  conversationRows,
  displayTime,
  isWorking,
  threadTitle,
} from "./classic-data";
import "./classic.css";

type View = "chat" | "agents" | "projects" | "settings" | "files";

function readPreference(name: string, fallback: boolean) {
  try {
    return localStorage.getItem(name) === null
      ? fallback
      : localStorage.getItem(name) === "true";
  } catch {
    return fallback;
  }
}

export function WarcraftApp() {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const viewport = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const followTail = useRef(true);
  const [scale, setScale] = useState(1);
  const [view, setView] = useState<View>("chat");
  const [lighting, setLighting] = useState(() =>
    readPreference("bb.classic.lighting", true),
  );
  const [fit, setFit] = useState(() => readPreference("bb.classic.fit", true));
  const [entrance, setEntrance] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [chosenProject, setChosenProject] = useState("");
  const [chosenProvider, setChosenProvider] = useState("");
  const projects = useQuery({
    queryKey: ["classic", "projects"],
    queryFn: ({ signal }) => sdk.projects.list({ signal }),
    refetchInterval: 10000,
  });
  const providers = useQuery({
    queryKey: ["classic", "providers"],
    queryFn: ({ signal }) => sdk.providers.list({ signal }),
    staleTime: 30000,
  });
  const threads = useQuery({
    queryKey: ["classic", "threads"],
    queryFn: ({ signal }) =>
      sdk.threads.list({
        archived: false,
        hasParent: false,
        limit: 100,
        signal,
      }),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const threadId =
    params.get("new") === "1"
      ? null
      : params.get("thread") ||
        location.pathname.match(/\/threads\/([^/]+)/)?.[1] ||
        threads.data?.[0]?.id ||
        null;
  const thread = useQuery({
    queryKey: ["classic", "thread", threadId],
    queryFn: ({ signal }) => sdk.threads.get({ threadId: threadId!, signal }),
    enabled: Boolean(threadId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const working = isWorking(thread.data?.status);
  const timeline = useQuery({
    queryKey: ["classic", "timeline", threadId],
    queryFn: ({ signal }) =>
      sdk.threads.timeline({
        threadId: threadId!,
        segmentLimit: "100",
        signal,
      }),
    enabled: Boolean(threadId),
    refetchInterval: working ? 1000 : 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const interactions = useQuery({
    queryKey: ["classic", "interactions", threadId],
    queryFn: ({ signal }) =>
      sdk.threads.interactions.list({ threadId: threadId!, signal }),
    enabled: Boolean(threadId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const projectId =
    thread.data?.projectId || chosenProject || projects.data?.[0]?.id || "";
  const project = projects.data?.find((item) => item.id === projectId);
  const providerId =
    thread.data?.providerId ||
    chosenProvider ||
    providers.data?.find((item) => item.available)?.id ||
    "";
  const provider = providers.data?.find((item) => item.id === providerId);
  const draftKey = threadId || "new";
  const draft = drafts[draftKey] || "";
  const rows = conversationRows(timeline.data);
  const setup = timeline.data?.rows
    .slice()
    .reverse()
    .find(
      (row): row is TimelineSystemRow =>
        row.kind === "system" &&
        row.systemKind === "operation" &&
        row.operationKind === "thread-provisioning",
    );
  const errors = timeline.data?.rows.filter(
    (row): row is TimelineSystemRow =>
      row.kind === "system" && row.systemKind === "error",
  );
  const pending =
    interactions.data?.filter((item) => item.status === "pending") ?? [];
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["classic"] });
  };

  const send = useMutation({
    mutationFn: async ({
      id,
      text,
      project,
      provider,
    }: {
      id: string | null;
      text: string;
      project: string;
      provider: string;
    }) => {
      if (id) {
        await sdk.threads.send({
          threadId: id,
          input: [{ type: "text", text, mentions: [] }],
          mode: "queue-if-active",
        });
        return id;
      }
      const created = await sdk.threads.spawn({
        projectId: project,
        providerId: provider,
        prompt: text,
        title: threadTitle(text),
        environment: { type: "project-default" },
        origin: "app",
      });
      return created.id;
    },
    onSuccess: (id, variables) => {
      setDrafts((current) =>
        current[variables.id || "new"] === variables.text
          ? { ...current, [variables.id || "new"]: "" }
          : current,
      );
      followTail.current = true;
      navigate(`/?thread=${encodeURIComponent(id)}`);
      refresh();
    },
  });
  const stop = useMutation({
    mutationFn: () => sdk.threads.stop({ threadId: threadId! }),
    onSuccess: refresh,
  });

  useEffect(() => {
    const mount = viewport.current;
    if (!mount) return;
    const resize = new ResizeObserver(() =>
      setScale(
        Math.min(mount.clientWidth / 1920, mount.clientHeight / 1088, 1),
      ),
    );
    resize.observe(mount);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    document.title = `${thread.data?.title || "BBCraft 3"} · Warcraft Edition`;
  }, [thread.data?.title]);
  useEffect(() => {
    try {
      localStorage.setItem("bb.classic.lighting", String(lighting));
      localStorage.setItem("bb.classic.fit", String(fit));
    } catch {}
  }, [lighting, fit]);
  const resetSend = send.reset;
  useEffect(() => {
    followTail.current = true;
    resetSend();
  }, [threadId, resetSend]);
  useEffect(() => {
    if (view === "chat" && followTail.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [timeline.data, view, pending.length]);
  useEffect(() => {
    if (view !== "chat" && scroll.current) scroll.current.scrollTop = 0;
  }, [view]);
  const newChat = () => {
    setView("chat");
    navigate("/?new=1");
    requestAnimationFrame(() => composer.current?.focus());
  };
  const submit = () => {
    if (draft.trim() && !send.isPending && projectId && providerId && !working)
      send.mutate({
        id: threadId,
        text: draft,
        project: projectId,
        provider: providerId,
      });
  };
  const fullWidthMenu =
    view === "agents" || view === "projects" || view === "settings";
  const menuTitle =
    view === "agents"
      ? "Agents"
      : view === "projects"
        ? "Projects"
        : view === "settings"
          ? "Settings"
          : view === "files"
            ? "Project Files"
            : thread.data?.title ||
              (threadId ? "Opening conversation…" : "New Conversation");
  const screenScale = fit ? scale : 1;

  return (
    <div
      className={`classic-viewport${fit ? " is-fitted" : ""}`}
      ref={viewport}
    >
      <div
        className="classic-size"
        style={{ width: 1920 * screenScale, height: 1088 * screenScale }}
      >
        <main
          className="classic-stage"
          style={{ transform: `scale(${screenScale})` }}
          aria-label="BBCraft 3 workspace"
        >
          <div className="classic-backdrop" />
          <header className="classic-header">
            <ClassicArt
              asset="classic-header"
              width={1920}
              height={172}
              lighting={lighting}
            />
            <div className="classic-brand">
              <img src="/warcraft/crest.webp" alt="" />
              <span>BBCraft 3</span>
            </div>
            <nav aria-label="Main navigation">
              <button className="classic-nav-new" onClick={newChat}>
                <ClassicIcon name="plus" />
                <span>New Task</span>
              </button>
              <button
                className="classic-nav-agents"
                onClick={() => setView("agents")}
                aria-current={view === "agents" ? "page" : undefined}
              >
                <ClassicIcon name="wrench" />
                <span>Agents</span>
              </button>
              <button
                className="classic-nav-projects"
                onClick={() => setView("projects")}
                aria-current={view === "projects" ? "page" : undefined}
              >
                <ClassicIcon name="folder" />
                <span>Projects</span>
              </button>
              <button
                className="classic-nav-settings"
                onClick={() => setView("settings")}
                aria-current={view === "settings" ? "page" : undefined}
              >
                <ClassicIcon name="gear" />
                <span>Settings</span>
              </button>
            </nav>
          </header>
          <div className="classic-window-layer">
            {!fullWidthMenu && (
              <aside
                className="classic-left classic-hanging"
                style={{ animationTimingFunction: windowSpring }}
                key={`left-${entrance}`}
                aria-label="Conversations"
              >
                <ClassicArt
                  asset="classic-left"
                  width={560}
                  height={1088}
                  top={-172}
                  lighting={lighting}
                />
                <h2 className="classic-conversations-title">
                  <ClassicIcon name="chat" />
                  <span>Conversations</span>
                </h2>
                <div className="classic-conversation-list">
                  <ClassicError error={threads.error} />
                  {threads.isPending && (
                    <p className="classic-list-notice">
                      Opening conversations…
                    </p>
                  )}
                  {threads.data?.map((item) => (
                    <button
                      key={item.id}
                      className={`classic-conversation${threadId === item.id ? " is-selected" : ""}`}
                      onClick={() => {
                        navigate(`/?thread=${encodeURIComponent(item.id)}`);
                        setView("chat");
                      }}
                      aria-current={threadId === item.id ? "true" : undefined}
                    >
                      <img src="/warcraft/classic-sword.webp" alt="" />
                      <span className="classic-conversation-copy">
                        <strong>
                          {item.title ||
                            item.titleFallback ||
                            "New conversation"}
                        </strong>
                        <small>
                          Agent:{" "}
                          {providers.data?.find(
                            (agent) => agent.id === item.providerId,
                          )?.displayName || item.providerId}
                        </small>
                      </span>
                      <time>
                        {isWorking(item.status)
                          ? "Working…"
                          : displayTime(item.updatedAt)}
                      </time>
                    </button>
                  ))}
                  {threads.data?.length === 0 && (
                    <p className="classic-list-notice">
                      Your conversations will appear here.
                    </p>
                  )}
                </div>
                <button className="classic-new-chat" onClick={newChat}>
                  <ClassicIcon name="plus" />
                  <span>New Chat</span>
                </button>
              </aside>
            )}
            <section
              className={`classic-main classic-hanging${fullWidthMenu ? " classic-menu-window" : ""}`}
              style={{ animationTimingFunction: windowSpring }}
              key={`main-${fullWidthMenu ? view : "chat"}-${entrance}`}
              aria-label={
                fullWidthMenu ? `${menuTitle} window` : "Conversation window"
              }
            >
              <ClassicArt
                asset={fullWidthMenu ? "classic-menu" : "classic-main"}
                width={fullWidthMenu ? 1920 : 1360}
                height={1088}
                top={-172}
                lighting={lighting}
              />
              {fullWidthMenu ? (
                <div className="classic-menu-heading">
                  <ClassicIcon
                    name={
                      view === "agents"
                        ? "wrench"
                        : view === "projects"
                          ? "folder"
                          : "gear"
                    }
                  />
                  <h1>{menuTitle}</h1>
                </div>
              ) : (
                <div className="classic-thread-heading">
                  <img
                    className="classic-thread-emblem"
                    src="/warcraft/classic-sword.webp"
                    alt=""
                  />
                  <h1>{menuTitle}</h1>
                  <div className="classic-thread-meta">
                    <button onClick={() => setView("agents")}>
                      Agent: {provider?.displayName || "Choose an agent"}
                    </button>
                    <span>•</span>
                    <button onClick={() => setView("projects")}>
                      Project: {project?.name || "Choose a project"}
                    </button>
                  </div>
                  <ClassicIcon name="scroll" className="classic-files-icon" />
                  <button
                    className="classic-view-files"
                    onClick={() => setView(view === "chat" ? "files" : "chat")}
                    disabled={!projectId}
                  >
                    {view === "chat" ? "View Files" : "Back to Chat"}
                  </button>
                </div>
              )}
              <div
                className="classic-content"
                ref={scroll}
                onScroll={() => {
                  const el = scroll.current;
                  if (view === "chat" && el)
                    followTail.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < 70;
                }}
              >
                {view === "chat" && (
                  <>
                    <ClassicError
                      error={
                        thread.error || timeline.error || interactions.error
                      }
                    />
                    {!threadId && (
                      <div className="classic-new-conversation">
                        <h2>New Conversation</h2>
                        <p>Type your prompt below to begin.</p>
                        <p>
                          Your agent will work in{" "}
                          <button onClick={() => setView("projects")}>
                            {project?.name || "a project you choose"}
                          </button>
                          .
                        </p>
                      </div>
                    )}
                    {threadId && timeline.isPending && (
                      <p className="classic-list-notice">
                        Opening conversation…
                      </p>
                    )}
                    {rows.map((row, index) => (
                      <article
                        key={row.id}
                        className={`classic-message ${row.role === "user" ? "is-user" : "is-agent"}${index === rows.length - 1 ? " is-last" : ""}`}
                      >
                        <div className="classic-avatar">
                          {row.role === "user" ? (
                            <ClassicIcon name="user" />
                          ) : (
                            <ClassicIcon name="gear" />
                          )}
                        </div>
                        <div className="classic-message-body">
                          <h2>
                            {row.role === "user"
                              ? "You"
                              : `${provider?.displayName || "Agent"} (Agent)`}
                          </h2>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {row.text}
                          </ReactMarkdown>
                        </div>
                        <time>{displayTime(row.createdAt)}</time>
                      </article>
                    ))}
                    {pending.map((interaction) => (
                      <InteractionPanel
                        key={interaction.id}
                        interaction={interaction}
                        onResolved={refresh}
                      />
                    ))}
                    {errors?.map((row) => (
                      <p className="classic-error" role="alert" key={row.id}>
                        {row.title}
                        {row.detail ? `: ${row.detail}` : ""}
                      </p>
                    ))}
                    {thread.data?.status === "starting" && setup?.detail && (
                      <details className="classic-setup-log">
                        <summary>Workspace setup progress</summary>
                        <pre>{setup.detail}</pre>
                      </details>
                    )}
                    {working && (
                      <div className="classic-progress" role="status">
                        <ClassicIcon name="gear" />
                        <span>
                          {thread.data?.status === "starting"
                            ? "Preparing your workspace…"
                            : "Your agent is working…"}
                        </span>
                        <button
                          onClick={() => stop.mutate()}
                          disabled={stop.isPending}
                        >
                          <Square /> Stop
                        </button>
                      </div>
                    )}
                    {thread.data?.status === "error" && (
                      <p className="classic-error">
                        The agent stopped with an error. Send a follow-up to
                        retry.
                      </p>
                    )}
                    <ClassicError error={send.error || stop.error} />
                  </>
                )}
                {view === "agents" && (
                  <>
                    <ClassicError error={providers.error} />
                    <AgentPanel
                      providers={providers.data || []}
                      selected={providerId}
                      onSelect={(id) => {
                        setChosenProvider(id);
                        if (projectId) setChosenProject(projectId);
                        newChat();
                      }}
                    />
                  </>
                )}
                {view === "projects" && (
                  <>
                    <ClassicError error={projects.error} />
                    <ProjectPanel
                      projects={projects.data || []}
                      selected={projectId}
                      onSelect={(id) => {
                        setChosenProject(id);
                        newChat();
                      }}
                    />
                  </>
                )}
                {view === "files" && (
                  <FilesPanel
                    projectId={projectId}
                    environmentId={thread.data?.environmentId || null}
                  />
                )}
                {view === "settings" && (
                  <section className="classic-menu-page classic-settings">
                    <h2>Menu Settings</h2>
                    <label>
                      <input
                        type="checkbox"
                        checked={lighting}
                        onChange={(event) => setLighting(event.target.checked)}
                      />
                      <span>
                        Dynamic lighting
                        <small>
                          Light follows your cursor across the iron, wood and
                          enamel.
                        </small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={fit}
                        onChange={(event) => setFit(event.target.checked)}
                      />
                      <span>
                        Fit window
                        <small>
                          Scale the 1920 × 1088 scene as a whole. Turn off for
                          actual size.
                        </small>
                      </span>
                    </label>
                    <button
                      className="classic-small-button"
                      onClick={() => setEntrance((value) => value + 1)}
                    >
                      Replay window entrance
                    </button>
                  </section>
                )}
              </div>
              {fullWidthMenu ? (
                <button
                  className="classic-menu-back"
                  onClick={() => setView("chat")}
                >
                  <ChevronLeft /> Back to Chat
                </button>
              ) : (
                <form
                  className="classic-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                  }}
                >
                  <ClassicIcon
                    name="scroll"
                    className="classic-composer-icon"
                  />
                  {view === "chat" ? (
                    <textarea
                      ref={composer}
                      aria-label="Prompt"
                      placeholder="Type your prompt or instruction…"
                      value={draft}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [draftKey]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          submit();
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="classic-return"
                      onClick={() => setView("chat")}
                    >
                      <ChevronLeft /> Return to your conversation
                    </button>
                  )}
                  <button
                    className="classic-send"
                    type="submit"
                    disabled={
                      view !== "chat" ||
                      !draft.trim() ||
                      send.isPending ||
                      working ||
                      !projectId ||
                      !providerId
                    }
                  >
                    <ClassicIcon name="send" />
                    <span>{send.isPending ? "Sending…" : "Send"}</span>
                  </button>
                </form>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
