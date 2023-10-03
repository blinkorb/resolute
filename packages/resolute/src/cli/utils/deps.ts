import fs from 'node:fs';

import { cruise, IDependency } from 'dependency-cruiser';

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
