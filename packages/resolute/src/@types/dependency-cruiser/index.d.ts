import {
  ICruiseOptions,
  ICruiseResult,
  IResolveOptions,
} from 'dependency-cruiser';

declare module 'dependency-cruiser' {
  export interface ReporterOutput {
    /**
     * The output proper of the reporter. For most reporters this will be
     * a string.
     */
    output: ICruiseResult;
    /**
     * The exit code - reporters can return a non-zero value when they find
     * errors here. api consumers (like a cli) can use this to return a
     * non-zero exit code, so the build breaks when something is wrong
     *
     * This is e.g. the default behavior of the `err` and `err-long` reporters.
     */
    exitCode: number;
  }

  export function cruise(
    pFileAndDirectoryArray: string[],
    pCruiseOptions?: ICruiseOptions,
    pResolveOptions?: IResolveOptions,
    pTranspileOptions?: ITranspileOptions
  ): Promise<ReporterOutput>;
}
