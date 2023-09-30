import { cruise, IDependency, IModule } from 'dependency-cruiser';

import { CWD } from '../constants.js';

export const uniqueDependency = (
  dep: Pick<IDependency, 'resolved'>,
  index: number,
  context: readonly Pick<IDependency, 'resolved'>[]
) => context.findIndex((other) => other.resolved === dep.resolved) === index;

export const uniqueModule = (
  mod: Pick<IModule, 'source'>,
  index: number,
  context: readonly Pick<IModule, 'source'>[]
) => context.findIndex((m) => m.source === mod.source) === index;

export const getAllDependencies = async (
  pathnames: string[],
  noFollow: boolean
) => {
  const dependencies = await cruise(pathnames, {
    baseDir: CWD,
    enhancedResolveOptions: {
      mainFields: ['module', 'main'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default'],
    },
    ...(noFollow
      ? {
          doNotFollow: {
            dependencyTypes: [
              'aliased',
              'core',
              'deprecated',
              'local',
              'localmodule',
              'npm',
              'npm-bundled',
              'npm-dev',
              'npm-no-pkg',
              'npm-optional',
              'npm-peer',
              'npm-unknown',
              'undetermined',
              'unknown',
              'type-only',
            ],
          },
        }
      : {}),
  });

  const list = dependencies.output.modules
    .reduce<readonly IDependency[]>((acc, mod) => {
      return [...acc, ...mod.dependencies];
    }, [])
    .filter(
      (dep, index, context) =>
        context.findIndex(
          (otherDep) =>
            otherDep.module === dep.module && otherDep.resolved === dep.resolved
        ) === index
    );

  return {
    modules: dependencies.output.modules,
    list,
  };
};
