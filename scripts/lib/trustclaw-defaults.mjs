/** TrustClaw product defaults (OpenClaw fork). */
export const TRUSTCLAW_DEFAULT_GATEWAY_PORT = "19001";
export const TRUSTCLAW_DEFAULT_UI_PORT = "5174";

export function resolveTrustclawGatewayPort(env = process.env) {
  return (
    env.OPENCLAW_GATEWAY_PORT ?? env.TRUSTCLAW_GATEWAY_PORT ?? TRUSTCLAW_DEFAULT_GATEWAY_PORT
  );
}
