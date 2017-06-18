'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getScrapings = getScrapings;
var cheerio = require('cheerio');
var axios = require('axios');
var fs = require('fs');
var util = require('util');

var writeFile = util.promisify(fs.writeFile);
var readFile = util.promisify(fs.readFile);

function curry(fn) {
  return function () {
    if (fn.length > arguments.length) {
      var slice = Array.prototype.slice;
      var args = slice.apply(arguments);
      return function () {
        return fn.apply(null, args.concat(slice.apply(arguments)));
      };
    }
    return fn.apply(null, arguments);
  };
}

var promisify = curry(function (fn, args) {
  new Promise(function (resolve, reject) {
    return fn(args, function (err, res) {
      if (err) {
        return reject(err.message);
      }
      return resolve(res);
    });
  });
});

var sites = [{
  url: 'https://news.ycombinator.com/news',
  output: 'hackernews',
  handler: getNews,
  format: '.json'
}, {
  url: 'https://news.ycombinator.com/jobs',
  output: 'hackernewsJobs',
  handler: getJobs,
  format: '.txt'
}];

function append(output, data, link) {
  var format = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '.json';

  var outputFile = output + format;
  if (format === '.json') {
    var json = JSON.stringify({ link: link, data: data }, null, 2);
    if (!process.env.HEROKU) {
      fs.appendFileSync(outputFile, json + ',\n');
    }
    return json;
  } else if (format === '.txt') {
    if (!process.env.HEROKU) {
      fs.appendFileSync(outputFile, data + '\n ' + link + '\n\n');
    }
    return {
      data: data,
      link: link
    };
  }
}

var parseHtml = function parseHtml(htmlString, output, parseFn, format) {
  var ch = cheerio.load(htmlString);
  return writeFile(output + format, 'Date: ' + new Date().toLocaleTimeString() + '\n\n').then(function () {
    return parseFn(ch, output);
  });
};

function getNews(ch, output) {
  return ch('tr.athing:has(td.votelinks)').map(function (index) {
    var title = ch(this).find('td.title > a').text().trim();
    var link = ch(this).find('td.title > a').attr('href');
    return append(output, title, link);
  }).get();
}

function getJobs(ch, output) {
  return ch('tr.athing:has(td.title)').map(function (index) {
    var job = ch(this).find('td.title > a').text().trim();
    var jobLink = ch(this).find('td.title > a').attr('href');
    return append(output, job, jobLink);
  }).get();
}

function getScrapings(req, res) {
  Promise.all(sites.map(function (topic) {
    var url = topic.url,
        handler = topic.handler,
        output = topic.output,
        format = topic.format;

    return axios(url).then(function (res) {
      return parseHtml(res.data, output, handler, format);
    });
  })).then(function (result) {
    return res.send(result);
  }).catch(function (e) {
    return console.log('error', e);
  });
  //readFile('hackernewsJobs.json', 'utf8').then(json => {
  //res.send(json);
  //});
}