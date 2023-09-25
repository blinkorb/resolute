import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { PluginObj, transformSync } from '@babel/core';
import t from '@babel/types';
import ts from 'typescript';

import { MATCHES_LOCAL } from '../constants.js';

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

const MATCHES_JS_EXTENSION = /\.[mc]?js$/;

const transformCommonjsToEsm: PluginObj = {
  visitor: {
    AssignmentExpression(p) {
      const { node } = p;
      const { left, right } = node;

      if (
        right.type === 'CallExpression' &&
        right.callee.type === 'Identifier' &&
        right.callee.name === 'require' &&
        right.arguments.length === 1 &&
        right.arguments[0]!.type === 'StringLiteral'
      ) {
        if (
          left.type === 'MemberExpression' &&
          left.object.type === 'Identifier' &&
          left.object.name === 'module' &&
          left.property.type === 'Identifier' &&
          left.property.name === 'exports'
        ) {
          const requirePath = right.arguments[0]!.value;
          const variableName = requirePath.replace(/[/.-]+/g, '_');

          p.replaceWithMultiple([
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier(variableName))],
              t.stringLiteral(requirePath)
            ),
            t.exportAllDeclaration(t.stringLiteral(requirePath)),
            t.exportDefaultDeclaration(t.identifier(variableName)),
          ]);
          return;
        }
      }
    },
    CallExpression(p) {
      const { node } = p;
      const { callee, arguments: args } = node;

      if (
        callee.type === 'Identifier' &&
        callee.name === 'require' &&
        args.length === 1 &&
        args[0]!.type === 'StringLiteral' &&
        MATCHES_LOCAL.test(args[0]!.value) &&
        !MATCHES_JS_EXTENSION.test(args[0]!.value)
      ) {
        if (!this.file.opts.filename) {
          throw new Error(
            `Could not get filename for require of "${args[0]!.value}"`
          );
        }

        if (
          fs.existsSync(
            path.resolve(
              path.dirname(this.file.opts.filename),
              args[0].value + '.js'
            )
          )
        ) {
          args[0].value += '.js';
          return;
        }

        args[0].value += '/index.js';
        return;
      }

      const [first, second, third] = node.arguments;

      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'Object' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'defineProperty' &&
        first?.type === 'Identifier' &&
        first.name === 'exports' &&
        second?.type === 'StringLiteral' &&
        third?.type === 'ObjectExpression'
      ) {
        const valueDef = third.properties.find(
          (n) =>
            n.type === 'ObjectProperty' &&
            n.key.type === 'Identifier' &&
            n.key.name === 'value'
        ) as t.ObjectProperty | undefined;

        const getDef = third.properties.find(
          (n) =>
            n.type === 'ObjectProperty' &&
            n.key.type === 'Identifier' &&
            n.key.name === 'get'
        ) as t.ObjectProperty | undefined;

        if (getDef && getDef.value.type === 'FunctionExpression') {
          p.traverse({
            ReturnStatement(sp) {
              if (sp.node.argument?.type === 'MemberExpression') {
                p.replaceWith(
                  t.exportNamedDeclaration(
                    t.variableDeclaration('const', [
                      t.variableDeclarator(
                        t.identifier(second.value),
                        sp.node.argument
                      ),
                    ])
                  )
                );
                return;
              }

              throw new Error(
                `Could not get value of getter for ${second.value}`
              );
            },
          });
          return;
        }

        if (valueDef) {
          if (second.value === '__esModule') {
            return;
          }

          if (valueDef.value.type === 'MemberExpression') {
            p.replaceWith(
              t.exportNamedDeclaration(
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    t.identifier(second.value),
                    valueDef.value
                  ),
                ])
              )
            );
            return;
          }
        }

        throw new Error(`Could not determine value for ${second.value}`);
      }
    },
    ImportDeclaration(p) {
      const { node } = p;

      if (
        node.source.type === 'StringLiteral' &&
        MATCHES_LOCAL.test(node.source.value) &&
        !MATCHES_JS_EXTENSION.test(node.source.value)
      ) {
        if (!this.file.opts.filename) {
          throw new Error(
            `Could not get filename for require of "${node.source.value}"`
          );
        }

        if (
          fs.existsSync(
            path.resolve(
              path.dirname(this.file.opts.filename),
              node.source.value + '.js'
            )
          )
        ) {
          node.source.value += '.js';
          return;
        }

        node.source.value += '/index.js';
        return;
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
