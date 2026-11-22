import pkg from "../../package.json";

/**
 * The running build. APP_COMMIT / APP_BUILT_AT are baked into the production image by
 * ops/deploy.sh; in development they are unset ("dev").
 */
export const appVersion = {
  version: pkg.version,
  commit: process.env.APP_COMMIT || "dev",
  builtAt: process.env.APP_BUILT_AT || null,
};

export const isProductionBuild = appVersion.commit !== "dev";
