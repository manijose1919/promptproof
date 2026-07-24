/**
 * Free-tier assertion registration.
 *
 * `registerFreeAssertions` is called by the core wiring (src/index.ts). Paid
 * assertions (similarity, llm-judge) are registered separately by the Premium module.
 */

import type { Registries } from "../core/registry.js";
import { equalsAssertion } from "./equals.js";
import { containsAssertion } from "./contains.js";
import { regexAssertion } from "./regex.js";
import { jsonSchemaAssertion } from "./json-schema.js";

export const freeAssertions = [
  equalsAssertion,
  containsAssertion,
  regexAssertion,
  jsonSchemaAssertion,
];

export function registerFreeAssertions(registries: Registries): void {
  for (const assertion of freeAssertions) {
    registries.assertions.register(assertion.type, assertion, { override: true });
  }
}

export { equalsAssertion, containsAssertion, regexAssertion, jsonSchemaAssertion };
