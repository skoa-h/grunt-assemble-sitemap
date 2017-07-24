/*!
 * grunt-assemble-sitemap <https://github.com/assemble/grunt-assemble-sitemap.git>
 *
 * Copyright (c) 2014-2015, Hariadi Hinta.
 * Licensed under the MIT License.
 */

var union = require('arr-union');
var xml = require('jstoxml');
var path = require('path');
var zlib = require('zlib');
var fs = require('fs');

module.exports = function(params, cb) {
    var assemble = params.assemble;
    var grunt = params.grunt;
    var pages = assemble.options.pages;
    var len = pages.length;
    var options = assemble.options.sitemap || {};
    var sitemap = [];
    var robots = [];
    var exclusion = ['404'];
    var pkg = grunt.file.readJSON('package.json');
    
    options.homepage = options.homepage || pkg.homepage;
    options.robot = options.robot !== false;
    options.changefreq = options.changefreq || 'weekly';
    options.priority = (options.priority || 0.5).toString();
    options.dest = options.dest || path.dirname(pages[0].dest);
    options.pretty = options.pretty || false;
    options.basename = options.basename || 'sitemap.xml';
    options.removeExt = options.removeExt || false;
    options.compress = options.compress || true;
    
    if (typeof options.exclude !== 'undefined') {
        exclusion = union([], exclusion, options.exclude || []);
    }
    
    // Only write if it actually changed.
    var write = function(file, content) {
        var msg;
        var old = grunt.file.exists(file) ? grunt.file.read(file) : '';
        
        if (old !== content) {
            grunt.file.write(file, content);
            msg = 'Created '.yellow + file.cyan;
        } else {
            msg = 'Keeping '.yellow + file.cyan;
        }
        return grunt.verbose.ok(msg);
    };
    
    // Return the relative destination if the option is enabled
    var getExternalFilePath = function(relativedest, file, removeExt) {
        var finalFilename = file.dest;
        var fileExtension = path.extname(file.dest)
        
        if (relativedest === true) {
            relativedest = options.dest;
        }
        if(removeExt === true) {
            finalFilename = finalFilename.substring(0, finalFilename.length - fileExtension.length);
        }
        if (options.pretty === true) {
            var index = 'index' + (removeExt === true ? '' : fileExtension);
            if(finalFilename.lastIndexOf(index) === finalFilename.length - index.length) {
                finalFilename = finalFilename.substring(index, finalFilename.length - index.length);
            }
        }
        return (relativedest ? finalFilename.replace(relativedest + '/', '') : finalFilename);
    };
    
    var url = options.homepage;
    var relativedest = options.relativedest;
    
    for (var i = 0; i < len; i++) {
        var file = pages[i];
        var date = file.data.updated || file.data.date || new Date();
        var changefreq = file.data.changefreq || options.changefreq;
        var priority = file.data.priority || options.priority;
        
        if (exclusion.indexOf(file.basename) !== -1 ||
            grunt.file.isMatch({srcBase: options.dest}, exclusion, file.dest)) {
            robots.push('Disallow: /' + getExternalFilePath(relativedest, file, false));
            continue;
        }
        
        sitemap.push({
            url: {
                loc: url + '/' + getExternalFilePath(relativedest, file, options.removeExt),
                lastmod: date.toISOString(),
                changefreq: changefreq,
                priority: priority
            }
        });
    }
    
    var result = xml.toXML({
        _name: 'urlset',
        _attrs: {
            xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
        },
        _content: sitemap
    }, {header: true, indent: '  '});
    
    var sitemapDest = options.dest + '/' + options.basename;
    write(sitemapDest, result);
    
    if (options.robot) {
        var sitemapFile = {dest: url + '/' + sitemapDest};
        var robot = 'User-agent: *\n';
        
        robot += robots.join('\n') + '\n\n';
        
        robot += 'Sitemap: ' + getExternalFilePath(relativedest, sitemapFile, false);
        robot += '\n';
        
        var robotpDest = options.dest + '/robots.txt';
        write(robotpDest, robot);
    }
    if (options.compress) {
        var compressor = zlib.createGzip({level: 1});
        compressor.pipe(fs.createWriteStream(sitemapDest + '.gz'));
        compressor.end(result);
    }
    cb();
};

module.exports.options = {
    stage: 'render:pre:pages'
};
