import {rollup} from 'rollup';
import {default as terser} from '@rollup/plugin-terser';
import babel from '@rollup/plugin-babel';
import {default as commonjs} from '@rollup/plugin-commonjs';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import gulp from 'gulp';

const babelConfig = {
    babelHelpers: 'bundled',
    ignore: ['node_modules'],
    compact: false,
    extensions: ['.js'],
    presets: [
        [
            '@babel/preset-env',
            {
                corejs: 3,
                useBuiltIns: 'usage',
                modules: false,
                targets: {
                    browsers: [
                        'last 2 Chrome versions',
                        'last 2 Safari versions',
                        'last 2 iOS versions',
                        'last 2 Firefox versions',
                        'last 2 Edge versions',
                    ]
                }
            }
        ]
    ]
};

gulp.task('plugins', () =>
    Promise.all([
            {name: 'RevealRemote', file: 'remote'},
            {name: 'RevealRemoteZoom', file: 'remotezoom'},
        ].flatMap(plugin =>
            rollup({
                input: `./plugin/${plugin.file}.js`,
                plugins: [
                    nodeResolve(),
                    commonjs(),
                    babel({
                        ...babelConfig,
                        ignore: [/node_modules\/.*/],
                    }),
                    terser()
                ],
                external: ['../../socket.io/socket.io.esm.min.js'],
            }).then(bundle => [
                bundle.write({
                    file: `./dist/static/plugin/${plugin.file}.esm.js`,
                    name: plugin.name,
                    format: 'es',
                }),

                bundle.write({
                    file: `./dist/static/plugin/${plugin.file}.js`,
                    name: plugin.name,
                    format: 'iife',
                    globals: (file) => {
                        if (file.endsWith("/socket.io/socket.io.esm.min.js"))
                            return "io"
                        else
                            return file
                    }
                })]
            )
        )
    ));

gulp.task('server', () =>
    gulp.src('server/**/*')
        .pipe(gulp.dest('dist')));


gulp.task('server-ui', () =>
    gulp.src('server-ui/**/*')
        .pipe(gulp.dest('dist/static/ui')));

gulp.task('demo-cjs', () =>
    gulp.src(['presentations/commonjs/index.html', 'presentations/reveal.js/**/*'])
        .pipe(gulp.dest('dist/presentations/commonjs')));

gulp.task('demo-esm', () =>
    gulp.src(['presentations/esm/index.html', 'presentations/reveal.js/**/*'])
        .pipe(gulp.dest('dist/presentations/esm')));

gulp.task('demo', gulp.parallel('demo-cjs', 'demo-esm'));
gulp.task('app', gulp.parallel('plugins', 'server', 'server-ui'));

gulp.task('default', gulp.parallel('app', 'demo'));

