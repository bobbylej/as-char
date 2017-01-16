const express = require('express');
const app = express();
const fs = require('fs');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const http = require('http');
const async = require('async');
const ping = require('ping');
const nmap = require('node-nmap');
const sys = require('util');
const exec = require('child_process').exec;

const maxPrefixes = 4;
const maxHosts = 10;
const maxPing = 10;
const pingTime = 1500;

app.set('views', './templates')
app.set('view engine', 'pug');
app.use(express.static('scripts'));
app.use(express.static('styles'));
app.use(express.static('images'));

nmap.nodenmap.nmapLocation = "nmap";

app.get('/', function (req, res) {
  res.render('index');
});

app.get('/resultMock', function (req, res) {
  sendResultMock(res);
});

app.get('/result', function (req, res) {
  let resource = req.query.resource;
  console.log('Result for ' + resource);
  getResourceInfo(resource, data => {
    let AS = {
      resource: resource,
      stats: {},
    };
    let prefixes = new Array();
    let locations = new Array();

    data.data.locations.forEach(location => {
      location.prefixes.forEach(prefix => {
        prefixes.push(prefix);
      })
      locations.push({
        lng: location.longitude,
        lat: location.latitude
      });
    });

    if (prefixes.length > maxPrefixes) {
      prefixes = getRandomElements(prefixes, maxPrefixes);
    }
    console.log('Networks: ', prefixes);

    getHostsFromPrefixes(prefixes, prefixesHosts => {
      prefixes = prefixesHosts;
      let prefixesSize = prefixes.length;
      let hosts = new Array();
      prefixes.forEach(prefix => {
        if (prefix.hosts.length) {
          let hostsSize = prefix.hosts.length > maxHosts ? maxHosts : prefix.hosts.length;
          if (prefix.hosts.length > maxHosts) {
            prefix.hosts = getRandomElements(prefix.hosts, hostsSize);
          }
          prefix.hosts.forEach(host => {
            analyzeHost(prefix.prefix, host, result => {
              console.log('Complete analyze of ' + result.host);
              hosts.push(result);
              hostsSize--;
              if (hostsSize <= 0) {
                prefixesSize--;
                if (prefixesSize <= 0) {
                  prepereResult(AS, prefixes, hosts);
                  sendResult(res, AS, prefixes, locations);
                }
              }
            })
          });
        } else {
          prefixesSize--;
          if (prefixesSize <= 0) {
            prepereResult(AS, prefixes, hosts);
            sendResult(res, AS, prefixes, locations);
          }
        }
      });
    });
  });
});

function getHostsFromPrefixes(prefixes, callback) {
  let prefixesSize = prefixes.length;
  let prefixesResult = new Array();
  for(let p = 0; p < prefixes.length; p++) {
    let prefix = prefixes[p];
    getHostsFromPrefix(prefix, p, hosts => {
      prefixesResult.push({
        prefix: prefix,
        hosts: hosts
      });
      prefixesSize--;
      if(prefixesSize <= 0) {
        callback(prefixesResult);
      }
    });
  };
}

function getHostsFromPrefix(prefix, index, callback) {
  executeCommand(`nmap -sn -oX output/hosts_${index} --host-timeout 1 --max-rtt-timeout 1 --max-retries 2 ${prefix}`, data => {
    fs.readFile(__dirname + `/output/hosts_${index}`, 'utf8', (err, data) => {
      if (!err) {
        parser.parseString(data, (err, result) => {
          let hosts = new Array();
          if (result.nmaprun.host) {
            result.nmaprun.host.forEach(host => {
              hosts.push(host.address[0].$.addr);
            });
          }
          callback(hosts);
        });
      } else {
        console.error(err)
      }
    });
  });
}

function analyzeHost(prefix, host, callback) {
  let result = {
    prefix: prefix,
    host: host,
    locations: new Array(),
    times: new Array()
  }
  let stack = 2;
  getResourceInfo(host, data => {
    data.data.locations.forEach(location => {
      result.locations.push({
        lng: location.longitude,
        lat: location.latitude
      });
    });
    stack--;
    if (stack <= 0) {
      callback(result);
    }
  });
  let stackPing = maxPing;
  for (let i = 0; i < maxPing; i++) {
    setTimeout( () => {
      console.log('ping', host)
      ping.promise.probe(host).then((res) => {
        if (res.time) {
          result.times.push(res.time);
        }
        stackPing--;
        if (stackPing <= 0) {
          stack--;
          if (stack <= 0) {
            callback(result);
          }
        }
      });
    }, pingTime * i);
  }
}

function countASStats(prefixes) {
  let stats = {};
  let values = new Array();
  prefixes.forEach(prefix => {
    prefix.hosts.forEach(host => {
      if (host.times && host.times.length) {
        values = values.concat(host.times);
      }
    });
  });
  if (values.length) {
    stats.avg = average(values);
    stats.stddev = standardDeviation(values);
    stats.med = median(values);
  }
  return stats;
}

function countPrefixStats(prefix) {
  let stats = {};
  let values = new Array();
  prefix.hosts.forEach(host => {
    if (host.times && host.times.length) {
      values = values.concat(host.times);
    }
  });
  if (values.length) {
    stats.avg = average(values);
    stats.stddev = standardDeviation(values);
    stats.med = median(values);
  }
  return stats;
}

function countHostStats(host) {
  let stats = {};
  let values = new Array();
  if (host.times && host.times.length) {
    stats.avg = average(host.times);
    stats.stddev = standardDeviation(host.times);
    stats.med = median(host.times);
  }
  return stats;
}

function average(values) {
  let sum = values.reduce((previous, current) => current += previous);
  let avg = sum / values.length;
  return round2Decimal(avg);
}

function standardDeviation(values){
  let avg = average(values);

  let squareDiffs = values.map(function(value){
    let diff = value - avg;
    let sqrDiff = diff * diff;
    return round2Decimal(sqrDiff);
  });

  let avgSquareDiff = average(squareDiffs);

  let stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function median(values) {
  values.sort((a, b) => a - b);
  let lowMiddle = Math.floor((values.length - 1) / 2);
  let highMiddle = Math.ceil((values.length - 1) / 2);
  let median = (values[lowMiddle] + values[highMiddle]) / 2;
  return round2Decimal(median);
}

function getHostsByPrefix(hosts, prefix) {
  let prefixHosts = new Array();
  hosts.forEach(host => {
    if (host.prefix == prefix) {
      prefixHosts.push(host);
    }
  })
  return prefixHosts;
}

function getResourceInfo(resource, callback) {
  http.get({
    hostname: 'stat.ripe.net',
    path: `/data/geoloc/data.json?resource=${resource}&soft_limit=ignore`,
    agent: false  // create a new agent just for this one request
  }, (response) => {
    let body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      body = JSON.parse(body);
      callback(body);
    });
  });
}

function getRandomElements(hosts, amount) {
  let indexes = new Array();
  for(let i = 0; i < amount; i++) {
    let index = Math.floor(Math.random() * hosts.length);
    while(indexes.indexOf(index) != -1) {
      index = Math.floor(Math.random() * hosts.length);
    }
    indexes.push(index);
  }
  let resultHosts = new Array();
  indexes.forEach(index => {
    resultHosts.push(hosts[index]);
  })
  return resultHosts;
}

function prepereResult(AS, prefixes, hosts) {
  prefixes.forEach(prefix => {
    prefix.hosts = getHostsByPrefix(hosts, prefix.prefix);
    prefix.hosts.forEach(host => {
      host.stats = countHostStats(host);
    })
    prefix.stats = countPrefixStats(prefix);
  });
  AS.stats = countASStats(prefixes);
}

function sendResult(res, AS, prefixes, locations) {
  console.log('Send result for ' + AS.resource);
  res.render(
    'result',
    {
      AS: AS,
      prefixes: prefixes,
      locations: locations,
    }
  );
}

function sendResultMock(res) {
  var AS = {
    resource: '1291',
    stats: {
      avg: 10,
      stddev: 1,
      med: 11
    }
  }


  var locations = [
    {
      lat: 52,
      lng: 20
    }
  ]

  var prefixes = [
    {
      prefix: '1111',
      stats: {
        avg: 10,
        stddev: 1,
        med: 11
      },
      hosts: [
        {
          host: '11112222',
          stats: {
            avg: 10,
            stddev: 1,
            med: 11
          },
          locations: [
            {
              lat: 51.092,
              lng: 20.02
            }
          ]
        },
        {
          host: '11113333',
          stats: {
            avg: 10,
            stddev: 1,
            med: 11
          },
          locations: [
            {
              lat: 52,
              lng: 20
            }
          ]
        },
        {
          host: '11114444',
          stats: {
            avg: 10,
            stddev: 1,
            med: 11
          },
          locations: [
            {
              lat: 52,
              lng: 20
            }
          ]
        }
      ]
    },
    {
      prefix: '2222',
      stats: {
        avg: 10,
        stddev: 1,
        med: 11
      },
      hosts: [
        {
          host: '22222222',
          stats: {
            avg: 10,
            stddev: 1,
            med: 11
          },
          locations: [
            {
              lat: 51.092,
              lng: 20.02
            }
          ]
        },
        {
          host: '22223333',
          stats: {
            avg: 10,
            stddev: 1,
            med: 11
          },
          locations: [
            {
              lat: 52,
              lng: 20
            }
          ]
        },
        {
          host: '22224444',
          stats: {
            avg: 10,
            stddev: 1,
            med: 11
          },
          locations: [
            {
              lat: 52,
              lng: 20
            }
          ]
        }
      ]
    }
  ]

  res.render(
    'result',
    {
      AS: AS,
      prefixes: prefixes,
      locations: locations,
    }
  );
}

function executeCommand(command, callback){
    exec(command, function(error, stdout, stderr){ callback(stdout); });
};

function round2Decimal(num) {
  return Math.round(num * 100) / 100;
}

app.listen(3456, function () {
  console.log('Example app listening on port 3456!')
});
