import type { IDependency, IModule } from 'dependency-cruiser';

import type { EnvHandler } from './env-handler.js';

export interface LayoutInfo {
  pathname: string;
  route: string;
  depth: number;
}

export interface RouteInfoWithLayoutInfo {
  page?: string;
  client?: string;
  static?: string;
  markdown?: string;
  layouts: readonly LayoutInfo[];
}

export interface RouteInfo extends Omit<RouteInfoWithLayoutInfo, 'layouts'> {
  layouts: readonly string[];
}

export type RouteMappingWithLayoutInfo = Record<
  string,
  RouteInfoWithLayoutInfo
>;
export type RouteMapping = Record<string, RouteInfo>;

export interface StaticFileHandlerData {
  publicPathname: string;
  sourcePathname: string;
  serverPathname: string;
  staticPathname: string;
  resoluteSourcePathname: string;
  watch: boolean;
  envHandler: EnvHandler;
  clientFiles: string[];
  clientModules: IModule[];
  resoluteFiles: string[];
  resoluteModules: IModule[];
  clientLocalDependencies: IDependency[];
  nodeModuleDependencies: IDependency[];
  nodeModuleVersionMap: Record<string, string>;
  routeMapping: RouteMapping;
}

export interface WorkerDataMutable extends StaticFileHandlerData {
  route: string;
  info: RouteInfo;
  env: Record<string, string | undefined>;
}

type DeepReadonly<T> = T extends Record<string, unknown>
  ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>;
    }
  : T extends readonly unknown[]
  ? ReadonlyArray<DeepReadonly<T[number]>>
  : T;

export type WorkerData = DeepReadonly<WorkerDataMutable>;
