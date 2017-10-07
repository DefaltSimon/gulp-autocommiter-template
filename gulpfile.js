// Globals
const gulp = require('gulp'),
    watch = require('gulp-watch'),
    runSequence = require('run-sequence'),
    execSync = require('child_process').execSync,
    util = require("gulp-util"),
    git = require("gulp-git");

// Paths
const paths = {
    dist: './dist/',
    src: './assets/'
};

const gitConfig = {
    // In seconds
    min_time_between_commits: 60 * 5,
    // Modified: index.html or Modified: index
    remove_file_extension: true,
    // Only autocommit files from that directory
    file_whitelist: "assets/"
};

function safeQuote(str) {
    return str.replace(/["']/g, "")
}

function getShortFilename(fn) {
    // Works with filenames with multiple dots
    let spl = fn.split("/");
    let file = spl[spl.length-1];

    if (gitConfig.remove_file_extension) {
        let s_name = file.split(".");
        s_name.splice(-1, 1);
        return s_name.join(" ")
    }
    else {
        return file
    }
}

function handleSpecialPaths(full_path) {
    if (full_path.startsWith("assets/scripts")) {
        return "script: " + getShortFilename(full_path)
    }
    else if (full_path.startsWith("assets/images")) {
        return "image: " + getShortFilename(full_path)
    }
    else if (full_path.startsWith("assets/styles")) {
        return "styles: " + getShortFilename(full_path)
    }
    else if (full_path.startsWith("assets/templates")) {
        return "html: " + getShortFilename(full_path)
    }
    else {
        return getShortFilename(full_path)
    }
}

function getTime() {
    return (new Date).getTime() / 1000;
}

// Layout: Object(file_name: time)
let commit_times = {};

function addAllFiles() {
    // Adds files into git
    git.exec({args: "add .", silent: true});
}

function commitChangedFiles(ignore_thr) {
    // Ignores throttling
    if (typeof ignore_thr === "undefined") {
        ignore_thr = false
    }

    git.status({args : "--porcelain", quiet: true}, function (err, stdout) {
        let lines = stdout.split("\n");
        let change_amount = 0;

        lines.forEach(function (change) {
            // Ignore empty lines
            if (!change) {
                return
            }
            // Collapse 2+ spaces/tabs
            change = change.trim().replace(/[\ \t]{2,}/g, " ");

            // REFER TO https://git-scm.com/docs/git-status#_output
            let temp = change.split(" ");

            // Action: A,D,R,M,C
            // Use only first character
            let action = temp[0][0];
            // Filename(s)
            temp.splice(0, 1);
            let raw_filename = temp.join(" ");

            // Check path whitelist
            if (!raw_filename.startsWith(gitConfig.file_whitelist)) {
                return
            }

            // Check last commit time
            let last_time = commit_times[raw_filename];
            if (typeof last_time !== "undefined") {
                if (!ignore_thr && (getTime() - last_time) < gitConfig.min_time_between_commits) {
                    return
                }
            }

            // Generate commit message
            change_amount += 1;
            let commit_text;

            if (action === "A") {
                commit_text = "Added " + handleSpecialPaths(raw_filename)
            }
            else if (action === "D") {
                commit_text = "Deleted " + handleSpecialPaths(raw_filename)
            }
            else if (action === "M") {
                commit_text = "Modified " + handleSpecialPaths(raw_filename)
            }
            else if (action === "R") {
                let [old_n, new_n] = raw_filename.split(" -> ");
                commit_text = "Renamed: from " + getShortFilename(old_n) + " to " + getShortFilename(new_n)
            }
            else {
                // Do not throw error for ignored/untracked files
                if (action === "?" || action === "!") { return }
                throw new Error("unknown status: " + action)
            }

            // Not javascripty, but what can you do
            execSync('git commit -m "' + safeQuote(commit_text) + '" "' + safeQuote(raw_filename) + '"');

            // Update timestamp
            commit_times[raw_filename] = getTime();
            util.log("New commit: " + commit_text)
        });

    });

}

gulp.task("git-add", function () {
    addAllFiles()
});

// git autocommit
gulp.task("autocommit-force", function () {
    addAllFiles();
    commitChangedFiles(true)
});

gulp.task("autocommit", function () {
    commitChangedFiles(false)
});

// Clean
gulp.task('clean', require('del').bind(null, [paths.dist]));

// The default task
gulp.task('default', function() {
    runSequence(
        "git-add",
        'clean',
        'html',
        'watch');
});

// Example task with html
gulp.task('html', function() {
    return gulp.src([paths.src + 'templates/*.html'])
        .pipe(gulp.dest(paths.dist));
});

// Watches for changes in folders, then triggers gulp tasks
gulp.task('watch', function() {
    // Example watch
    gulp.watch('./assets/templates/**/*', ['html']);
    // Set stuff up for other folders
    // ...

    // then
    gulp.watch("./assets/**/*", ["autocommit"])
});