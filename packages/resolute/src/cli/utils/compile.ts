import { createRequire } from 'node:module';

import { PluginObj, transformSync } from '@babel/core';
import t from '@babel/types';
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

const transformCommonjsToEsm: PluginObj = {
  visitor: {
    AssignmentExpression(path) {
      const { left, right } = path.node;

      if (
        left.type === 'MemberExpression' &&
        left.object.type === 'Identifier' &&
        left.object.name === 'module' &&
        left.property.type === 'Identifier' &&
        left.property.name === 'exports'
      ) {
        if (
          right.type === 'CallExpression' &&
          right.callee.type === 'Identifier' &&
          right.callee.name === 'require' &&
          right.arguments.length === 1 &&
          right.arguments[0]!.type === 'StringLiteral'
        ) {
          const requirePath = right.arguments[0]!.value;
          const variableName = requirePath.replace(/[/.-]+/g, '_');

          return path.replaceWithMultiple([
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier(variableName))],
              t.stringLiteral(requirePath)
            ),
            t.exportAllDeclaration(t.stringLiteral(requirePath)),
            t.exportDefaultDeclaration(t.identifier(variableName)),
          ]);
        }
      }
    },
  },
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
      ...(commonjs ? [transformCommonjsToEsm] : []),
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
