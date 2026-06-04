// @ts-check

/**
 * A tool the reasoning model may call. Mirrors the `@qvac/sdk` completion() tools
 * shape so the SDK adapter stays a thin mapping.
 * @typedef {object} ToolSpec
 * @property {string} name
 * @property {string} description
 * @property {Record<string, unknown>} [parameters]
 */

/**
 * @typedef {object} ToolCall
 * @property {string} name
 * @property {Record<string, unknown>} arguments
 */

/**
 * @typedef {object} CompletionRequest
 * @property {string} system
 * @property {string} prompt
 * @property {ToolSpec[]} [tools]
 */

/**
 * @typedef {object} CompletionResult
 * @property {string} text
 * @property {ToolCall[]} [toolCalls]
 */

/**
 * The reasoning-model interface. The pipeline depends on this, never on `@qvac/sdk`
 * directly, so the SDK is a single pluggable adapter and the orchestration stays
 * testable with a mock.
 * @typedef {object} ReasoningModel
 * @property {(request: CompletionRequest) => Promise<CompletionResult>} complete
 */

export {};
