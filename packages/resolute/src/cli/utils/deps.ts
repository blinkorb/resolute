import { cruise, IDependency } from 'dependency-cruiser';

export const getNodeModuleDependencies = async (filenames: string[]) => {
  const dependencies = await cruise(filenames, {
    baseDir: process.cwd(),
  });

  const nodeModules = dependencies.output.modules
    .reduce<readonly IDependency[]>((acc, mod) => {
      return [
        ...acc,
        ...mod.dependencies.filter((dep) =>
          dep.resolved.includes('node_modules')
        ),
      ];
    }, [])
    .filter(
      (dep, index, context) =>
        context.findIndex(
          (otherDep) =>
            otherDep.module === dep.module && otherDep.resolved === dep.resolved
        ) === index
    );

  return nodeModules;
};
