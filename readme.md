# nsfw.d

## Install

```bash
$ npm install -g nsfw.d
```


## CLI

```bash
$ nsfw.d <path>

🚀 File watcher socket daemon.

Positionals:
  path  Relative path to the watching directory                         [string]

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
  -sp        Static file port                                          [string]
  -wp        WebSocket port                                            [string]
```


## Development

There are 2 available commands:

- `npm run dev` - Start development mode and recompile on change
- `npm run build` - Build a final distributable for npm
