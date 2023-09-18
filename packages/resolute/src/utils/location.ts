import { LocationInfo } from '../types.js';
import { withLeadingAndTrailingSlash } from './paths.js';

export const getLocationInfo = (href: string): LocationInfo => {
  const url = new URL(href);

  return {
    hash: url.hash,
    host: url.host,
    hostname: url.hostname,
    href: url.href,
    origin: url.origin,
    pathname: withLeadingAndTrailingSlash(url.pathname),
    port: url.port,
    protocol: url.protocol,
    search: url.search,
  };
};
