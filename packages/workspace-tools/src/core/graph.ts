// The workspace as a graph of releasable projects. Built from parsed manifest
// data (not the filesystem) so the graph algorithms below are pure and testable.

export interface Project {
  // Package name (npm), crate name, or module id.
  name: string;
  // Repo-relative directory that owns this project.
  dir: string;
  // Repo-relative path to its native manifest.
  manifest: string;
  version: string;
  // Names of the other projects in this graph it depends on (resolved edges).
  deps: string[];
  // For a module: the raw dependency ranges it declares (name → semver range).
  ranges?: Record<string, string>;
  // For a client/module: the minimum server version it requires.
  minServer?: string;
}

export interface Graph {
  projects: Project[];
  // The server project, if present — the target of every `minServer` check.
  server?: Project;
}

export function byName(graph: Graph): Map<string, Project> {
  return new Map(graph.projects.map((p) => [p.name, p]));
}

// name → the projects that depend on it (reverse edges), for affected-set walks.
export function dependents(graph: Graph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const project of graph.projects) {
    for (const dep of project.deps) {
      const list = map.get(dep);
      if (list) list.push(project.name);
      else map.set(dep, [project.name]);
    }
  }
  return map;
}
