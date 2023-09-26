import fs from 'node:fs';
import path from 'node:path';

import { PluginObj } from '@babel/core';
import t from '@babel/types';

import { MATCHES_JS_EXTENSION, MATCHES_LOCAL } from '../constants.js';

const commonjsToEsm: PluginObj = {
  visitor: {
    AssignmentExpression(p) {
      const { node } = p;
      const { left, right } = node;

      // Convert module.exports to export default and export all
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

      // Add file extension to require calls
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

      // Create named exports for Object.defineProperty
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
          if (p.parent.type !== 'ExpressionStatement') {
            throw new Error(
              `Expected Object.defineProperty to be in an ExpressionStatement`
            );
          }

          p.traverse({
            ReturnStatement(sp) {
              if (sp.node.argument?.type === 'MemberExpression') {
                p.parentPath.replaceWith(
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

          if (p.parent.type !== 'ExpressionStatement') {
            throw new Error(
              `Expected Object.defineProperty to be in an ExpressionStatement`
            );
          }

          if (valueDef.value.type === 'MemberExpression') {
            p.parentPath.replaceWith(
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

      // Add file extension to import statements
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
export default commonjsToEsm;
