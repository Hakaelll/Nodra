"use client";
import { useSyncExternalStore } from "react";
import {
  readWorkspaceRoute,
  workspaceHref,
  type WorkspaceRoute,
} from "./workspace-route";
const changed = "nodra:route";
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(changed, notify);
  };
}
export function useWorkspaceRoute() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return readWorkspaceRoute(search);
}
export function navigateWorkspace(
  route: WorkspaceRoute,
  replace = false,
  preserveInvite = true,
) {
  const href =
    workspaceHref(route) + (preserveInvite ? window.location.hash : "");
  if (
    href ===
    window.location.pathname + window.location.search + window.location.hash
  )
    return;
  window.history[replace ? "replaceState" : "pushState"](
    window.history.state,
    "",
    href,
  );
  window.dispatchEvent(new Event(changed));
}
