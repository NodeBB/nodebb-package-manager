## NodeBB Package Manager

## How to push 

First install the CLI:
https://docs.appfog.com/getting-started/af-cli


Open Ruby Command Prompt:

```
af login rodrigues.andrew@gmail.com / our standard pw with numbers and letters
af update psychobunny
```

(Obviously, don't forget to test because then all NodeBBs will explode :P)

## Compiling on Windows

Delete these folders:

```
\node_modules\npm-package-sync\node_modules\request\node_modules\form-data\node_modules\combined-stream\test
\node_modules\npm-package-sync\node_modules\request\node_modules\form-data\node_modules\combined-stream\node_modules\delayed-stream\test\
```