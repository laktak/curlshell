
var http=require("http");
var url=require("url");
var path=require("path");
var crypto=require("crypto");
var auth=require("http-auth");
var serve=require("./serve.js");

var realm="curlshell";
var server;

var xo=module.exports={
  status: function(){},
  start: start,
};

function dmd5(user, realm, password) {
  var md5=crypto.createHash("md5");
  md5.update(user+":"+realm+":"+password);
  return md5.digest("hex");
}

function start(config, basedir) {
  if (server) return;

  var commands=[];
  var status=xo.status;

  // parse config
  Object.keys(config.commands).forEach(function(name) {
    var cmd=config.commands[name];
    cmd.name=name;
    cmd.cwd=path.join(basedir, cmd.cwd||".");
    commands.push({ path: "/"+name+"/", exec: serve.bind(null, config, cmd, status) });
  });

  server=http.createServer; // patched by http-auth
  var users=config.digest;
  if (users) {
    status("Using digest auth");
    server=server.bind(null, auth.digest({ realm: realm }, function(username, callback) {
      var password=users[username];
      if (password) callback(dmd5(username, realm, password));
      else callback();
    }));
  }

  server(function(req, res) {
    var rurl=url.parse(req.url, true), cmd=rurl.pathname, args=rurl.query;
    if (cmd.substr(cmd.length-1, 1)!=="/") cmd+="/";
    var exec=commands.filter(function(x) { return cmd.substr(0, x.path.length)===x.path; })[0]; // todo/es6 use .find
    if (exec) exec.exec(req, res, cmd.substr(exec.path.length, cmd.length-exec.path.length-1), args);
    else {
      res.writeHead(404);
      res.end("Unknown.");
    }
  }).listen(config.port, function() {
    status("curlshell listening on port "+config.port+" (e.g. 'curl localhost:"+config.port+"/cmd')");
  });
}
