# curlshell

curlshell runs a HTTP server that serves predefined shell scripts to curl.

You can use curl in your scripts to execute commands on the curlshell machine. If binary IO is required pipe to tar.

curlshell is best used in a Docker environment by linking to the container without exposing its port publicly.

*Why not use sshd serving predefined commands?* sshd is not a good match for Docker and it is not trivial to set up. ForceCommand can be circumvented so you need to set a custom shell.

**curlshell is to be used with trusted callers only! Don't expose it to the internet!**

## Installation

```
npm i curlshell -g
```

Create your initial configuration:

```
curlshell -init > config.hjson
```

Run with

```
curlshell config.hjson
```

## Configuration

The config file is in [hjson format](http://hjson.org) though you can use regular JSON as well.

For the full list of options see [template.hjson](template.hjson).

### commands:

Each item defines a script listening at the given name. E.g. `commands: { hello: { ... } }` will listen at `/hello`.

- `cmd` defines the script you wish to execute with bash (can be multiline).
  `$ARG` will contain the subpath (if any)
  `$ARG_*` will be set for each supplied argument (uppercase)

- `cwd` defines the current working directory (relative to this config)

- `stream`
  true: send the output immedeately (for long running tasks and large binary output)
  false: buffers everything until the command exits

- `output` defines what should be sent to curl as the body.
  - full: return stdout+stderr (mixed)
  - append-err: return stdout, append stderr
  - no-err: return stdout, hide stderr
  - binary: return binary, hide stderr

Samples:

```
hello: {
  # curl localhost:8080/hello?name=human

  cmd:
    '''
    if [[ $ARG_NAME ]]; then
      echo "Hello $ARG_NAME!"
    else
      echo "What's your name?"
    fi
    '''
}

ping: {
  # curl localhost:8080/ping

  cmd: ping 127.0.0.1 -c 10
  stream: true
}

count: {
  # curl -T YOURFILE http://localhost:8080/count

  cmd: echo You sent us `wc -c` bytes!
}

getsh: {
  # curl http://localhost:8080/getsh | tar -t

  cmd: tar -cz -C /bin .
  output: binary
  stream: true
}
```

### digest authentication

Use with curl --digest -uUSER:PASS

e.g. curl --digest -uhugo:vroom localhost:8080/hello

