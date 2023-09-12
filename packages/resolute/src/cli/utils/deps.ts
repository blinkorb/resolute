import { cruise, IDependency } from 'dependency-cruiser';

export const getAllDependencies = async (filenames: string[]) => {
  const dependencies = await cruise(filenames, {
    baseDir: process.cwd(),
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
