import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PendingInteraction,
  PendingInteractionUserAnswer,
} from "@bb/domain";
import type { ProjectResponse, SystemProviderInfo } from "@bb/server-contract";
import { Folder, FileText, ChevronLeft, Check, Settings } from "lucide-react";
import { sdk } from "@/lib/sdk";

export function ClassicError({ error }: { error: Error | null }) {
  return error ? (
    <p className="classic-error" role="alert">
      {error.message}
    </p>
  ) : null;
}

export function AgentPanel({
  providers,
  selected,
  onSelect,
}: {
  providers: SystemProviderInfo[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="classic-menu-page">
      <h2>Choose your agent</h2>
      <p>Select an agent for your next conversation.</p>
      <div className="classic-agent-grid">
        {providers.map((provider) => (
          <button
            key={provider.id}
            className="classic-choice"
            disabled={!provider.available}
            onClick={() => onSelect(provider.id)}
          >
            <Settings className="classic-gold-icon" />
            <span>
              <strong>{provider.displayName}</strong>
              <small>
                {provider.available
                  ? "Ready for your command"
                  : "Not available on this machine"}
              </small>
            </span>
            {provider.id === selected && <Check aria-label="Selected" />}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ProjectPanel({
  projects,
  selected,
  onSelect,
}: {
  projects: ProjectResponse[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const client = useQueryClient();
  const hosts = useQuery({
    queryKey: ["classic", "hosts"],
    queryFn: ({ signal }) => sdk.hosts.list({ signal }),
  });
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [host, setHost] = useState("");
  const create = useMutation({
    mutationFn: () =>
      sdk.projects.create({
        name: name.trim(),
        source: {
          type: "local_path",
          path: path.trim(),
          hostId: host || hosts.data?.[0]?.id || "",
        },
      }),
    onSuccess: (project) => {
      void client.invalidateQueries({ queryKey: ["classic", "projects"] });
      onSelect(project.id);
    },
  });
  return (
    <section className="classic-menu-page">
      <h2>Your projects</h2>
      <p>Choose a project to begin a new conversation.</p>
      <div className="classic-project-list">
        {projects.map((project) => (
          <button
            className="classic-choice"
            key={project.id}
            onClick={() => onSelect(project.id)}
          >
            <Folder className="classic-gold-icon" />
            <span>
              <strong>{project.name}</strong>
              <small>
                {project.sources[0]?.type === "local_path"
                  ? project.sources[0].path
                  : ""}
              </small>
            </span>
            {selected === project.id && <Check aria-label="Selected" />}
          </button>
        ))}
      </div>
      <form
        className="classic-project-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && path.trim()) create.mutate();
        }}
      >
        <h3>Add a project</h3>
        <label>
          Project name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Warcraft 3 Mod"
          />
        </label>
        <label>
          Folder path
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            required
            placeholder="/path/to/your/project"
          />
        </label>
        <label>
          Machine
          <select
            value={host || hosts.data?.[0]?.id || ""}
            onChange={(event) => setHost(event.target.value)}
          >
            {hosts.data?.map((machine) => (
              <option value={machine.id} key={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="classic-small-button"
          disabled={create.isPending || !hosts.data?.length}
        >
          {" "}
          {create.isPending ? "Opening…" : "Open Project"}
        </button>
        <ClassicError error={create.error || hosts.error} />
      </form>
    </section>
  );
}

export function FilesPanel({
  projectId,
  environmentId,
}: {
  projectId: string;
  environmentId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const files = useQuery({
    queryKey: ["classic", "files", projectId, environmentId, query],
    queryFn: ({ signal }) => {
      const request = {
        projectId,
        ...(query.trim() ? { query: query.trim() } : {}),
        limit: "200",
        signal,
      };
      return environmentId
        ? sdk.projects.files({ ...request, environmentId })
        : sdk.projects.files(request);
    },
    enabled: Boolean(projectId),
  });
  const file = useQuery({
    queryKey: ["classic", "file", projectId, environmentId, path],
    queryFn: ({ signal }) => {
      const request = { projectId, path: path!, signal };
      return environmentId
        ? sdk.projects.fileContent({ ...request, environmentId })
        : sdk.projects.fileContent(request);
    },
    enabled: Boolean(path && projectId),
  });
  return (
    <section className="classic-menu-page classic-files">
      {path ? (
        <>
          <button className="classic-text-button" onClick={() => setPath(null)}>
            <ChevronLeft /> Back to files
          </button>
          <h3>{path}</h3>
          <ClassicError error={file.error} />
          {file.isPending ? (
            <p>Reading file…</p>
          ) : file.data?.contentEncoding === "utf8" ? (
            <pre>{file.data.content}</pre>
          ) : (
            <p>This file is binary and cannot be shown as text.</p>
          )}
        </>
      ) : (
        <>
          <h2>Project files</h2>
          <input
            className="classic-file-search"
            placeholder="Find a file…"
            aria-label="Find a file"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ClassicError error={files.error} />
          {files.isPending ? (
            <p>Opening project files…</p>
          ) : (
            <div className="classic-file-list">
              {files.data?.files.map((file) => (
                <button key={file.path} onClick={() => setPath(file.path)}>
                  <FileText />
                  <span>{file.path}</span>
                </button>
              ))}
            </div>
          )}
          {files.data?.files.length === 0 && <p>No files found.</p>}
          {files.data?.truncated && (
            <p>Showing the first 200 files. Search to narrow the list.</p>
          )}
        </>
      )}
    </section>
  );
}

export function InteractionPanel({
  interaction,
  onResolved,
}: {
  interaction: PendingInteraction;
  onResolved: () => void;
}) {
  const [answers, setAnswers] = useState<
    Record<string, PendingInteractionUserAnswer>
  >({});
  const resolve = useMutation({
    mutationFn: (
      resolution: Parameters<
        typeof sdk.threads.interactions.resolve
      >[0]["resolution"],
    ) =>
      sdk.threads.interactions.resolve({
        threadId: interaction.threadId,
        interactionId: interaction.id,
        resolution,
      }),
    onSuccess: onResolved,
  });
  const payload = interaction.payload;
  return (
    <section className="classic-interaction">
      <h3>Your agent needs a decision</h3>
      {payload.kind === "approval" ? (
        <>
          <p>
            {payload.reason || "Review the requested action before continuing."}
          </p>
          <pre>{JSON.stringify(payload.subject, null, 2)}</pre>
          <div className="classic-decision-actions">
            {payload.availableDecisions.map((decision) => (
              <button
                className="classic-small-button"
                key={decision}
                disabled={resolve.isPending}
                onClick={() =>
                  resolve.mutate(
                    decision === "deny"
                      ? { decision }
                      : { decision, grantedPermissions: null },
                  )
                }
              >
                {decision === "deny"
                  ? "Deny"
                  : decision === "allow_once"
                    ? "Allow once"
                    : "Allow for session"}
              </button>
            ))}
          </div>
        </>
      ) : payload.kind === "user_question" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            resolve.mutate({ kind: "user_answer", answers });
          }}
        >
          {payload.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.prompt}</legend>
              {question.options?.map((option) => (
                <label key={option.value}>
                  <input
                    type={question.multiSelect ? "checkbox" : "radio"}
                    name={question.id}
                    checked={
                      answers[question.id]?.selected.includes(option.value) ??
                      false
                    }
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: {
                          ...current[question.id],
                          selected: question.multiSelect
                            ? event.target.checked
                              ? [
                                  ...(current[question.id]?.selected ?? []),
                                  option.value,
                                ]
                              : (current[question.id]?.selected ?? []).filter(
                                  (value) => value !== option.value,
                                )
                            : [option.value],
                        },
                      }))
                    }
                  />
                  {option.label}
                </label>
              ))}
              {question.allowFreeText && (
                <input
                  aria-label={question.prompt}
                  value={answers[question.id]?.freeText ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: {
                        ...current[question.id],
                        selected: current[question.id]?.selected ?? [],
                        freeText: event.target.value,
                      },
                    }))
                  }
                />
              )}
            </fieldset>
          ))}
          <button className="classic-small-button" disabled={resolve.isPending}>
            Continue
          </button>
        </form>
      ) : (
        <p>
          This request requires the provider's own controls. You can stop the
          task or inspect it through the bb CLI.
        </p>
      )}
      <ClassicError error={resolve.error} />
    </section>
  );
}
