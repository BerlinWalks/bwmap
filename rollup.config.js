import commonJs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
        entry:                  'js/gpxmap.js',
        format:                 'amd',
        dest:                   'dist/gpxmap.js',
        external: [
                                'leaflet',
                                'require',
        ],
        plugins: [
                                commonJs(),
                                nodeResolve(),
        ],
}
