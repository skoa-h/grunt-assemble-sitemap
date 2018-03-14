/*!
 * grunt-assemble-sitemap <https://github.com/assemble/grunt-assemble-sitemap.git>
 *
 * Copyright (c) 2014-2015, Hariadi Hinta.
 * Licensed under the MIT License.
 */

let union = require('arr-union');
let js2xml = require('jstoxml');
let xml2js = require('xml2js');
let path = require('path');
let zlib = require('zlib');
let fs = require('fs');

module.exports = function(params, cb) {
    let assemble = params.assemble;
    let grunt = params.grunt;
    let pages = assemble.options.pages;
    let len = pages.length;
    let options = assemble.options.sitemap || {};
    let sitemap = [];
    let robots = [];
    let exclusion = ['404'];
    let pkg = grunt.file.readJSON('package.json');

    options.homepage = options.homepage || pkg.homepage;
    options.robot = options.robot !== false;
    options.changefreq = options.changefreq || 'weekly';
    options.priority = (options.priority || 0.5).toString();
    options.dest = options.dest || path.dirname(pages[0].dest);
    options.pretty = options.pretty || false;
    options.basename = options.basename || 'sitemap.xml';
    options.removeExt = options.removeExt || false;
    options.compress = options.compress || true;
    options.update = options.update || false;

    if (typeof options.exclude !== 'undefined') {
        exclusion = union([], exclusion, options.exclude || []);
    }

    // Only write if it actually changed.
    let write = function(file, content) {
        let msg;
        let old = grunt.file.exists(file) ? grunt.file.read(file) : '';

        if (old !== content) {
            grunt.file.write(file, content);
            msg = 'Created '.yellow + file.cyan;
        } else {
            msg = 'Keeping '.yellow + file.cyan;
        }
        return grunt.verbose.ok(msg);
    };

    // Return the relative destination if the option is enabled
    let getExternalFilePath = function(relativedest, file, removeExt) {
        let finalFilename = file.dest;
        let fileExtension = path.extname(file.dest);

        if (relativedest === true) {
            relativedest = options.dest;
        }
        if(removeExt === true) {
            finalFilename = finalFilename.substring(0, finalFilename.length - fileExtension.length);
        }
        if (options.pretty === true) {
            let index = 'index' + (removeExt === true ? '' : fileExtension);
            if(finalFilename.lastIndexOf(index) === finalFilename.length - index.length) {
                finalFilename = finalFilename.substring(index, finalFilename.length - index.length);
            }
        }
        return (relativedest ? finalFilename.replace(relativedest + '/', '') : finalFilename);
    };

    let url = options.homepage;
    let relativedest = options.relativedest;

    let sitemapDest = options.dest + '/' + options.basename;

    console.log(`options.update ${sitemapDest} ${options.update}`);
    if(options.update)
    {
        let parser = new xml2js.Parser();
        try
        {
            let temp = fs.readFileSync(sitemapDest, "utf8");
            parser.parseString(temp, function (err, result)
            {
                if(result && result.urlset && result.urlset.url)
                {

                    for(let i = 0; i < result.urlset.url.length; i++)
                    {
                        let url = result.urlset.url[i];
                        let obj = {};
                        for(let a in url)
                        {
                            obj[a] = url[a].toString();
                        }
                        sitemap.push({
                            url : obj
                        });
                    }
                }
            });
        } catch (err) {
            console.log(`error ${sitemapDest} ${err}`);
        }
    }

    for (let i = 0; i < len; i++) {
        let file = pages[i];
        let date = file.data.updated || file.data.date || new Date();
        let changefreq = file.data.changefreq || options.changefreq;
        let priority = file.data.priority || options.priority;

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

    let result = js2xml.toXML({
        _name: 'urlset',
        _attrs: {
            xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
        },
        _content: sitemap
    }, {header: true, indent: '  '});


    write(sitemapDest, result);

    if (options.robot) {
        let sitemapFile = {dest: url + '/' + sitemapDest};
        let robot = 'User-agent: *\n';

        robot += robots.join('\n') + '\n\n';

        robot += 'Sitemap: ' + getExternalFilePath(relativedest, sitemapFile, false);
        robot += '\n';

        let robotpDest = options.dest + '/robots.txt';
        write(robotpDest, robot);
    }
    if (options.compress) {
        let compressor = zlib.createGzip({level: 1});
        compressor.pipe(fs.createWriteStream(sitemapDest + '.gz'));
        compressor.end(result);
    }
    cb();
};

module.exports.options = {
    stage: 'render:pre:pages'
};
