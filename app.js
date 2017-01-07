const express = require('express');
const app = express();
const http = require('http');
const ping = require('ping');

app.get('/', function (req, res) {
  res.send('AS-char');
})

app.get('/http/:resource', function (req, res) {
  let resource = req.params.resource || 'AS8771';

  http.get({
    hostname: 'stat.ripe.net',
    path: `/data/geoloc/data.json?resource=${resource}&soft_limit=ignore`,
    agent: false  // create a new agent just for this one request
  }, (response) => {
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      console.log(body)
    });
  });
  res.send('AS-char');
})

app.get('/ping', function (req, res) {
  var hosts = ['192.168.1.1', 'google.com', 'yahoo.com'];
  hosts.forEach(function(host) {
    ping.sys.probe(host, function(isAlive) {
      var msg = isAlive ? 'host ' + host + ' is alive' : 'host ' + host + ' is dead';
      console.log(msg);
    });
    // get time
    ping.promise.probe(host)
    .then(function (res) {
      console.log(res);
    });
  });

  res.send('ping');
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
