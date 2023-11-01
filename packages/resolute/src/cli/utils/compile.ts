import { createRequire } from 'node:module';

import { transformSync } from '@babel/core';
import ts from 'typescript';

import commonjsToEsm from '../babel/commonjs-to-esm.js';
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
  getCanonicalFileName: (path: string) => path,
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

export const watchTypeScript = (rootDir: string, outDir: string) => {
  const configPath = ts.findConfigFile(CWD, ts.sys.fileExists, 'tsconfig.json');

  if (!configPath) {
    throw new Error(`No tsconfig.json found in "${CWD}"`);
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    {
      ...BASE_TS_COMPILER_OPTIONS,
      include: [rootDir],
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
  const program = ts.createProgram(fileNames, {
    ...BASE_TS_COMPILER_OPTIONS,
    include: [rootDir],
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
  commonjs: boolean
) => {
  const babelResult = transformSync(content, {
    filename: pathname,
    plugins: [
      [
        require.resolve('babel-plugin-transform-inline-environment-variables'),
        { include: envVars },
      ],
      require.resolve('babel-plugin-minify-dead-code-elimination'),
      ...(commonjs ? [commonjsToEsm] : []),
      ...(commonjs ? [require.resolve('babel-plugin-transform-commonjs')] : []),
    ],
    minified: true,
    sourceMaps: 'inline',
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
