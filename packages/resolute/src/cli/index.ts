#! /usr/bin/env -S node --enable-source-maps

import {
  collect,
  Command,
  Flag,
  Help,
  KWArg,
  Program,
  RequireAny,
} from 'jargs';

import { DESCRIPTION, NAME } from '../constants.js';
import buildStatic from './build/ssg.js';

const RENDERER = KWArg('renderer', {
  alias: 'r',
  description:
    'The renderer used for the output files. ssg will output plain HTML files, and ssr will output a Node.js server.',
  options: ['ssg', 'ssr'],
});

collect(
  Help(
    'help',
    {
      alias: 'h',
      description: 'Show help and usage info',
    },
    Program(
      NAME,
      {
        description: DESCRIPTION,
        usage: `${NAME} <command> [options]`,
        examples: [
          `${NAME} --help`,
          `${NAME} build`,
          `${NAME} build --renderer ssg`,
        ],
      },
      RequireAny(
        Command(
          'build',
          {
            description: 'Build site for deployment',
            usage: `${NAME} build [options]`,
            examples: [`${NAME} build --renderer ssg`],
            callback: (tree) => {
              if (
                typeof tree.kwargs.renderer === 'undefined' ||
                tree.kwargs.renderer === 'ssg'
              ) {
                return buildStatic();
              }

              if (tree.kwargs.renderer === 'ssr') {
                // eslint-disable-next-line no-console
                console.error('Server-side rendering is not yet supported');

                return process.exit(1);
              }

              // eslint-disable-next-line no-console
              console.error(
                `Unknown renderer: ${
                  tree.kwargs.renderer
                }. Renderer must be one of: ${RENDERER.options.options?.join(
                  ', '
                )}`
              );

              return process.exit(1);
            },
          },
          RENDERER
        ),
        Command(
          'dev',
          {
            description: 'Serve site for development',
            usage: `${NAME} serve [options]`,
            examples: [`${NAME} serve --renderer ssg`],
            callback: (tree) => {
              if (
                typeof tree.kwargs.renderer === 'undefined' ||
                tree.kwargs.renderer === 'ssg'
              ) {
                return buildStatic(true, tree.flags.https);
              }

              if (tree.kwargs.renderer === 'ssr') {
                // eslint-disable-next-line no-console
                console.error('Server-side rendering is not yet supported');

                return process.exit(1);
              }

              // eslint-disable-next-line no-console
              console.error(
                `Unknown renderer: ${
                  tree.kwargs.renderer
                }. Renderer must be one of: ${RENDERER.options.options?.join(
                  ', '
                )}`
              );

              return process.exit(1);
            },
          },
          RENDERER,
          Flag('https', {
            description: 'Serve over HTTPS',
          })
        )
      )
    )
  ),
  process.argv
);
