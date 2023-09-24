import { createRequire } from 'node:module';
import path from 'node:path';

import { transformSync } from '@babel/core';
import ts from 'typescript';

import { SERVER_PATHNAME } from '../constants.js';

const require = createRequire(import.meta.url);

const resolveResolute = path.dirname(
  path.dirname(require.resolve('@blinkorb/resolute'))
);

export const compileTypeScript = (
  fileNames: string[],
  rootDir: string,
  outDir: string
): void => {
  const program = ts.createProgram(fileNames, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    declaration: false,
    inlineSourceMap: true,
    jsx: ts.JsxEmit.React,
    outDir,
    rootDir,
  });

  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );
      // eslint-disable-next-line no-console
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      );
    }
  });

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
  {
    envAndDeadCode,
    commonjs,
    css,
  }: {
    envAndDeadCode: boolean;
    commonjs: boolean;
    css: boolean;
  }
) => {
  const babelResult = transformSync(content, {
    filename: pathname,
    plugins: [
      ...(css
        ? [
            [
              require.resolve('babel-plugin-css-modules-transform'),
              {
                preprocessCss: path.resolve(
                  resolveResolute,
                  'preprocess-css.cjs'
                ),
                extensions: ['.css', '.scss'],
                extractCss: {
                  dir: SERVER_PATHNAME,
                  relativeRoot: SERVER_PATHNAME,
                  filename: '[path]/[name].css',
                },
              },
            ],
          ]
        : []),
      ...(envAndDeadCode
        ? [
            [
              require.resolve(
                'babel-plugin-transform-inline-environment-variables'
              ),
              { include: envVars },
            ],
            require.resolve('babel-plugin-minify-dead-code-elimination'),
          ]
        : []),
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
