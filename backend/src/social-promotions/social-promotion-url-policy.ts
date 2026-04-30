import { SocialPromotionNetwork } from './entities/social-promotion.entity';

const SUPPORTED_PROTOCOL = 'https:';

const NETWORK_BASE_DOMAINS: Record<SocialPromotionNetwork, string[]> = {
  [SocialPromotionNetwork.FACEBOOK]: ['facebook.com'],
  [SocialPromotionNetwork.INSTAGRAM]: ['instagram.com'],
  [SocialPromotionNetwork.X]: ['x.com', 'twitter.com'],
};

function matchesDomainOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  url.hostname = url.hostname.toLowerCase();
  return url;
}

function findNetworkForHostname(
  hostname: string,
): SocialPromotionNetwork | undefined {
  return (
    Object.entries(NETWORK_BASE_DOMAINS) as Array<
      [SocialPromotionNetwork, string[]]
    >
  ).find(([, domains]) =>
    domains.some((domain) => matchesDomainOrSubdomain(hostname, domain)),
  )?.[0];
}

export function assertSupportedSocialPromotionUrl(
  rawUrl: string,
  expectedNetwork?: SocialPromotionNetwork,
): {
  url: URL;
  network: SocialPromotionNetwork;
} {
  const url = normalizeUrl(rawUrl);

  if (url.protocol !== SUPPORTED_PROTOCOL) {
    throw new Error(`Unsupported social promotion protocol: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error('Unsupported social promotion credentials in URL');
  }

  if (url.port) {
    throw new Error(`Unsupported social promotion port: ${url.port}`);
  }

  const network = findNetworkForHostname(url.hostname);

  if (!network) {
    throw new Error(`Unsupported social promotion host: ${url.hostname}`);
  }

  if (expectedNetwork && network !== expectedNetwork) {
    throw new Error(
      `Social promotion URL does not match expected network: ${url.hostname}`,
    );
  }

  return { url, network };
}

export function detectSocialPromotionNetworkFromUrl(
  rawUrl: string,
): SocialPromotionNetwork {
  return assertSupportedSocialPromotionUrl(rawUrl).network;
}
