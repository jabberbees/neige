# neige
neige is a command-line tool which facilitates sharing code between Node projects using Git repos as dependencies.

neige emerged from the need to share source code between React projects (shared components, Redux reducers, sagas, i18n files, ...) and not finding any satisfying solution amongst npm packages, Git submodules, ...

The name neige comes from **N**od**E** G**I**t dependency mana**GE**r. It also means snow in French but that's totally irrelevant.

## How to install

    npm i --save neige

## How to use

```
npx neige [--version] [--help] <command> [args]

Available commands are:

init    initialises en empty neige.json configuration file
status  provides information on modified, missing, orphan dependency repos
get     clones missing repos in dependency location
update  updates all repos
tag     adds the `${name}-${version}` tag to all dependency repos (using name and version fields from package.json)
untag   removes the `${name}-${version}` tag from all dependency repos (using name and version fields from package.json)
```

## Neige's principle
It's very simple:
- describe your Git dependencies in neige.json
- add your dependencies location (default location is ./src/deps) to .gitignore
- use neige cli to initialise, update and manage your dependencies

neige assumes the following source tree:
```
    <project root folder>
        + src/
            deps/
                <here are placed Git repos managed by neige>
            <source files>
        + package.json
        + neige.json
```

## neige.json
neige.json is Neige's configuration file (JSON).

The following fields are supported:
  * root: location where dependency repos are to be cloned. Defaults to ./src/deps
  * pathConvention: specifies path conventions, values supported are
    * posix
    * win32
  * deps: JSON object describing repo dependencies, using one field per dependency  

Example:
```
{
  "root": "./src/deps",
  "pathConvention": "posix",
  "deps": {
    "lib-one": {
      "url": "https://github.com/fakeorg/lib1",
      "branch": "master"
    },
    "lib-two": {
      "url": "https://github.com/fakeorg/lib2",
      "tag": "v3.14"
    },
}
```

This would lead to the following source tree:
```
    <project root folder>
        + src/
            deps/
                lib-one/
                    <content cloned from https://github.com/fakeorg/lib1>
                lib-two/
                    <content cloned from https://github.com/fakeorg/lib2>
            <source files>
        + package.json
        + neige.json
```

## Neige integration with npm
We recommend to add the following scripts in package.json

```
  ...
  "scripts": {
    ...
    "get-deps": "npx neige get",
    "update-deps": "npx neige update",
  }
```

and have them executed from postinstall:

```
  ...
  "scripts": {
    ...
    "postinstall": "npm run get-deps && npm run update-deps",
    ...
  }
```

This way, neige dependencies will be fetched and updated automatically each time you execute:
```
npm install
```
