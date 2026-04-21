import { createRemoteJWKSet, jwtVerify } from "jose";
import { Issuer as OpenIdIssuer } from "openid-client";
import type { Config } from "../config.js";
import type { Issuer } from "openid-client";

let issuerCache: Issuer | null = null;

export async function getIssuer(config: Config): Promise<Issuer> {
  if (!config.OIDC_ISSUER) throw new Error("OIDC_ISSUER not set");
  if (issuerCache) return issuerCache;
  issuerCache = await OpenIdIssuer.discover(config.OIDC_ISSUER);
  return issuerCache;
}

export function isOidcConfigured(config: Config): boolean {
  return !!(
    config.OIDC_ISSUER &&
    config.OIDC_CLIENT_ID &&
    config.OIDC_CLIENT_SECRET &&
    config.OIDC_REDIRECT_URI
  );
}

/**
 * Validates id_token JWT using issuer JWKS (defense in depth after token exchange).
 */
export async function verifyIdTokenJwt(
  config: Config,
  idToken: string,
): Promise<Record<string, unknown>> {
  if (!config.OIDC_ISSUER || !config.OIDC_CLIENT_ID) {
    throw new Error("OIDC not configured");
  }
  const issuer = await getIssuer(config);
  const jwksUri = issuer.metadata.jwks_uri;
  if (!jwksUri || typeof jwksUri !== "string") {
    throw new Error("Issuer metadata missing jwks_uri");
  }
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: config.OIDC_ISSUER,
    audience: config.OIDC_CLIENT_ID,
  });
  return payload as Record<string, unknown>;
}

const AMR_SPLIT = /\s+/;

export function isMfaSatisfiedFromClaims(
  config: Config,
  claims: Record<string, unknown>,
): boolean {
  const amr = claims.amr;
  const acr = typeof claims.acr === "string" ? claims.acr : "";
  const allowedAmr = new Set(
    config.OIDC_MFA_AMR_VALUES.split(AMR_SPLIT).filter(Boolean),
  );
  if (Array.isArray(amr)) {
    for (const v of amr) {
      if (typeof v === "string" && allowedAmr.has(v)) return true;
    }
  }
  if (config.OIDC_MFA_ACR_HINT && acr.includes(config.OIDC_MFA_ACR_HINT)) {
    return true;
  }
  return false;
}
