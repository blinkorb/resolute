import { createRequire } from 'node:module';

import { transformSync } from '@babel/core';
import ts from 'typescript';

const require = createRequire(import.meta.url);

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
  filename: string,
  envVars: readonly string[]
) => {
  const babelResult = transformSync(content, {
    filename,
    plugins: [
      [
        require.resolve('babel-plugin-transform-inline-environment-variables'),
        { include: envVars },
      ],
      require.resolve('babel-plugin-minify-dead-code-elimination'),
      require.resolve('babel-plugin-transform-commonjs'),
    ],
    minified: true,
    sourceMaps: 'inline',
  });

  if (!babelResult) {
    throw new Error(`No babel result for "${filename}"`);
  }

  return babelResult;
};
