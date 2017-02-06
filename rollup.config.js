import commonJs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import uglify from 'rollup-plugin-uglify';

export default {
        entry:                  'js/gpxmap.js',
        format:                 'amd',
        dest:                   'dist/gpxmap.js',
        sourceMap:              true,
        external: [
                                'leaflet',
                                'require',
        ],
        plugins: [
                                commonJs(),
                                nodeResolve(),
                                uglify(),
        ],
}
