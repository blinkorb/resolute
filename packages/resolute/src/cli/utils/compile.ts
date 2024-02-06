import { createRequire } from 'node:module';
import path from 'node:path';

import { transformSync } from '@babel/core';
import { IModule } from 'dependency-cruiser';
import ts from 'typescript';

import { commonjsToEsm } from '../babel/commonjs-to-esm.js';
import { CWD } from '../constants.js';

const require = createRequire(import.meta.url);

const BASE_TS_COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  declaration: false,
  inlineSourceMap: true,
  inlineSources: true,
  jsx: ts.JsxEmit.React,
  noEmit: false,
} as const satisfies ts.CompilerOptions;

const FORMAT_HOST = {
  getCanonicalFileName: (pathname: string) => pathname,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
} as const satisfies ts.FormatDiagnosticsHost;

const reportDiagnostic = (diagnostic: ts.Diagnostic) => {
  if (diagnostic.file) {
    const { line, character } = ts.getLineAndCharacterOfPosition(
      diagnostic.file,
      diagnostic.start!
    );
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      FORMAT_HOST.getNewLine()
    );
    // eslint-disable-next-line no-console
    console.log(
      `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        FORMAT_HOST.getNewLine()
      )
    );
  }
};

const reportWatchStatusChanged = (diagnostic: ts.Diagnostic) => {
  // eslint-disable-next-line no-console
  console.log(diagnostic.messageText);
};

const getCompilerOptionsJSONFollowExtends = (
  filename: string
): { [key: string]: unknown } => {
  const result: {
    config?: Record<string, unknown>;
    error?: ts.Diagnostic | undefined;
  } = ts.readConfigFile(filename, ts.sys.readFile);

  if (result.error) {
    // eslint-disable-next-line no-console
    console.error(result.error.messageText);
    return process.exit(1);
  }

  if (typeof result.config?.extends === 'string') {
    const dirname = path.dirname(filename);
    const resolved = path.resolve(dirname, result.config.extends);

    return {
      ...(typeof result.config?.compilerOptions === 'object'
        ? result.config.compilerOptions
        : null),
      ...getCompilerOptionsJSONFollowExtends(resolved),
    };
  }
  return {
    ...(typeof result.config?.compilerOptions === 'object'
      ? result.config.compilerOptions
      : null),
  };
};

export const watchTypeScript = (rootDir: string, outDir: string) => {
  const configPath = ts.findConfigFile(
    CWD,
    ts.sys.fileExists,
    'tsconfig.resolute.json'
  );

  if (!configPath) {
    throw new Error(`No tsconfig.resolute.json found in "${CWD}"`);
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    {
      ...BASE_TS_COMPILER_OPTIONS,
      rootDir,
      outDir,
    },
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    reportDiagnostic,
    reportWatchStatusChanged
  );

  ts.createWatchProgram(host);
};

export const compileTypeScript = (
  fileNames: string[],
  rootDir: string,
  outDir: string
): void => {
  const configPath = ts.findConfigFile(
    CWD,
    ts.sys.fileExists,
    'tsconfig.resolute.json'
  );

  if (!configPath) {
    throw new Error(`No tsconfig.resolute.json found in "${CWD}"`);
  }

  const compilerOptions = ts.convertCompilerOptionsFromJson(
    getCompilerOptionsJSONFollowExtends(configPath),
    CWD,
    'tsconfig.resolute.json'
  );

  if (compilerOptions.errors?.length) {
    compilerOptions.errors.forEach(reportDiagnostic);
    return process.exit(1);
  }

  const program = ts.createProgram(fileNames, {
    ...compilerOptions.options,
    ...BASE_TS_COMPILER_OPTIONS,
    rootDir,
    outDir,
  });

  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach(reportDiagnostic);

  const exitCode = emitResult.emitSkipped ? 1 : 0;
  if (exitCode) {
    // eslint-disable-next-line no-console
    console.error(
      `Failed to compile typescript from "${rootDir}" with exit code "${exitCode}".`
    );
    return process.exit(1);
  }
};

export const compileBabel = (
  content: string,
  pathname: string,
  envVars: readonly string[],
  commonjs: boolean,
  modules: IModule[]
) => {
  const babelResult = transformSync(content, {
    filename: pathname,
    plugins: [
      [
        require.resolve('babel-plugin-transform-inline-environment-variables'),
        { include: envVars },
      ],
      require.resolve('babel-plugin-minify-dead-code-elimination'),
      ...(commonjs ? [commonjsToEsm(modules)] : []),
      ...(commonjs ? [require.resolve('babel-plugin-transform-commonjs')] : []),
    ],
    minified: true,
    sourceMaps: 'inline',
    sourceType: 'unambiguous',
  });

  if (!babelResult) {
    throw new Error(`No babel result for "${pathname}"`);
  }

  const { code } = babelResult;

  if (typeof code !== 'string') {
    throw new Error(`No babel code for "${pathname}"`);
  }

  return code;
};
