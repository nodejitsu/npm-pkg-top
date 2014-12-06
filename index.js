/*
 * index.js: Top-level include for npm-pkg-top.
 *
 * (C) 2013 Charlie Robbins.
 *
 */

var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    GitHubApi = require('github'),
    githubUrl = require('github-url-from-git'),
    ProgressBar = require('progress'),
    request = require('request');

//
// The urls for the type of queries we are doing.
//
var urls = {
  binary: 'http://isaacs.ic.ht/registry/_design/app/_view/needBuild',
  all:    'http://isaacs.ic.ht/registry/_all_docs'
};

//
// ### function pkgTop (options, callback)
// Returns the top packages by npm stars, github stars, and depended upon.
// e.g.
//
//     [
//       { npm: 0, git: 10, dep: 5, name: 'some-pkg' },
//       (...)
//     ]
//
module.exports = function (options, callback) {
  //
  // ### function log (level, msg)
  // Logs the `msg` at the `level` provided.
  //
  function log(level, msg) {
    if (!options.logger) { return }
    options.logger[level](msg);
  }

  //
  // ### function parseNpm (body)
  // Parses the reponse from the first npm view query.
  //
  function parseNpm (body) {
    return body.rows.map(function (row) {
      var pkg   = row.doc,
          url   = pkg.repository && pkg.repository.url,
          users = pkg.users;

      return {
        name:      pkg.name,
        githubUrl: (url && githubUrl(url))              || null,
        npm:       (users && Object.keys(users).length) || 0
      };
    });
  }

  //
  // ### function saveQuery(json, next)
  // Saves the JSON query to `options['save-query']
  //
  function saveQuery(json, next) {
    log('info', 'Saving query to: ' + options['save-query']);
    fs.writeFile(options['save-query'], JSON.stringify(json, null, 2), 'utf8', function (err) {
      if (err) { log('error', 'Error saving query: ' + err.message) }
      next(null, parseNpm(json));
    });
  }

  //
  // ### function loadQuery(next)
  // Loads the JSON query to `options['load-query']
  //
  function loadQuery(next) {
    log('info', 'Loading query from: ' + options['load-query']);
    fs.readFile(options['load-query'], 'utf8', function (err, data) {
      if (err) {
        log('error', 'Failed to load ' + options['load-query'] + ': ' + err.message);
        return next(err);
      }

      try { data = JSON.parse(data) }
      catch (ex) { return next(ex) }
      next(null, parseNpm(data));
    });
  }


  //
  // ### function getGithubStars(github, stars, next)
  // Gets the npm and github stars for the
  // specified `stars` info.
  //
  function getGithubStars(github, stars, next) {
    if (!stars.githubUrl) {
      stars.git = -1;
      return next(null, stars);
    }

    var parts = stars.githubUrl
      .split('/')
      .slice(-2);

    github.repos.get({
      user: parts[0],
      repo: parts[1]
    }, function (err, repo) {
      stars.git = repo && repo.watchers
        ? repo.watchers
        : 0;

      log('info', 'git: [' + [stars.git, stars.name, parts.join('/')].join(', ') + ']');
      next(null, stars);
    });
  }

  //
  // ### function getDependents (stars, next)
  // Counts all of the dependendents for the specified
  // stars object
  //
  function getDependents(stars, next) {
    request({
      url: 'http://isaacs.ic.ht/registry/_design/app/_view/dependedUpon',
      json: true,
      qs: {
        startkey: JSON.stringify([stars.name]),
        endkey:   JSON.stringify([stars.name, 'zzzzz'])
      }
    }, function (err, res, body) {
      stars.dep = !err && body && body.rows.length
        ? body.rows[0].value
        : 0;

      log('info', 'dep [' + [stars.dep, stars.name].join(', ') + ']');
      next();
    });
  }

  //
  // ### function sortStars (key)
  // Returns a function that sorts the stars
  // object by the given key.
  //
  function sortStars(key) {
    return function (lval, rval) {
      //
      // Get the value of the specified key
      //
      var lstar = lval[key],
          rstar = rval[key];

      if (lstar === rstar) { return 0 }
      return lstar < rstar ? 1 : -1;
    };
  }

  async.waterfall([
    //
    // 1. Get all binary packages
    //
    function listBinary(next) {
      if (options['load-query']) {
        return loadQuery(next);
      }

      var req = request({
        url: urls[options.type],
        qs: { include_docs: true },
        json: true
      }, function (err, res, body) {
        if (err || !body || !body.rows || !body.rows.length) {
          return next(err || new Error('Bad data returned from npm registry.'));
        }

        return options['save-query']
          ? saveQuery(body, next)
          : next(null, parseNpm(body));
      });

      req.on('response', function (res) {
        var bar = new ProgressBar('  Querying npm [:bar] :percent :etas', {
          width: 20,
          clear: true,
          complete: '=',
          incomplete: ' ',
          total: res.headers['content-length']
            ? parseInt(res.headers['content-length'], 10)
            : 100 * 1024 * 1024
        });

        res.on('end', function () {
          bar.complete = true;
          bar.terminate();
          console.log();
        });

        res.on('data', function (chunk) {
          bar.tick(chunk.length);
        });
      });

      req.end();
    },
    //
    // 2. Get the github and npm stars for
    //    each of the binary packages
    //
    function getAllStars(allStars, next) {
      if (~options.skip.indexOf('git')) {
        return next(null, allStars.map(function (stars) {
          stars.git = -1;
          return stars;
        }));
      }

      //
      // Create a github client.
      //
      var github = new GitHubApi({
        // required
        version: "3.0.0",
        // optional
        timeout: 5000
      });

      //
      // Authenticate if credentials are provided
      //
      if (options.username && options.password) {
        github.authenticate({
          type: 'basic',
          username: options.username,
          password: options.password
        });
      }

      async.mapLimit(allStars, 10, getGithubStars.bind(null, github), next);
    },
    //
    // 3. Get the npm dependents for
    //    each of the binary packages
    //
    function getAllDependents(allStars, next) {
      if (~options.skip.indexOf('dep')) {
        return next(null, allStars.map(function (stars) {
          stars.dep = -1;
          return stars;
        }));
      }

      async.forEachLimit(allStars, 10, getDependents, function (err) {
        return err ? next(err) : next(null, allStars);
      });
    },
    //
    // 4. Compute the top binary packages
    //
    function getTop(stars, next) {
      stars = stars
        .filter(Boolean)
        .sort(sortStars(options.sortBy));

      next(null, stars);
    }
  ], callback);
};
