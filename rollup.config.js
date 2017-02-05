import commonJs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
        entry:                  'js/gpxmap.js',
        format:                 'iife',
        moduleName:             'GPXMAP',
        dest:                   'dist/gpxmap.js',
        plugins: [
                                commonJs(),
                                nodeResolve(),
        ],
}
