import { Link, useLocation } from "react-router-dom";
import { useAppCommandRunner } from "@/components/commands/AppCommandProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { WarcraftArt } from "./WarcraftArt";

export function WarcraftHeader() {
  const commands = useAppCommandRunner();
  const location = useLocation();
  return (
    <header className="wc-command-bar" aria-label="Main navigation">
      <WarcraftArt kind="header" />
      <div className="wc-brand-group">
        <SidebarTrigger className="wc-sidebar-toggle" />
        <Link to="/" className="wc-brand" aria-label="bb home">
          <span className="wc-wordmark">bb</span>
          <span className="wc-edition">WARCRAFT EDITION</span>
        </Link>
      </div>
      <nav className="wc-command-nav">
        <button
          type="button"
          data-wc-button
          onClick={(event) =>
            commands.dispatch("thread.new", event.currentTarget)
          }
        >
          <span data-wc-icon="swords" />
          <span>New Task</span>
        </button>
        <Link
          data-wc-button
          to="/settings/providers"
          aria-current={
            location.pathname === "/settings/providers" ? "page" : undefined
          }
        >
          <span data-wc-icon="orb" />
          <span>Agents</span>
        </Link>
        <Link
          data-wc-button
          to="/settings/projects"
          aria-current={
            location.pathname === "/settings/projects" ? "page" : undefined
          }
        >
          <span data-wc-icon="project" />
          <span>Projects</span>
        </Link>
        <button
          type="button"
          data-wc-button
          onClick={(event) =>
            commands.dispatch("settings.open", event.currentTarget)
          }
          aria-current={
            location.pathname.startsWith("/settings") &&
            !["/settings/providers", "/settings/projects"].includes(
              location.pathname,
            )
              ? "page"
              : undefined
          }
        >
          <span data-wc-icon="forge" />
          <span>Settings</span>
        </button>
      </nav>
    </header>
  );
}
