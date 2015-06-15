'use strict';

// Core node modules
var exec = require('child_process').exec;
var fs = require('fs');
var os = require('os');
var path = require('path');

// Third-party modules
var objectAssign = require('object-assign');
var Promise = require('es6-promise').Promise;
var uuid = require('uuid');

function objectToTabbedString(object) {
    return Object.keys(object)
        .map(function(key) {
            return '\t' + key + ': ' + object[key] + '\n';
        })
        .join('');
}

function scan(srcPaths) {
    var srcPathsArray = Array.isArray(srcPaths) ? srcPaths : [srcPaths];
    var scanPromises = srcPathsArray.map(scanOne);
    return Promise.all(scanPromises).then(function(resultsArray) {
        return objectAssign.apply(null, [{}].concat(resultsArray));
    });
}

function scanOne(srcPath) {
    var resultsFilePathArg = path.resolve(os.tmpdir(), 'scanjs-' + uuid.v4());
    var resultsFilePath = resultsFilePathArg + '.JSON';

    var scanJsCmd = [
        './node_modules/.bin/scanjs',
        '--disable-beautify',
        '-t',
        srcPath,
        '-o',
        resultsFilePathArg
    ].join(' ');

    return new Promise(function(resolve, reject) {
        exec(scanJsCmd, function(execErr, stdout, stderr) {
            if (execErr) {
                execErr.message = stderr.toString();
                reject(execErr);
                return;
            }

            fs.readFile(resultsFilePath, function(readFileErr, data) {
                if (readFileErr) {
                    reject(readFileErr);
                    return;
                }

                var results;
                try {
                    results = JSON.parse(data);
                } catch(e) {
                    fs.unlink(resultsFilePath, function() {
                        reject(e);
                    });
                    return;
                }

                fs.unlink(resultsFilePath, function() {
                    resolve(results);
                });
            });
        });
    });
}

function getConsoleFriendlyResults(results) {
    var nonEmptyResults = Object.keys(results)
        .map(function(resultKey) {
            return results[resultKey];
        })
        .filter(function(result) {
            return (Array.isArray(result) && result.length);
        })
        .reduce(function(array, result) {
            return array.concat(result);
        }, []);

    return nonEmptyResults
        .map(function(result) {
            delete result.rule.statement;
            return result.filename + ':' + result.line + '\n' +
                objectToTabbedString(result.rule);
        })
        .join('\n');
}

module.exports = {
    getConsoleFriendlyResults: getConsoleFriendlyResults,
    scan: scan,
    scanOne: scanOne
};
