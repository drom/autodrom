#!/usr/bin/env node
'use strict';

const process = require('process');
const path = require('path');
const { readFile, writeFile, stat } = require('fs').promises;
const timers = require('timers');
const util = require('util');

const setTimeout = util.promisify(timers.setTimeout);

const { program } = require('commander');
const chokidar = require('chokidar');
const hpccwasm = require('@hpcc-js/wasm');

const lib = require('../lib/');

const readModifyWrite = async (filename, opts, graphviz, timeout) => {
  const src = await readFile(filename, {encoding: 'utf8'});
  const cells = lib.parse(src);
  lib.update(cells, path.join(process.cwd(), filename));

  const dst = cells.map(cell =>
    (cell.kind === 'meta')
      ? '/*' + cell.src + '*/'
      : cell.src
  ).join('');

  if (opts.svg) {
    const svgs = lib.extractSVG(graphviz, cells);
    for (let i = 0; i < svgs.length; i++) {
      await writeFile(filename + i + '.svg', svgs[i]);
      // console.log('end svg');
    }
  }

  // console.log(filename, cells);

  await setTimeout(timeout);
  await writeFile(filename, dst);
  await setTimeout(timeout);
  // console.log('end rw');
};

const main = async () => {
  const graphviz = await hpccwasm.graphvizSync();

  program
    .option('-w, --watch', 'keep watching')
    .option('-s, --svg', 'generate SVG files')
    .parse(process.argv);

  const opts = program.opts();

  if (opts.watch) {
    const watcher = chokidar.watch(program.args, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true
    });
    watcher.on('change', async (filename) => {
      console.log(`File ${filename} changed`);
      await watcher.unwatch(filename);
      await readModifyWrite(filename, opts, graphviz, 200);
      watcher.add(filename);
    });
  } else {
    const filenames = program.args.map(e => path.join(process.cwd(), e));
    for (const filename of filenames) {
      if ((await stat(filename)).isFile()) {
        console.log(filename);
        await readModifyWrite(filename, opts, graphviz, 10);
      }
    }
  }
};

main();
