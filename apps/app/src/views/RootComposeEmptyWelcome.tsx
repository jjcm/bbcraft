import { Icon, type IconName } from "@bb/shared-ui/icon";
import { WarcraftArt } from "@/components/warcraft/WarcraftArt";

interface RootComposeEmptyWelcomeProps {
  onCompose: (prompt?: string) => void;
  onAddProject: () => void;
  addProjectDisabled?: boolean;
}

const IMPORT_PROJECTS_PROMPT =
  "Search my home directory (max depth 3) for git repositories touched in the last 30 days and import only those projects into bb using the cli";

const LEARN_PROMPT =
  "What can bb do, and how can you (my agent) interact with it? Summarize bb's capabilities and how you'd use the bb CLI to work with threads and projects.";

interface WelcomeActionProps {
  icon: IconName;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function WelcomeAction({
  icon,
  title,
  description,
  onClick,
  disabled,
}: WelcomeActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon
        name={icon}
        aria-hidden
        className="size-5 shrink-0 text-subtle-foreground group-hover:text-foreground"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export function RootComposeEmptyWelcome({
  onCompose,
  onAddProject,
  addProjectDisabled,
}: RootComposeEmptyWelcomeProps) {
  return (
    <div className="wc-welcome">
      <WarcraftArt kind="crest" />
      <h1>Your next quest awaits.</h1>
      <p className="wc-welcome-intro">
        Gather your agents. Open a project. Build something worthy of your name.
      </p>
      <div className="wc-welcome-actions">
        <WelcomeAction
          icon="MessageSquarePlus"
          title="Begin a new task"
          description="Start a new conversation"
          onClick={() => onCompose()}
        />
        <WelcomeAction
          icon="FolderGit"
          title="Discover your projects"
          description="Find repos touched in the last 30 days"
          onClick={() => onCompose(IMPORT_PROJECTS_PROMPT)}
        />
        <WelcomeAction
          icon="FolderPlus"
          title="New project"
          description="Create one from a local folder"
          onClick={onAddProject}
          disabled={addProjectDisabled}
        />
        <WelcomeAction
          icon="Explore"
          title="Learn what bb can do"
          description="Get a tour of its capabilities"
          onClick={() => onCompose(LEARN_PROMPT)}
        />
      </div>
    </div>
  );
}
