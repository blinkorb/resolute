import { config as dotenvConfig } from 'dotenv';

import { MATCHES_TRAILING_SLASH } from '../../constants.js';

export class EnvHandler {
  private watch: boolean;
  private serveHttps: boolean;
  private dotenvParsed: Record<string, string> | undefined;
  public port!: number;
  public hostname!: string;
  public url!: string;
  public apiUrl!: string;
  public buildPort!: number;
  public buildHostname!: string;
  public buildUrl!: string;
  public buildApiUrl!: string;
  private initialEnv: Record<string, string | undefined>;

  public constructor(
    watch: boolean | undefined,
    serveHttps: boolean | undefined
  ) {
    this.watch = !!watch;
    this.serveHttps = !!serveHttps;

    this.initialEnv = [
      'NODE_ENV',
      'PORT',
      'HOSTNAME',
      'URL',
      'API_URL',
      'BUILD_PORT',
      'BUILD_HOSTNAME',
      'BUILD_URL',
      'BUILD_API_URL',
    ].reduce(
      (acc, key) => ({
        ...acc,
        [key]: process.env[key],
      }),
      {}
    );

    this.refresh();
  }

  public refresh() {
    Object.entries(this.initialEnv).forEach(([key, value]) => {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    Object.keys(this.dotenvParsed || {}).forEach((key) => {
      delete process.env[key];
    });

    const { parsed } = dotenvConfig();

    this.dotenvParsed = parsed;

    const httpsS = this.serveHttps ? 's' : '';

    // Set environment variables
    this.port = process.env.PORT
      ? parseInt(process.env.PORT, 10) || 3000
      : 3000;
    this.hostname = process.env.HOSTNAME || '0.0.0.0';
    this.url = (
      process.env.URL || `http${httpsS}://${this.hostname}:${this.port}`
    ).replace(MATCHES_TRAILING_SLASH, '');
    this.apiUrl = process.env.API_URL || `${this.url}/api/`;

    this.buildPort = process.env.BUILD_PORT
      ? parseInt(process.env.BUILD_PORT, 10) || 4000
      : 4000;
    this.buildHostname = process.env.BUILD_HOSTNAME || 'localhost';
    this.buildUrl = (
      process.env.BUILD_URL || `http://${this.buildHostname}:${this.buildPort}`
    ).replace(MATCHES_TRAILING_SLASH, '');
    this.buildApiUrl = process.env.BUILD_API_URL || `${this.buildUrl}/api/`;
  }

  public setupMainEnv() {
    this.refresh();

    process.env.NODE_ENV = this.watch ? 'development' : 'production';
    process.env.HOSTNAME = this.hostname;
    process.env.PORT = this.port.toString();
    process.env.URL = this.url;
    process.env.API_URL = this.apiUrl;
  }

  public setupBuildEnv() {
    this.refresh();

    process.env.NODE_ENV = this.watch ? 'development' : 'production';
    process.env.HOSTNAME = this.buildHostname;
    process.env.PORT = this.buildPort.toString();
    process.env.URL = this.buildUrl;
    process.env.API_URL = this.buildApiUrl;
  }
}
