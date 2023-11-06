import fs from 'node:fs';

import { cruise, IDependency } from 'dependency-cruiser';

import { MATCHES_LOCAL, MATCHES_MODULE_SCOPE_AND_NAME } from '../constants.js';

export const getAllDependencies = async (pathnames: string[]) => {
  const dependencies = await cruise(pathnames, {
    baseDir: process.cwd(),
    enhancedResolveOptions: {
      mainFields: ['module', 'main'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default'],
    },
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

export const readPackageJsonVersion = (pathname: string) => {
  if (!fs.existsSync(pathname)) {
    throw new Error(`Could not read package.json at ${pathname}`);
  }

  const packageJson: unknown = JSON.parse(
    fs.readFileSync(pathname, { encoding: 'utf-8' })
  );

  if (typeof packageJson !== 'object' || !packageJson) {
    throw new Error(`Could not parse package.json at ${pathname}`);
  }

  if (!('version' in packageJson)) {
    throw new Error(`Could not find version in package.json at ${pathname}`);
  }

  if (typeof packageJson.version !== 'string') {
    throw new Error(`Could not parse version in package.json at ${pathname}`);
  }

  return packageJson.version;
};

export const getVersionMap = (
  dependencies: IDependency[]
): Record<string, string> => {
  return dependencies
    .filter((dep) => !MATCHES_LOCAL.test(dep.module))
    .reduce<Record<string, string>>((acc, dep) => {
      const match = MATCHES_MODULE_SCOPE_AND_NAME.exec(dep.module);

      if (!match?.[1]) {
        // eslint-disable-next-line no-console
        console.error(`Could not parse module name: ${dep.module}`);
        return process.exit(1);
      }

      const packagePath = dep.resolved.replace(
        /(?:^|\b)(node_modules\/)(@[\w.-]+\/[\w.-]+|[\w.-]+)\/.*$/,
        `$1${match[1]}/package.json`
      );

      if (!packagePath.endsWith('/package.json')) {
        // eslint-disable-next-line no-console
        console.error(
          `Could not resolve package.json for module "${dep.module}" which resolved to "${dep.resolved}"`
        );
        return process.exit(1);
      }

      try {
        return {
          ...acc,
          [match[1]]: readPackageJsonVersion(packagePath),
        };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        return process.exit(1);
      }
    }, {});
};
