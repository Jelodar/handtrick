'use strict';

const fs = require('fs');
const path = require('path');
const terser = require('terser');

const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'src');
const output = {
    cjs: path.join(root, 'handtrick.js'),
    mjs: path.join(root, 'handtrick.mjs'),
    minCjs: path.join(root, 'handtrick.min.js'),
    minMjs: path.join(root, 'handtrick.min.mjs')
};

const coreSections = [
    'core/00-foundation.js',
    'core/01-events.js',
    'core/02-defaults.js',
    'core/03-aliases.js',
    'core/04-math.js',
    'core/05-selectors.js',
    'core/06-state.js',
    'core/07-keyboard.js',
    'core/08-matching.js',
    'core/09-regions.js',
    'core/10-presets.js'
];

const classSections = [
    'class/00-setup.js',
    'class/01-listeners.js',
    'class/02-state.js',
    'class/03-dom.js',
    'class/04-input.js',
    'class/05-wheel-points.js',
    'class/06-intent.js',
    'class/07-modifier.js',
    'class/08-pan-path.js',
    'class/09-transforms.js',
    'class/10-rolling.js',
    'class/11-detail.js'
];

const staticSections = [
    'core/11-static.js'
];

const wrapperStart = "(function (root, factory) {\n    const value = factory();\n    if (typeof module === 'object' && module.exports) module.exports = value;\n    if (typeof define === 'function' && define.amd) define(function () { return value; });\n    root.HandTrick = value;\n})(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n";
const wrapperEnd = "\n    return HandTrick;\n});\n";
const moduleEnd = "\n\nexport { HandTrick };\nexport default HandTrick;\n";

function fail(message) {
    console.error('build failed: ' + message);
    process.exit(1);
}

function readFile(relativePath) {
    const file = path.join(srcRoot, relativePath);
    if (!fs.existsSync(file)) fail(relativePath + ' missing');
    return fs.readFileSync(file, 'utf8').trimEnd();
}

function readSections(sections) {
    return sections.map(readFile).join('\n\n');
}

function indent(source) {
    return source.split('\n').map(line => line ? '    ' + line : line).join('\n');
}

function banner() {
    return readFile('banner.txt') + '\n';
}

function body() {
    const core = readSections(coreSections);
    const classBody = indent(readSections(classSections));
    const statics = readSections(staticSections);
    return [
        core,
        'class HandTrick {\n' + classBody + '\n}',
        statics
    ].join('\n\n') + '\n';
}

function sources() {
    const raw = body();
    const common = banner() + wrapperStart + indent(raw.trimEnd()) + wrapperEnd;
    const moduleSource = banner() + raw.trimEnd() + moduleEnd;
    if (!raw.includes('class HandTrick')) fail('HandTrick class missing');
    if (!common.includes('return HandTrick')) fail('CommonJS/global return missing');
    if (!moduleSource.includes('export default HandTrick')) fail('module export missing');
    return { common, moduleSource };
}

function writeReadable(source) {
    fs.writeFileSync(output.cjs, source.common);
    fs.writeFileSync(output.mjs, source.moduleSource);
}

async function minify(source, target) {
    const writeCjs = target === 'all' || target === 'js';
    const writeMjs = target === 'all' || target === 'mjs';
    const format = { comments: /HandTrick\.js/ };

    if (writeCjs) {
        const result = await terser.minify(source.common, {
            compress: { toplevel: true, unsafe: true },
            mangle: { toplevel: true },
            format
        });
        if (result.error) throw result.error;
        fs.writeFileSync(output.minCjs, result.code + '\n');
    }

    if (writeMjs) {
        const result = await terser.minify(source.moduleSource, {
            module: true,
            compress: { toplevel: true, unsafe: true },
            mangle: { toplevel: true },
            format
        });
        if (result.error) throw result.error;
        fs.writeFileSync(output.minMjs, result.code + '\n');
    }
}

async function run() {
    const args = process.argv.slice(2);
    const action = args[0] || '--all';
    const target = args[1] || 'all';
    const source = sources();

    if (!['--all', '--readable', '--minify'].includes(action)) fail('unknown action ' + action);
    if (action === '--minify' && !['all', 'js', 'mjs'].includes(target)) fail('unknown minify target ' + target);

    if (action !== '--minify') writeReadable(source);
    if (action !== '--readable') await minify(source, target);
}

run().catch(error => fail(error && error.stack ? error.stack : String(error)));
