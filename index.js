/*
 * index.js: Top-level include for npm-binary-top.
 *
 * (C) 2012 Nodejitsu Inc.
 *
 */

var path = require('path'),
    async = require('async'),
    GitHubApi = require('github'),
    githubUrl = require('github-url-from-git'),
    NpmClient = require('npm-registry-client'),
    request = require('request');

module.exports = function (options, callback) {
  var github,
      npm;
  
  //
  // Create a github client.
  //
  github = new GitHubApi({
    // required
    version: "3.0.0",
    // optional
    timeout: 5000
  });
  
  //
  // Create an npm client.
  //
  npm = new NpmClient({
    registry: 'http://registry.npmjs.org',
    'fetch-retries': 3,
    cache: path.join(process.env.HOME, '.npm'),
    log: null
  });
  
  if (options.username && options.password) {
    github.authenticate({
      type: 'basic',
      username: options.username,
      password: options.password
    });
  }
  
  //
  // ### function getStars(pkg, next)
  // Gets the npm and github stars for the
  // specified `pkg`.
  //
  function getStars(pkg, next) {
    var stars = { name: pkg };
    
    //
    // Skip npm stars if requested
    //
    if (options['skip-npm-stars']) {
      return next(null, stars);
    }
    
    npm.request('GET', pkg, function (err, json) {
      if (err) { return next(null, null) }
      
      stars.npm = json.users
        ? Object.keys(json.users).length
        : 0;
      
      if (!json.repository || !json.repository.url
          || options['skip-github']) {
        stars.github = -1;
        return next(null, stars);
      }
      
      var url = githubUrl(json.repository.url),
          parts;
          
      if (!url) {
        stars.github = -1;
        return next(null, stars);
      }

      parts = url.split('/')
        .slice(-2);
      
      github.repos.get({
        user: parts[0],
        repo: parts[1]
      }, function (err, repo) {
        stars.github = repo && repo.watchers
          ? repo.watchers
          : 0;

        next(null, stars);
      })
    });
  }
  
  //
  // ### function getDependents (stars, next)
  // Counts all of the dependendents for the specified
  // stars object
  //
  function getDependents (stars, next) {
    console.log('getDependents', stars.name);
    request({
      url: 'http://isaacs.ic.ht/registry/_design/app/_view/dependedUpon',
      json: true,
      qs: {
        startkey: JSON.stringify([stars.name]),
        endkey:   JSON.stringify([stars.name, 'zzzzz'])
      }
    }, function (err, res, body) {
      console.dir(body);
      if (err || !body || !body.rows || !body.rows.length) {
        stars.dependent = 0;
        return next();
      }
      
      stars.dependent = body.rows[0].value;
      next();
    });
  }
  
  async.waterfall([
    //
    // 1. Get all binary packages
    //
    function listBinary(next) {
      request({
        url: 'http://isaacs.ic.ht/registry/_design/app/_view/needBuild',
        json: true
      }, function (err, res, body) {
        if (err || !body || !body.rows || !body.rows.length) {
          return next(err || new Error('Bad data returned from npm registry.'));
        }
        
        next(null, body.rows.map(function (row) {
          return row.id;
        }));
      });
    },
    //
    // 2. Get the github and npm stars for
    //    each of the binary packages
    //
    function getAllStars(packages, next) {
      async.mapLimit(packages, 10, getStars, next);
    },
    //
    // 3. Get the npm dependents for
    //    each of the binary packages
    //
    function getAllDependents(allStars, next) {
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
        .sort(function (lval, rval) {
          //
          // Just sort by Github stars. npm stars are basically
          // useless since no on uses them.
          //
          var lstar = lval.dependent,
              rstar = rval.dependent;

          if (lstar === rstar) { return 0 }
          return lstar < rstar ? 1 : -1;
        });
      
      next(null, stars);
    }
  ], callback);
};