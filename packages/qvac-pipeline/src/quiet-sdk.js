// @ts-check

/**
 * Lower the QVAC SDK's console log level so the desk's own output stays readable. The SDK
 * and its inference worker otherwise print init, model-registry, and request-lifecycle
 * lines to stdout, which bury the review report (and clutter a screen-recorded demo).
 * Errors and warnings still surface at the `error`/`warn` levels.
 *
 * The level control lives in the SDK's `logging` subpath; it is imported defensively so a
 * future SDK layout change degrades to noisier output rather than failing the run. The
 * environment-variable path (`QVAC_LOG_LEVEL`) does not reach the worker, so this sets the
 * level through the SDK's own process-wide registry instead.
 *
 * @param {'error' | 'warn' | 'info' | 'debug' | 'off'} [level]
 */
export async function quietSdkLogs(level = 'error') {
  try {
    const logging = await import('@qvac/sdk/logging');
    logging.setGlobalLogLevel?.(level);
  } catch {
    /* logging subpath unavailable; leave SDK logging at its default */
  }
}
