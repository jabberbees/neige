#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const NEIGE_NAME = 'neige';
const NEIGE_VERSION = '1.0.0';

const NEIGE_CONFIG_FILE = 'neige.json';
const NPM_CONFIG_FILE = 'package.json';

function readJson(path) {
    const raw = fs.readFileSync(path);
    const result = JSON.parse(raw);
    return result;
}

function readJsonSafe(path, defaultJson = {}) {
    try {
        return readJson(path);
    }
    catch {
        return defaultJson;
    }
}

function writeJson(path, data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function quotify(text) {
    return `"${text}"`;
}

class GitChange {
    constructor(status, path, originalPath) {
        this.status = status;
        this.path = path;
        this.originalPath = originalPath;
    }

    toString() {
        const result = this.status
            + (this.originalPath ? ' ' + this.originalPath + ' -> ' : ' ')
            + this.path;
        return result;
    }

    static parse(line) {
        const fields = line.split(' ');
        if (fields.length === 4 && fields[2] === '->') {
            return new GitChange(fields[0], fields[3], fields[1]);
        }
        else if (fields.length === 3) {
            return new GitChange(fields[1], fields[2]);
        }
        else {
            return new GitChange(fields[0], fields[1]);
        }
    }
}

class Git {
    static clone(url, path, options = {}) {
        const args = [];
        if (options.noCheckout) {
            args.push('-n');
        }
        args.push(url);
        args.push(path);
        return Git.execute('clone', args, options.process);
    }

    static checkout(what, options = {}) {
        const args = [];
        if (options.quiet) {
            args.push('--quiet');
        }
        args.push(what);
        return Git.execute('checkout', args, options.process);
    }

    static fetchAll(options = {}) {
        const args = [];
        args.push('--all');
        if (options.quiet) {
            args.push('--quiet');
        }
        return Git.execute('fetch', args, options.process);
    }

    static tag(tag, options = {}) {
        const args = [];
        args.push(quotify(tag));
        return Git.execute('tag', args, options.process);
    }

    static pushTag(tag, remote = 'origin', options = {}) {
        const args = [];
        args.push(quotify(remote));
        args.push('tag');
        args.push(quotify(tag));
        if (options.quiet) {
            args.push('--quiet');
        }
        else {
            args.push('--progress');
        }
        return Git.execute('push', args, options.process);
    }

    static deleteTag(tag, options = {}) {
        const args = [];
        args.push('--delete');
        args.push(quotify(tag));
        return Git.execute('tag', args, options.process);
    }

    static pushDeleteTag(tag, remote = 'origin', options = {}) {
        const args = [];
        args.push('--delete');
        args.push(quotify(remote));
        args.push('tag');
        args.push(quotify(tag));
        if (options.quiet) {
            args.push('--quiet');
        }
        else {
            args.push('--progress');
        }
        return Git.execute('push', args, options.process);
    }

    static fetch(repositoryOrGroup, options = {}) {
        const args = [];
        if (options.quiet) {
            args.push('--quiet');
        }
        args.push(repositoryOrGroup);
        return Git.execute('fetch', args, options.process);
    }

    static pull(origin, branch, options = {}) {
        const args = [];
        if (options.fastForwardOnly) {
            args.push('--ff-only');
        }
        if (options.noRebase) {
            args.push('--no-rebase');
        }
        if (options.quiet) {
            args.push('--quiet');
        }
        args.push(origin);
        args.push(branch);
        return Git.execute('pull', args, options.process);
    }

    static add(args, options = {}) {
        return Git.execute('add', args, options.process);
    }

    static status(options = {}) {
        const args = [];
        if (options.porcelain === true) {
            args.push('--porcelain');
        }
        else if (options.porcelain) {
            args.push(`--porcelain=${options.porcelain}`);
        }
        const output = Git.execute('status', args, options.process);
        if (!output) {
            return output;
        }
        const lines = output
            .toString()
            .split('\n')
            .filter(line => line !== '');
        if (options.porcelain === true) {
            return lines.map(line => GitChange.parse(line));
        }
        else {
            return lines;
        }
    }

    static escape(arg) {
        return arg.includes(' ') ? `'${arg}'` : arg;
    }

    static execute(command, args, options = {}) {
        const commandLine = `git ${command} ${args.map(arg => Git.escape(arg)).join(' ')}`;

        if (options.verbose) {
            console.log("Git.execute", commandLine);
        }

        try {
            return execSync(commandLine, options);
        }
        catch (e) {
        }
    }
};

class Configuration {
    constructor(data = {}, npm = {}) {
        this.data = {
            root: './deps',
            pathConvention: 'posix',
            deps: {},
            ...data
        };
        this.npm = { ...npm };
        this.path = data.pathConvention === 'posix' ? path.posix : path.win32;
    }

    depNames() {
        return Object.keys(this.data.deps);
    }

    rootPath() {
        const { root } = this.data;
        return root;
    }

    rootSubdirs() {
        return fs.readdirSync(this.rootPath())
            .filter(name => fs.statSync(this.repoPath(name)).isDirectory());
    }

    repoPath(name) {
        const { root } = this.data;
        const path = this.path.format({ dir: root, name });
        return path;
    }

    repoDirExists(name) {
        const path = this.repoPath(name);
        return fs.existsSync(path);
    }

    cloneRepo(name) {
        const dep = this.data.deps[name];

        const { url } = dep;
        const path = this.repoPath(name);

        console.log(`cloning ${url} into ${path}`);

        Git.clone(url, path, {
            noCheckout: true,
            process: { stdio: 'inherit' }
        });

        const { tag, branch = 'master' } = dep;
        const process = { cwd: path, stdio: 'inherit' };

        if (tag) {
            console.log("checking out tag", tag);
            Git.checkout(tag, {
                quiet: true,
                process
            });
        }
        else {
            console.log("checking out branch", branch);
            Git.checkout(branch, {
                quiet: true,
                process
            });
            console.log("pull origin", branch);
            Git.pull('origin', branch, {
                fastForwardOnly: true,
                noRebase: true,
                quiet: true,
                process
            })
        }
    }

    updateRepo(name) {
        const dep = this.data.deps[name];

        const path = this.repoPath(name);
        const process = { cwd: path, stdio: 'inherit' };

        console.log("fetching from remotes")
        Git.fetchAll({
            quiet: true,
            process
        });

        const { tag, branch = 'master' } = dep;

        if (tag) {
            console.log("checking out tag", tag);
            Git.checkout(tag, {
                quiet: true,
                process
            });
        }
        else {
            console.log("checking out branch", branch);
            Git.checkout(branch, {
                quiet: true,
                process
            });

            console.log("pull origin", branch);
            Git.pull('origin', branch, {
                fastForwardOnly: true,
                noRebase: true,
                quiet: true,
                process
            })
        }
    }

    tagRepo(name, tag) {
        const path = this.repoPath(name);
        const process = { cwd: path, stdio: 'inherit' };

        console.log("adding tag");
        Git.tag(tag, {
            quiet: true,
            process
        });

        console.log("pushing tag to remote");
        Git.pushTag(tag, 'origin', {
            quiet: true,
            process
        });
    }

    untagRepo(name, tag) {
        const path = this.repoPath(name);
        const process = { cwd: path, stdio: 'inherit' };

        console.log("delete tag");
        Git.deleteTag(tag, {
            quiet: true,
            process
        });

        console.log("delete tag from remote");
        Git.pushDeleteTag(tag, 'origin', {
            quiet: true,
            process
        });
    }

    git(name, command, args) {
        const path = this.repoPath(name);
        const process = { cwd: path, stdio: 'inherit' };
        Git.execute(command, args, process);
    }

    save(path = NEIGE_CONFIG_FILE) {
        writeJson(path, this.data);
    }

    analyseDependencies() {
        const names = this.depNames();
        const missing = {};
        for (const current of names) {
            const path = this.repoPath(current);
            const dep = Configuration.load(path);
            for (const name of dep.depNames()) {
                if (!names.includes(name)) {
                    if (!missing[name]) {
                        missing[name] = [];
                    }
                    missing[name].push(current);
                }
            }
        }
        return missing;
    }

    static load(dir = '.') {
        const neigeJson = path.posix.format({ dir, name: NEIGE_CONFIG_FILE });
        const npmJson = path.posix.format({ dir, name: NPM_CONFIG_FILE });
        const data = { deps: {}, ...readJsonSafe(neigeJson) };
        const npm = { dependencies: {}, ...readJsonSafe(npmJson) };
        return new Configuration(data, npm);
    }
}

class Command {
    constructor(options = {}, args = []) {
        this.options = options;
        this.args = args;
    }

    execute() {
        this.beforeExecute();
        this.doExecute();
        this.afterExecute();
    }

    beforeExecute() {
    }

    doExecute() {
    }

    afterExecute() {
        console.log();
    }
}

class HelpCommand extends Command {
    doExecute() {
        console.log("usage: neige [--version] [--help] <command> <args>");
        console.log("");
        console.log("Available commands are:");
        console.log("");
        console.log("init");
        console.log("status");
        console.log("get");
        console.log("update");
        console.log("tag");
        console.log("untag");
    }
}

class VersionCommand extends Command {
    doExecute() {
        console.log(`${NEIGE_NAME} v${NEIGE_VERSION}`);
    }
}

class Init extends Command {
    doExecute() {
        if (fs.existsSync(NEIGE_CONFIG_FILE)) {
            console.log(`ignored: existing ${NEIGE_CONFIG_FILE} file found`);
        }
        else {
            const configuration = new Configuration();
            console.log(`creating ${NEIGE_CONFIG_FILE}`);
            configuration.save();
        }
    }
}

class WithConfiguration extends Command {
    beforeExecute() {
        this.configuration = Configuration.load();
    }
}

class Status extends WithConfiguration {

    status(name, path, porcelain, showChanges) {
        const changes = Git.status({ porcelain, process: { cwd: path } });
        const hasChanges = changes.length > 0;
        const status = hasChanges ? `${changes.length} change(s) found` : '';
        console.log(`STATUS ${name} ${status}`);
        if (showChanges) {
            for (const change of changes) {
                const line = change.toString();
                console.log(`\t${line}`);
            }
        }
        return hasChanges;
    }

    doExecute() {
        const names = this.args.length > 0 ? this.args : this.configuration.depNames();
        const showChanges = names.length === 1;
        const porcelain = true;
        let modifiedRepos = 0, missingRepos = 0;
        for (const name of names) {
            const exists = this.configuration.repoDirExists(name);
            if (exists) {
                const path = this.configuration.repoPath(name);
                if (this.status(name, path, porcelain, showChanges)) {
                    modifiedRepos++;
                }
            }
            else {
                console.log(`STATUS ${name} missing`);
                missingRepos++;
            }
        }
        if (this.status(this.configuration.npm.name, '.', porcelain, showChanges)) {
            modifiedRepos++;
        }

        const orphans = this.configuration.rootSubdirs()
            .filter(name => !names.includes(name));
        if (orphans.length > 0) {
            console.log();
            for (const name of orphans) {
                console.log(`ORPHAN! ${name}`);
            }
        }

        const missing = this.configuration.analyseDependencies();
        const missingKeys = Object.keys(missing);
        if (missingKeys.length > 0) {
            console.log();
            for (const name of missingKeys) {
                console.log(`MISSING! ${name} used by ${missing[name].join(', ')}`);
            }
        }

        console.log();
        console.log(`repositories: ${modifiedRepos} modified, ${missingRepos} missing, ${orphans.length} orphans.`);
    }
}

class GitCommand extends WithConfiguration {
    doExecute() {
        const command = this.args.shift();
        const name = this.args.shift();
        this.configuration.git(name, command, this.args);
    }
}

class GetDeps extends WithConfiguration {
    doExecute() {
        const names = this.args.length > 0 ? this.args : this.configuration.depNames();
        for (const name of names) {
            const path = this.configuration.repoPath(name);
            const exists = this.configuration.repoDirExists(name);
            const status = exists ? 'found -> ignored' : 'cloning';
            console.log(`GET ${name} ${status}`);
            if (!exists) {
                this.configuration.cloneRepo(name);
            }
        }
    }
}

class UpdateDeps extends WithConfiguration {
    doExecute() {
        const names = this.configuration.depNames();
        for (const name of names) {
            const exists = this.configuration.repoDirExists(name);
            const status = exists ? '' : 'not found -> ignored';
            console.log(`UPDATE ${name} ${status}`);
            if (exists) {
                this.configuration.updateRepo(name);
            }
        }
    }
}

class TagDeps extends WithConfiguration {
    doExecute() {
        const tag = `${this.configuration.npm.name}-${this.configuration.npm.version}`;
        const names = this.configuration.depNames();
        for (const name of names) {
            const exists = this.configuration.repoDirExists(name);
            const status = exists ? '' : 'not found -> ignored';
            console.log(`TAG ${name} ${tag} ${status}`);
            if (exists) {
                this.configuration.tagRepo(name, tag);
            }
        }
    }
}

class UntagDeps extends WithConfiguration {
    doExecute() {
        const tag = `${this.configuration.npm.name}-${this.configuration.npm.version}`;
        const names = this.configuration.depNames();
        for (const name of names) {
            const exists = this.configuration.repoDirExists(name);
            const status = exists ? '' : 'not found -> ignored';
            console.log(`UNTAG ${name} ${tag} ${status}`);
            if (exists) {
                this.configuration.untagRepo(name, tag);
            }
        }
    }
}

class CommandLine {
    constructor(command) {
        this.command = command;
    }

    execute() {
        this.command.execute();
    }

    static parse(argv) {
        const args = [...argv];
        args.shift(); // skip node
        args.shift(); // skip js script

        const options = {};

        while (args.length > 0 && args[0].startsWith('-')) {
            const arg = args.shift();
            if (arg === '--help') {
                return new CommandLine(new HelpCommand());
            }
            else if (arg === '--version') {
                return new CommandLine(new VersionCommand());
            }
            else {
                return new CommandLine(new HelpCommand());
            }
        }

        if (args.length === 0) {
            return new CommandLine(new HelpCommand());
        }

        const command = args.shift();

        if (command === 'init') {
            return new CommandLine(new Init(options, args));
        }
        else if (command.startsWith('git-')) {
            const cmd = command.substr(4);
            return new CommandLine(new GitCommand(options, [cmd, ...args]));
        }
        else if (command === 'status') {
            return new CommandLine(new Status(options, args));
        }
        else if (command === 'get') {
            return new CommandLine(new GetDeps(options, args));
        }
        else if (command === 'update') {
            return new CommandLine(new UpdateDeps(options, args));
        }
        else if (command === 'tag') {
            return new CommandLine(new TagDeps(options, args));
        }
        else if (command === 'untag') {
            return new CommandLine(new UntagDeps(options, args));
        }
        else {
            return new CommandLine(new HelpCommand());
        }
    }
}

CommandLine
    .parse(process.argv)
    .execute();
