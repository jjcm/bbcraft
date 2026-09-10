// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeProviderInfo,
  makeThreadListEntry,
} from "@bb/test-helpers/domain-fixtures";
import { makeProjectResponse } from "@/test/fixtures/projects";
import {
  makeThreadResponse,
  makeThreadTimelineResponse,
} from "@/test/fixtures/thread-responses";
import { sdk } from "@/lib/sdk";
import { conversationRow } from "@/test/fixtures/thread-timeline-rows";
import { WarcraftApp } from "./WarcraftApp";

vi.mock("@/lib/sdk", () => ({
  sdk: {
    projects: { list: vi.fn() },
    providers: { list: vi.fn() },
    hosts: { list: vi.fn() },
    threads: {
      list: vi.fn(),
      get: vi.fn(),
      timeline: vi.fn(),
      spawn: vi.fn(),
      send: vi.fn(),
      stop: vi.fn(),
      interactions: { list: vi.fn() },
    },
  },
}));

const clients: QueryClient[] = [];
function mount(route = "/?thread=first") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <WarcraftApp />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(sdk.projects.list).mockResolvedValue([
    makeProjectResponse({ id: "project-a", name: "First project" }),
    makeProjectResponse({ id: "project-b", name: "Second project" }),
  ]);
  vi.mocked(sdk.providers.list).mockResolvedValue([
    makeProviderInfo({
      id: "agent-a",
      displayName: "First Agent",
      available: true,
    }),
    makeProviderInfo({
      id: "agent-b",
      displayName: "Second Agent",
      available: true,
    }),
  ]);
  vi.mocked(sdk.hosts.list).mockResolvedValue([]);
  vi.mocked(sdk.threads.list).mockResolvedValue([
    makeThreadListEntry({
      id: "first",
      title: "First quest",
      projectId: "project-a",
      providerId: "agent-a",
      status: "idle",
    }),
    makeThreadListEntry({
      id: "second",
      title: "Second quest",
      projectId: "project-a",
      providerId: "agent-a",
      status: "idle",
    }),
  ]);
  vi.mocked(sdk.threads.get).mockImplementation(async ({ threadId }) =>
    makeThreadResponse({
      id: threadId,
      title: threadId === "first" ? "First quest" : "Second quest",
      projectId: "project-a",
      providerId: "agent-a",
      status: "idle",
    }),
  );
  vi.mocked(sdk.threads.timeline).mockResolvedValue(
    makeThreadTimelineResponse(),
  );
  vi.mocked(sdk.threads.interactions.list).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.resetAllMocks();
  window.localStorage.clear();
  focusManager.setFocused(undefined);
});

describe("Warcraft conversation interface", () => {
  it("shows the completed reply when workspace preparation finishes in a background tab", async () => {
    focusManager.setFocused(false);
    vi.mocked(sdk.threads.get).mockResolvedValue(
      makeThreadResponse({
        id: "first",
        title: "First quest",
        status: "starting",
      }),
    );
    mount();
    await screen.findByText("Preparing your workspace…");
    vi.mocked(sdk.threads.get).mockResolvedValue(
      makeThreadResponse({ id: "first", title: "First quest", status: "idle" }),
    );
    vi.mocked(sdk.threads.timeline).mockResolvedValue(
      makeThreadTimelineResponse({
        rows: [
          conversationRow({ role: "assistant", text: "The forge is ready." }),
        ],
      }),
    );
    await screen.findByText("The forge is ready.", {}, { timeout: 6500 });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), {
      timeout: 6500,
    });
  });

  it("keeps a failed message available for retry without creating a duplicate task", async () => {
    vi.mocked(sdk.threads.send).mockRejectedValue(
      new Error("Agent connection unavailable"),
    );
    mount();
    await screen.findByRole("heading", { name: "First quest" });
    const prompt = screen.getByRole("textbox", { name: "Prompt" });
    fireEvent.change(prompt, { target: { value: "Keep this instruction" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "Agent connection unavailable",
    );
    expect(prompt).toHaveProperty("value", "Keep this instruction");
    expect(sdk.threads.send).toHaveBeenCalledWith({
      threadId: "first",
      input: [{ type: "text", text: "Keep this instruction", mentions: [] }],
      mode: "queue-if-active",
    });
    expect(sdk.threads.spawn).not.toHaveBeenCalled();
  });

  it("keeps separate unsent drafts when changing conversations", async () => {
    mount();
    await screen.findByRole("heading", { name: "First quest" });
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "First draft" },
    });
    for (const name of ["Agents", "Projects", "Settings"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      await screen.findByRole("heading", { name, level: 1 });
      expect(
        screen.queryByRole("complementary", { name: "Conversations" }),
      ).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: "Back to Chat" }));
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveProperty(
      "value",
      "First draft",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Second quest.*Agent:/ }),
    );
    await screen.findByRole("heading", { name: "Second quest" });
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveProperty(
      "value",
      "",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "Second draft" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /First quest.*Agent:/ }),
    );
    await screen.findByRole("heading", { name: "First quest" });
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveProperty(
      "value",
      "First draft",
    );
    expect(sdk.threads.send).not.toHaveBeenCalled();
  });

  it("creates a new task with the chosen project and agent", async () => {
    vi.mocked(sdk.threads.spawn).mockResolvedValue(
      makeThreadResponse({ id: "created" }),
    );
    mount("/?new=1");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Second project/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agents" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Second Agent.*Ready for your command/,
      }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "Quest title\nBuild the quest tracker." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sdk.threads.spawn).toHaveBeenCalledWith({
        projectId: "project-b",
        providerId: "agent-b",
        prompt: "Quest title\nBuild the quest tracker.",
        title: "Quest title",
        environment: { type: "project-default" },
        origin: "app",
      }),
    );
    expect(sdk.threads.send).not.toHaveBeenCalled();
  });
});
