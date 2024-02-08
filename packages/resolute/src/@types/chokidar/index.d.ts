import 'chokidar';

declare module 'chokidar' {
  export interface FSWatcher {
    ref: () => this;
    unref: () => this;
  }
}
