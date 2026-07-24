/**
 * Free-tier reporter registration.
 */

import type { Registries } from "../core/registry.js";
import { consoleReporter, createConsoleReporter } from "./console.js";
import { junitReporter, createJUnitReporter } from "./junit.js";
import { githubReporter, createGitHubReporter } from "./github.js";

export function registerFreeReporters(registries: Registries): void {
  registries.reporters.register(consoleReporter.name, consoleReporter, { override: true });
  registries.reporters.register(junitReporter.name, junitReporter, { override: true });
  registries.reporters.register(githubReporter.name, githubReporter, { override: true });
}

export {
  consoleReporter,
  junitReporter,
  githubReporter,
  createConsoleReporter,
  createJUnitReporter,
  createGitHubReporter,
};
