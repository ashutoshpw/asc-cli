/**
 * Version information
 * These are replaced at build time via --define flags
 */

// @ts-expect-error - replaced at build time
const BUILD_VERSION: string | undefined = process.env.BUILD_VERSION;
// @ts-expect-error - replaced at build time
const BUILD_DATE: string | undefined = process.env.BUILD_DATE;
// @ts-expect-error - replaced at build time
const BUILD_COMMIT: string | undefined = process.env.BUILD_COMMIT;

export const version: string = BUILD_VERSION ?? "0.1.0-dev";
export const buildDate: string | undefined = BUILD_DATE;
export const commit: string | undefined = BUILD_COMMIT;
