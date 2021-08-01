# neige
neige is a command-line tool which facilitates sharing code between Node projects using Git repos as dependencies.

neige emerged from the need to share source code between React projects (shared components, Redux reducers, sagas, i18n files, ...) and not finding any satisfying solution amongst npm packages, Git submodules, ...

The name neige comes from **N**od**E** G**I**t dependency mana**GE**r. It also means snow in French but that's totally irrelevant.

## How to install

    npm i --save neige

## How to use

    npx neige [options] <command> [args]

## Odin's principle
It's very simple:
- describe your Git dependencies in neige.json
- use neige cli to initialise, update and manage your dependencies

neige uses the following source tree:
    <project root folder>
        + package.json
        + neige.json
        + src/
            <source files>
            deps/
                <Git repos managed by neigeg>
