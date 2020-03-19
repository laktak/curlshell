var child_process = require("child_process");
var fs = require("fs");

module.exports = function(config, cmd, status, req, res, arg, args) {
  function stat(text) {
    status(new Date().toJSON() + " " + req.connection.remoteAddress + " " + cmd.name + "/" + arg + " " + text);
  }

  var contentType,
    defaultContentType = "text/plain";
  var encoding = cmd.encoding || "utf8";
  var isStreaming = cmd.stream;
  var mergeErr = false,
    dumpErr = false;
  var isOpen = true;
  var out = "",
    err = "";

  switch (cmd.output) {
    case "binary":
      isBinary = isStreaming = true;
      encoding = "binary";
      defaultContentType = "application/octet-stream";
      break;
    default:
    case "full":
      mergeErr = true;
      break;
    case "append-err":
      dumpErr = true;
      break;
    case "no-err":
      break;
  }

  contentType = cmd.contentType || defaultContentType;

  stat(JSON.stringify(args));

  if (isStreaming) {
    res.writeHead(200, { "Content-Type": contentType, "Transfer-Encoding": "chunked" });
  } else res.setHeader("Content-Type", contentType);

  // push args to env
  var env = JSON.parse(JSON.stringify(process.env));
  env.ARG = arg;
  Object.keys(args).forEach(function(key) {
    env["ARG_" + key.toUpperCase()] = args[key];
  });

  function close(rc) {
    if (!isOpen) return;
    isOpen = false;

    // for rc!=0 try to set 500/Internal Server Error
    if (rc && !res.headersSent) res.writeHead(500);

    // write output (non streaming)
    if (out !== "") res.write(out, encoding);

    // write errors (if allowed)
    if (err !== "") {
      if (dumpErr) res.write("\ncurlshell: stderr <<<\n" + err);
      if (config.debug) stat("stderr\n" + err + "\n---\n");
    }

    // handle errors
    if (rc) {
      res.write("\ncurlshell: exit code " + rc + "\n");
      stat("exit " + rc);

      if (config.curlfail) {
        // generate invalid HTTP chunk to signal an error
        res._send("1\r\nERROR", "binary"); // curl: (56) Malformed encoding found in chunked-encoding
      }
    }

    if (config.debug) stat("close");
    res.end();
  }

  function onErr(label) {
    return function(err) {
      stat(label + "-err: " + err.toString());
      close(-1);
    };
  }

  var spawn = child_process.spawn("bash", ["-c", cmd.cmd], {
    cwd: cmd.cwd,
    env: env,
    encoding: encoding
  });
  spawn.stderr.on("data", function(data) {
    if (isStreaming && mergeErr) res.write(data);
    else if (mergeErr) out += data;
    else err += data;
  });
  spawn.stdout.on("data", function(data) {
    if (isStreaming) res.write(data, encoding);
    else out += data;
  });
  spawn.on("close", close);
  spawn.on("error", onErr("spawn"));
  spawn.stdin.on("error", function() {}); // ignore this error (the child process probably exited prematurely)

  var receivedSize = 0;
  req.on("data", function(data) {
    if (!isOpen) return;
    spawn.stdin.write(data, encoding);
    receivedSize += data.length;
  });
  req.on("end", function() {
    if (receivedSize) {
      stat("rcv " + receivedSize + " bytes");
    }
    spawn.stdin.end();
  });
  req.on("error", onErr("req"));
  res.on("error", onErr("res"));
};
