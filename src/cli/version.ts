/**
 * Version information
 * These are replaced at build time via --define flags
 */

const BUILD_VERSION: string | undefined = process.env.BUILD_VERSION;
const BUILD_DATE: string | undefined = process.env.BUILD_DATE;
const BUILD_COMMIT: string | undefined = process.env.BUILD_COMMIT;

export const version: string = BUILD_VERSION ?? "0.1.0-dev";
export const buildDate: string | undefined = BUILD_DATE;
export const commit: string | undefined = BUILD_COMMIT;
