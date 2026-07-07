/**
 * URL of the published JSON Schema for the export file, derived from wherever
 * the app is currently served so forks and self-hosts emit their own address.
 * `BASE_URL` always ends in a slash, so the filename is appended directly.
 */
export const projectSchemaUrl = (): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}project-planner.schema.json`;
