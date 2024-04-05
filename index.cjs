const fs = require('fs');
const glob = require('glob');
const path = require('path');

const localeFiles = glob.sync('src/lib/i18n/locales/*.json').map((file) => ({
    path: path.resolve(file),
    content: JSON.parse(fs.readFileSync(file, 'utf-8')),
}));

const allTranslateCallsFile = './tmp/all-translate-calls.txt';

const maxTimeBetweenCalls = 15 * 1000;

fs.mkdirSync('./tmp', { recursive: true });

function getTimestamp() {
    const maybeInt = parseInt(
        (fs.existsSync(allTranslateCallsFile) && fs.readFileSync(allTranslateCallsFile, 'utf-8').split('\n')[0]) || '0'
    );
    if (maybeInt.toString() === 'NaN') {
        return 0;
    }
    return maybeInt;
}

function collectKeys(obj, allLocaleKeys, currentPath = '') {
    for (const [key, value] of Object.entries(obj)) {
        if (key !== '_context') {
            const fullPath = currentPath ? currentPath + '.' + key : key;
            if (typeof value === 'object') {
                collectKeys(value, allLocaleKeys, fullPath);
            } else {
                allLocaleKeys.add(fullPath);
            }
        }
    }
}

const rules = {
    // This rule can be run whenever, and finds all translation strings that are used in $translate calls but not
    // set in the translation files. It also populates a tmp file containing the full list of translation calls that
    // gets used by the `unused-translations` rule below.
    'missing-translations': {
        meta: {
            type: 'problem',
        },
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.name === '$translate') {
                        const now = Date.now();
                        if (now - getTimestamp() > maxTimeBetweenCalls) {
                            fs.writeFileSync(allTranslateCallsFile, now + '\n');
                        }

                        const key = node.arguments[0].value;
                        fs.appendFileSync(allTranslateCallsFile, key + '\n');
                        localeFiles.forEach(({ path, content }) => {
                            const value = key.split('.').reduce((o, k) => (o ? o[k] : undefined), content);
                            if (value === undefined) {
                                context.report({
                                    node,
                                    message: `The key "${key}" is missing in ${path}`,
                                });
                            }
                        });
                    }
                },
            };
        },
    },
    // This rule can only be run after the `missing-translations` rule above, since to know all strings referenced
    // we need to have parsed through all project code. It will detect all translations in the json files that don't
    // have calls from within the project.
    'unused-translations': {
        meta: {
            type: 'problem',
        },
        create(context) {
            if (!fs.existsSync(allTranslateCallsFile) || Date.now() - getTimestamp() > maxTimeBetweenCalls) {
                throw new Error(
                    '\x1b[31m\n\nESLint must be run with the "svelte-translate-check/missing-translations" rule right before running this "svelte-translate-check/unused-translations" rule.\n\n\x1b[0m'
                );
            }
            const usedKeys = new Set(fs.readFileSync(allTranslateCallsFile, 'utf-8').split('\n').slice(1));

            return {
                'Program:exit': function () {
                    const localeFile = localeFiles.find(({ path }) => path === context.filename);
                    if (localeFile) {
                        const allLocaleKeys = new Set();
                        collectKeys(localeFile.content, allLocaleKeys);
                        allLocaleKeys.forEach((key) => {
                            if (!usedKeys.has(key)) {
                                context.report({
                                    node: context.getSourceCode().ast,
                                    message: `The key "${key}" is not used in any file`,
                                });
                            }
                        });
                    }
                },
            };
        },
    },
};

module.exports = { rules };
