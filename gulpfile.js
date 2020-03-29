const { src, dest, watch, parallel, series } = require('gulp');
const del = require('del');
const concat = require('gulp-concat');
const browserSync = require('browser-sync').create();
const wait = require('gulp-wait');
const imagemin = require('gulp-imagemin');

const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
sass.compiler = require('node-sass');

const uglify = require('gulp-uglify');
const babel = require('gulp-babel');

// VARIABLES
const paths = {
  development: {
    root: './_dev',
    sass: './_dev/assets/sass',
    css: './_dev/assets/css',
    js: './_dev/assets/javascript',
    img: './_dev/assets/images'
  },
  build: {
    root: './_build',
    sass: './_build/assets/sass',
    css: './_build/assets/css',
    csslib: './_build/assets/css/lib',
    jslib: './_build/assets/javascript/lib',
    js: './_build/assets/javascript',
    img: './_build/assets/images'
  }
};

const files = {
  mainCSS: 'styles',
  mainJS: 'app.js',
  js: [paths.development.js + '/app/myScript.js'],
  csslib: paths.development.css + '/lib/**/*.css',
  jslib: paths.development.js + '/lib/**/*.js',
  html: paths.development.root + '/**/*.html',
  php: paths.development.root + '/**/*.php'
};

// UTILS
async function cleanBuild(cb) {
  await del(paths.build.root);
  cb();
}

// DEVELOPMENT TASKS
// -----------------------
// --------- SASS
function devSASS(cb) {
  src(paths.development.sass + '/' + files.mainCSS + '.scss')
    .pipe(wait(300)) // Needed for file ready
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        outputStyle: 'expanded'
      })
    )
    .on('error', sass.logError)
    .pipe(postcss([autoprefixer()]))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(paths.development.css));
  cb();
}
// --------- JavaScript
function devJS(cb) {
  src(files.js)
    .pipe(concat(files.mainJS))
    .pipe(dest(paths.development.js));
  cb();
}

// BUILD TASKS
// -----------------------
// --------- HTML and PHP
function buildHTML(cb) {
  src(files.html).pipe(dest(paths.build.root));
  cb();
}
function buildPHP(cb) {
  src(files.php).pipe(dest(paths.build.root));
  cb();
}
// --------- CSS
function buildCSS(cb) {
  // 1. COPY EXTERNAL LIB CSS FILES TO BUILD
  // src('./_dev/assets/css/lib/**/*.css').pipe(dest('./_build/assets/css/lib'));
  src(files.csslib).pipe(dest(paths.build.csslib));

  // 2. MINIFY OWN CSS AND COPY TO BUILD
  src(paths.development.css + '/' + files.mainCSS + '.css')
    .pipe(postcss([autoprefixer(), cssnano()]))
    .pipe(dest(paths.build.css));
  cb();
}

// --------- JavaScript
function buildJS(cb) {
  // 1. COPY EXTERNAL LIB JS FILES TO BUILD
  src(files.jslib).pipe(dest(paths.build.jslib));

  // 2. MINIFY OWN JS AND COPY TO BUILD
  src(paths.development.js + '/' + files.mainJS)
    .pipe(
      babel({
        presets: ['@babel/env']
      })
    )
    .pipe(uglify())
    .pipe(dest(paths.build.js));
  cb();
}

// IMAGE OPTIMIZE
function buildImages(cb) {
  src(paths.development.img + '/**/*.*')
    .pipe(wait(500))
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.mozjpeg({ quality: 80, progressive: true, smooth: 0 }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo({
          plugins: [{ removeViewBox: true }, { cleanupIDs: false }]
        })
      ])
    )
    .pipe(dest(paths.build.img));
  cb();
}

// SEVER AND WATCHERS
function devServer(cb) {
  browserSync.init({
    notify: false,
    open: false,
    server: {
      baseDir: paths.development.root
    }
  });
  cb();
}
function devWatcher(cb) {
  watch(paths.development.root + '/**/*.html').on('change', browserSync.reload);
  watch(paths.development.root + '/**/*.php').on('change', browserSync.reload);
  watch(paths.development.root + '/assets/javascript/**/*.js').on(
    'change',
    series(devJS, browserSync.reload)
  );
  watch(paths.development.root + '/assets/css/**/*.css').on(
    'change',
    browserSync.reload
  );
  watch(paths.development.root + '/assets/sass/**/*.scss').on(
    'change',
    series(devSASS, browserSync.reload)
  );
  cb();
}
function buildServer(cb) {
  browserSync.init({
    notify: false,
    open: false,
    port: 4000,
    ui: {
      port: 4001
    },
    server: {
      baseDir: paths.build.root
    }
  });
  cb();
}
function buildWatcher(cb) {
  watch(paths.development.root + '/**/*.html').on(
    'change',
    series(buildHTML, browserSync.reload)
  );
  watch(paths.development.root + '/**/*.php').on(
    'change',
    series(buildPHP, browserSync.reload)
  );
  watch(paths.development.root + '/assets/javascript/**/*.js').on(
    'change',
    series(devJS, buildJS, browserSync.reload)
  );
  watch(paths.development.root + '/assets/css/**/*.css').on(
    'change',
    series(buildCSS, browserSync.reload)
  );
  watch(paths.development.root + '/assets/sass/**/*.scss').on(
    'change',
    series(devSASS, buildCSS, browserSync.reload)
  );
  watch(paths.development.img + '/**/*.*').on(
    'add',
    series(buildImages, browserSync.reload)
  );
  cb();
}
// EXPORTS
exports.build = series(
  cleanBuild,
  devJS,
  parallel(buildHTML, buildPHP, buildCSS, buildJS, buildImages),
  buildServer
);
exports.rebuild = series(
  cleanBuild,
  devJS,
  parallel(buildHTML, buildPHP, buildCSS, buildJS, buildImages)
);
exports.dev = series(parallel(devSASS, devJS), devServer, devWatcher);
exports.sass = devSASS;
exports.js = devJS;
exports.img = buildImages;

exports.default =parallel(devSASS, devJS);
