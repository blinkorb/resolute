#! /usr/bin/env npx ts-node-esm --files

import { collect, Command, Help, Program, RequireAny, Required } from 'jargs';

import { DESCRIPTION, PROGRAM } from '../constants.js';
import buildStatic from './build/static.js';
import serveStatic from './serve/static.js';

collect(
  Help(
    'help',
    {
      alias: 'h',
      description: 'Show help and usage info',
    },
    Program(
      PROGRAM,
      {
        description: DESCRIPTION,
        usage: `${PROGRAM} <command> [options]`,
        examples: [`${PROGRAM} --help`, `${PROGRAM} static`],
      },
      RequireAny(
        Command(
          'build',
          {
            description: 'Build site for deployment',
            usage: `${PROGRAM} build [options]`,
            examples: [`${PROGRAM} build static`],
          },
          Required(
            Command('static', {
              description: 'Build a static site',
              usage: `${PROGRAM} static [options]`,
              examples: [`${PROGRAM} static`],
              callback: buildStatic,
            })
          )
        ),
        Command(
          'serve',
          {
            description: 'Serve site for development',
            usage: `${PROGRAM} serve [options]`,
            examples: [`${PROGRAM} serve static`],
          },
          Required(
            Command('static', {
              description: 'Serve a static site',
              usage: `${PROGRAM} static [options]`,
              examples: [`${PROGRAM} static`],
              callback: serveStatic,
            })
          )
        )
      )
    )
  ),
  process.argv
);
