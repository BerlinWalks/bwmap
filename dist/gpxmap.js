(function (exports) {
'use strict';

L.SVG.Tile = L.SVG.extend({

        initialize: function (tileCoord, tileSize, options) {
                L.SVG.prototype.initialize.call(this, options);
                this._tileCoord = tileCoord;
                this._size = tileSize;

                this._initContainer();
                this._container.setAttribute('width', this._size.x);
                this._container.setAttribute('height', this._size.y);
                this._container.setAttribute('viewBox', [0, 0, this._size.x, this._size.y].join(' '));

                if (options.interactive) {
                        // By default, Leaflet tiles do not have pointer events
                        this._container.style.pointerEvents = 'auto';
                }
                this._layers = {};
        },

        getCoord: function() {
                return this._tileCoord;
        },

        getContainer: function() {
                return this._container;
        },

        onAdd: L.Util.falseFn,

        addTo: function(map) {
                this._map = map;
                if (this.options.interactive) {
                        for (var i in this._layers) {
                                var layer = this._layers[i];
                                this._map._targets[L.stamp(layer._path)] = layer;
                        }
                }
        },

        _initContainer: function() {
                L.SVG.prototype._initContainer.call(this);
                var rect =  L.SVG.create('rect');
        },

        /// TODO: Modify _initPath to include an extra parameter, a group name
        /// to order symbolizers by z-index

        _addPath: function (layer) {
                this._rootGroup.appendChild(layer._path);
                this._layers[L.stamp(layer)] = layer;
        },

        _updateIcon: function (layer) {
                var path = layer._path = L.SVG.create('image'),
                    icon = layer.options.icon,
                    options = icon.options,
                    size = L.point(options.iconSize),
                    anchor = options.iconAnchor ||
                                 size && size.divideBy(2, true),
                    p = layer._point.subtract(anchor);
                path.setAttribute('x', p.x);
                path.setAttribute('y', p.y);
                path.setAttribute('width', size.x + 'px');
                path.setAttribute('height', size.y + 'px');
                path.setAttribute('href', options.iconUrl);
        }
});


L.svg.tile = function(tileCoord, tileSize, opts){
        return new L.SVG.Tile(tileCoord, tileSize, opts);
};

L.VectorGrid = L.GridLayer.extend({

        options: {
                rendererFactory: L.svg.tile,
                vectorTileLayerStyles: {},
                interactive: false
        },

        initialize: function(options) {
                L.setOptions(this, options);
                L.GridLayer.prototype.initialize.apply(this, arguments);
                if (this.options.getFeatureId) {
                        this._vectorTiles = {};
                        this._overriddenStyles = {};
                        this.on('tileunload', function(e) {
                                delete this._vectorTiles[this._tileCoordsToKey(e.coords)];
                        }, this);
                }
        },

        createTile: function(coords, done) {
                var storeFeatures = this.options.getFeatureId;

                var tileSize = this.getTileSize();
                var renderer = this.options.rendererFactory(coords, tileSize, this.options);

                var vectorTilePromise = this._getVectorTilePromise(coords);

                if (storeFeatures) {
                        this._vectorTiles[this._tileCoordsToKey(coords)] = renderer;
                        renderer._features = {};
                }

                vectorTilePromise.then( function renderTile(vectorTile) {
                        for (var layerName in vectorTile.layers) {
                                var layer = vectorTile.layers[layerName];

                                /// NOTE: THIS ASSUMES SQUARE TILES!!!!!1!
                                var pxPerExtent = this.getTileSize().x / layer.extent;

                                var layerStyle = this.options.vectorTileLayerStyles[ layerName ] ||
                                L.Path.prototype.options;

                                for (var i in layer.features) {
                                        var feat = layer.features[i];
                                        var id;

                                        var styleOptions = layerStyle;
                                        if (storeFeatures) {
                                                id = this.options.getFeatureId(feat);
                                                var styleOverride = this._overriddenStyles[id];
                                                if (styleOverride) {
                                                        if (styleOverride[layerName]) {
                                                                styleOptions = styleOverride[layerName];
                                                        } else {
                                                                styleOptions = styleOverride;
                                                        }
                                                }
                                        }

                                        if (styleOptions instanceof Function) {
                                                styleOptions = styleOptions(feat.properties, coords.z);
                                        }

                                        if (!(styleOptions instanceof Array)) {
                                                styleOptions = [styleOptions];
                                        }

                                        if (!styleOptions.length) {
                                                continue;
                                        }

                                        var featureLayer = this._createLayer(feat, pxPerExtent);

                                        for (var j in styleOptions) {
                                                var style = L.extend({}, L.Path.prototype.options, styleOptions[j]);
                                                featureLayer.render(renderer, style);
                                                renderer._addPath(featureLayer);
                                        }

                                        if (this.options.interactive) {
                                                featureLayer.makeInteractive();
                                        }

                                        if (storeFeatures) {
                                                renderer._features[id] = {
                                                        layerName: layerName,
                                                        feature: featureLayer
                                                };
                                        }
                                }

                        }
                        if (this._map != null) {
                                renderer.addTo(this._map);
                        }
                        L.Util.requestAnimFrame(done.bind(coords, null, null));
                }.bind(this));

                return renderer.getContainer();
        },

        setFeatureStyle: function(id, layerStyle) {
                this._overriddenStyles[id] = {};

                for (var tileKey in this._vectorTiles) {
                        var tile = this._vectorTiles[tileKey];
                        var features = tile._features;
                        var data = features[id];
                        if (data) {
                                this._overriddenStyles[id] = layerStyle;
                                var feat = data.feature;

                                var styleOptions = layerStyle;
                                if (layerStyle[data.layerName]) {
                                        styleOptions = layerStyle[data.layerName];
                                }

                                styleOptions = (styleOptions instanceof Function) ?
                                        styleOptions(feat.properties, tile.getCoord().z) :
                                        styleOptions;

                                this._updateStyles(feat, tile, styleOptions);
                        } else {
                                this._overriddenStyles[id] = layerStyle;
                        }
                }
        },

        resetFeatureStyle: function(id) {
                delete this._overriddenStyles[id];

                for (var tileKey in this._vectorTiles) {
                        var tile = this._vectorTiles[tileKey];
                        var features = tile._features;
                        var data = features[id];
                        if (data) {
                                var feat = data.feature;
                                var layerStyle = this.options.vectorTileLayerStyles[ data.layerName ] ||
                                L.Path.prototype.options;
                                var styleOptions = (layerStyle instanceof Function) ?
                                layerStyle(feat.properties, tile.getCoord().z) :
                                layerStyle;
                                this._updateStyles(feat, tile, styleOptions);
                        }
                }
        },

        _updateStyles: function(feat, renderer, styleOptions) {
                if (!(styleOptions instanceof Array)) {
                        styleOptions = [styleOptions];
                }

                for (var j in styleOptions) {
                        var style = L.extend({}, L.Path.prototype.options, styleOptions[j]);
                        feat.updateStyle(renderer, style);
                }
        },

        _createLayer: function(feat, pxPerExtent, layerStyle) {
                var layer;
                switch (feat.type) {
                case 1:
                        layer = new PointLayer(feat, pxPerExtent);
                        break;
                case 2:
                        layer = new PolylineLayer(feat, pxPerExtent);
                        break;
                case 3:
                        layer = new PolygonLayer(feat, pxPerExtent);
                        break;
                }

                if (this.options.interactive) {
                        layer.addEventParent(this);
                }

                return layer;
        },
});

L.vectorGrid = function (options) {
        return new L.VectorGrid(options);
};

var FeatureLayer = L.Class.extend({
        render: function(renderer, style) {
                this._renderer = renderer;
                this.options = style;
                renderer._initPath(this);
                renderer._updateStyle(this);
        },

        updateStyle: function(renderer, style) {
                this.options = style;
                renderer._updateStyle(this);
        },

        _getPixelBounds: function() {
                var parts = this._parts;
                var bounds = L.bounds([]);
                for (var i = 0; i < parts.length; i++) {
                        var part = parts[i];
                        for (var j = 0; j < part.length; j++) {
                                bounds.extend(part[j]);
                        }
                }

                var w = this._clickTolerance(),
                    p = new L.Point(w, w);

                bounds.min._subtract(p);
                bounds.max._add(p);

                return bounds;
        },
        _clickTolerance: L.Path.prototype._clickTolerance,
});

var PointLayer = L.CircleMarker.extend({
        includes: FeatureLayer.prototype,

        statics: {
                iconCache: {}
        },

        initialize: function(feature, pxPerExtent) {
                this.properties = feature.properties;
                this._makeFeatureParts(feature, pxPerExtent);
        },

        render: function(renderer, style) {
                FeatureLayer.prototype.render.call(this, renderer, style);
                this._radius = style.radius || L.CircleMarker.prototype.options.radius;
                this._updatePath();
        },

        _makeFeatureParts: function(feat, pxPerExtent) {
                var coord = feat.geometry[0];
                if (typeof coord[0] === 'object' && 'x' in coord[0]) {
                        // Protobuf vector tiles return [{x: , y:}]
                        this._point = L.point(coord[0].x * pxPerExtent, coord[0].y * pxPerExtent);
                        this._empty = L.Util.falseFn;
                } else {
                        // Geojson-vt returns [,]
                        this._point = L.point(coord[0] * pxPerExtent, coord[1] * pxPerExtent);
                        this._empty = L.Util.falseFn;
                }
        },

        makeInteractive: function() {
                this._updateBounds();
        },

        updateStyle: function(renderer, style) {
                this._radius = style.radius || this._radius;
                this._updateBounds();
                return FeatureLayer.prototype.updateStyle.call(this, renderer, style);
        },

        _updateBounds: function() {
                var icon = this.options.icon;
                if (icon) {
                        var size = L.point(icon.options.iconSize),
                            anchor = icon.options.iconAnchor ||
                                     size && size.divideBy(2, true),
                            p = this._point.subtract(anchor);
                        this._pxBounds = new L.Bounds(p, p.add(icon.options.iconSize));
                } else {
                        L.CircleMarker.prototype._updateBounds.call(this);
                }
        },

        _updatePath: function() {
                if (this.options.icon) {
                        this._renderer._updateIcon(this);
                } else {
                        L.CircleMarker.prototype._updatePath.call(this);
                }
        },

        _getImage: function () {
                if (this.options.icon) {
                        var url = this.options.icon.options.iconUrl,
                            img = PointLayer.iconCache[url];
                        if (!img) {
                                var icon = this.options.icon;
                                img = PointLayer.iconCache[url] = icon.createIcon();
                        }
                        return img;
                } else {
                        return null;
                }

        },

        _containsPoint: function(p) {
                var icon = this.options.icon;
                if (icon) {
                        return this._pxBounds.contains(p);
                } else {
                        return L.CircleMarker.prototype._containsPoint.call(this, p);
                }
        }
});

var polyBase = {
        _makeFeatureParts: function(feat, pxPerExtent) {
                var rings = feat.geometry;
                var coord;

                this._parts = [];
                for (var i in rings) {
                        var ring = rings[i];
                        var part = [];
                        for (var j in ring) {
                                coord = ring[j];
                                if ('x' in coord) {
                                        // Protobuf vector tiles return {x: , y:}
                                        part.push(L.point(coord.x * pxPerExtent, coord.y * pxPerExtent));
                                } else {
                                        // Geojson-vt returns [,]
                                        part.push(L.point(coord[0] * pxPerExtent, coord[1] * pxPerExtent));
                                }
                        }
                        this._parts.push(part);
                }
        },

        makeInteractive: function() {
                this._pxBounds = this._getPixelBounds();
        }
};

var PolylineLayer = L.Polyline.extend({
        includes: [FeatureLayer.prototype, polyBase],

        initialize: function(feature, pxPerExtent) {
                this.properties = feature.properties;
                this._makeFeatureParts(feature, pxPerExtent);
        },

        render: function(renderer, style) {
                style.fill = false;
                FeatureLayer.prototype.render.call(this, renderer, style);
                this._updatePath();
        },

        updateStyle: function(renderer, style) {
                style.fill = false;
                FeatureLayer.prototype.updateStyle.call(this, renderer, style);
        },
});

var PolygonLayer = L.Polygon.extend({
        includes: [FeatureLayer.prototype, polyBase],

        initialize: function(feature, pxPerExtent) {
                this.properties = feature.properties;
                this._makeFeatureParts(feature, pxPerExtent);
        },

        render: function(renderer, style) {
                FeatureLayer.prototype.render.call(this, renderer, style);
                this._updatePath();
        }
});

var read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
};

var write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
};

var index$1 = {
        read: read,
        write: write
};

var index = Pbf;

var ieee754 = index$1;

function Pbf(buf) {
    this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
    this.pos = 0;
    this.type = 0;
    this.length = this.buf.length;
}

Pbf.Varint  = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
Pbf.Fixed64 = 1; // 64-bit: double, fixed64, sfixed64
Pbf.Bytes   = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
Pbf.Fixed32 = 5; // 32-bit: float, fixed32, sfixed32

var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

Pbf.prototype = {

    destroy: function() {
        this.buf = null;
    },

    // === READING =================================================================

    readFields: function(readField, result, end) {
        end = end || this.length;

        while (this.pos < end) {
            var val = this.readVarint(),
                tag = val >> 3,
                startPos = this.pos;

            this.type = val & 0x7;
            readField(tag, result, this);

            if (this.pos === startPos) this.skip(val);
        }
        return result;
    },

    readMessage: function(readField, result) {
        return this.readFields(readField, result, this.readVarint() + this.pos);
    },

    readFixed32: function() {
        var val = readUInt32(this.buf, this.pos);
        this.pos += 4;
        return val;
    },

    readSFixed32: function() {
        var val = readInt32(this.buf, this.pos);
        this.pos += 4;
        return val;
    },

    // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

    readFixed64: function() {
        var val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
        this.pos += 8;
        return val;
    },

    readSFixed64: function() {
        var val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
        this.pos += 8;
        return val;
    },

    readFloat: function() {
        var val = ieee754.read(this.buf, this.pos, true, 23, 4);
        this.pos += 4;
        return val;
    },

    readDouble: function() {
        var val = ieee754.read(this.buf, this.pos, true, 52, 8);
        this.pos += 8;
        return val;
    },

    readVarint: function(isSigned) {
        var buf = this.buf,
            val, b;

        b = buf[this.pos++]; val  =  b & 0x7f;        if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 7;  if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 14; if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 21; if (b < 0x80) return val;
        b = buf[this.pos];   val |= (b & 0x0f) << 28;

        return readVarintRemainder(val, isSigned, this);
    },

    readVarint64: function() { // for compatibility with v2.0.1
        return this.readVarint(true);
    },

    readSVarint: function() {
        var num = this.readVarint();
        return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
    },

    readBoolean: function() {
        return Boolean(this.readVarint());
    },

    readString: function() {
        var end = this.readVarint() + this.pos,
            str = readUtf8(this.buf, this.pos, end);
        this.pos = end;
        return str;
    },

    readBytes: function() {
        var end = this.readVarint() + this.pos,
            buffer = this.buf.subarray(this.pos, end);
        this.pos = end;
        return buffer;
    },

    // verbose for performance reasons; doesn't affect gzipped size

    readPackedVarint: function(arr, isSigned) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readVarint(isSigned));
        return arr;
    },
    readPackedSVarint: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readSVarint());
        return arr;
    },
    readPackedBoolean: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readBoolean());
        return arr;
    },
    readPackedFloat: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readFloat());
        return arr;
    },
    readPackedDouble: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readDouble());
        return arr;
    },
    readPackedFixed32: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readFixed32());
        return arr;
    },
    readPackedSFixed32: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readSFixed32());
        return arr;
    },
    readPackedFixed64: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readFixed64());
        return arr;
    },
    readPackedSFixed64: function(arr) {
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readSFixed64());
        return arr;
    },

    skip: function(val) {
        var type = val & 0x7;
        if (type === Pbf.Varint) while (this.buf[this.pos++] > 0x7f) {}
        else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
        else if (type === Pbf.Fixed32) this.pos += 4;
        else if (type === Pbf.Fixed64) this.pos += 8;
        else throw new Error('Unimplemented type: ' + type);
    },

    // === WRITING =================================================================

    writeTag: function(tag, type) {
        this.writeVarint((tag << 3) | type);
    },

    realloc: function(min) {
        var length = this.length || 16;

        while (length < this.pos + min) length *= 2;

        if (length !== this.length) {
            var buf = new Uint8Array(length);
            buf.set(this.buf);
            this.buf = buf;
            this.length = length;
        }
    },

    finish: function() {
        this.length = this.pos;
        this.pos = 0;
        return this.buf.subarray(0, this.length);
    },

    writeFixed32: function(val) {
        this.realloc(4);
        writeInt32(this.buf, val, this.pos);
        this.pos += 4;
    },

    writeSFixed32: function(val) {
        this.realloc(4);
        writeInt32(this.buf, val, this.pos);
        this.pos += 4;
    },

    writeFixed64: function(val) {
        this.realloc(8);
        writeInt32(this.buf, val & -1, this.pos);
        writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
        this.pos += 8;
    },

    writeSFixed64: function(val) {
        this.realloc(8);
        writeInt32(this.buf, val & -1, this.pos);
        writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
        this.pos += 8;
    },

    writeVarint: function(val) {
        val = +val || 0;

        if (val > 0xfffffff || val < 0) {
            writeBigVarint(val, this);
            return;
        }

        this.realloc(4);

        this.buf[this.pos++] =           val & 0x7f  | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] =   (val >>> 7) & 0x7f;
    },

    writeSVarint: function(val) {
        this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
    },

    writeBoolean: function(val) {
        this.writeVarint(Boolean(val));
    },

    writeString: function(str) {
        str = String(str);
        this.realloc(str.length * 4);

        this.pos++; // reserve 1 byte for short string length

        var startPos = this.pos;
        // write the string directly to the buffer and see how much was written
        this.pos = writeUtf8(this.buf, str, this.pos);
        var len = this.pos - startPos;

        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

        // finally, write the message length in the reserved place and restore the position
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
    },

    writeFloat: function(val) {
        this.realloc(4);
        ieee754.write(this.buf, val, this.pos, true, 23, 4);
        this.pos += 4;
    },

    writeDouble: function(val) {
        this.realloc(8);
        ieee754.write(this.buf, val, this.pos, true, 52, 8);
        this.pos += 8;
    },

    writeBytes: function(buffer) {
        var len = buffer.length;
        this.writeVarint(len);
        this.realloc(len);
        for (var i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
    },

    writeRawMessage: function(fn, obj) {
        this.pos++; // reserve 1 byte for short message length

        // write the message directly to the buffer and see how much was written
        var startPos = this.pos;
        fn(obj, this);
        var len = this.pos - startPos;

        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

        // finally, write the message length in the reserved place and restore the position
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
    },

    writeMessage: function(tag, fn, obj) {
        this.writeTag(tag, Pbf.Bytes);
        this.writeRawMessage(fn, obj);
    },

    writePackedVarint:   function(tag, arr) { this.writeMessage(tag, writePackedVarint, arr);   },
    writePackedSVarint:  function(tag, arr) { this.writeMessage(tag, writePackedSVarint, arr);  },
    writePackedBoolean:  function(tag, arr) { this.writeMessage(tag, writePackedBoolean, arr);  },
    writePackedFloat:    function(tag, arr) { this.writeMessage(tag, writePackedFloat, arr);    },
    writePackedDouble:   function(tag, arr) { this.writeMessage(tag, writePackedDouble, arr);   },
    writePackedFixed32:  function(tag, arr) { this.writeMessage(tag, writePackedFixed32, arr);  },
    writePackedSFixed32: function(tag, arr) { this.writeMessage(tag, writePackedSFixed32, arr); },
    writePackedFixed64:  function(tag, arr) { this.writeMessage(tag, writePackedFixed64, arr);  },
    writePackedSFixed64: function(tag, arr) { this.writeMessage(tag, writePackedSFixed64, arr); },

    writeBytesField: function(tag, buffer) {
        this.writeTag(tag, Pbf.Bytes);
        this.writeBytes(buffer);
    },
    writeFixed32Field: function(tag, val) {
        this.writeTag(tag, Pbf.Fixed32);
        this.writeFixed32(val);
    },
    writeSFixed32Field: function(tag, val) {
        this.writeTag(tag, Pbf.Fixed32);
        this.writeSFixed32(val);
    },
    writeFixed64Field: function(tag, val) {
        this.writeTag(tag, Pbf.Fixed64);
        this.writeFixed64(val);
    },
    writeSFixed64Field: function(tag, val) {
        this.writeTag(tag, Pbf.Fixed64);
        this.writeSFixed64(val);
    },
    writeVarintField: function(tag, val) {
        this.writeTag(tag, Pbf.Varint);
        this.writeVarint(val);
    },
    writeSVarintField: function(tag, val) {
        this.writeTag(tag, Pbf.Varint);
        this.writeSVarint(val);
    },
    writeStringField: function(tag, str) {
        this.writeTag(tag, Pbf.Bytes);
        this.writeString(str);
    },
    writeFloatField: function(tag, val) {
        this.writeTag(tag, Pbf.Fixed32);
        this.writeFloat(val);
    },
    writeDoubleField: function(tag, val) {
        this.writeTag(tag, Pbf.Fixed64);
        this.writeDouble(val);
    },
    writeBooleanField: function(tag, val) {
        this.writeVarintField(tag, Boolean(val));
    }
};

function readVarintRemainder(l, s, p) {
    var buf = p.buf,
        h, b;

    b = buf[p.pos++]; h  = (b & 0x70) >> 4;  if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 3;  if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 10; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 17; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 24; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x01) << 31; if (b < 0x80) return toNum(l, h, s);

    throw new Error('Expected varint not more than 10 bytes');
}

function readPackedEnd(pbf) {
    return pbf.type === Pbf.Bytes ?
        pbf.readVarint() + pbf.pos : pbf.pos + 1;
}

function toNum(low, high, isSigned) {
    if (isSigned) {
        return high * 0x100000000 + (low >>> 0);
    }

    return ((high >>> 0) * 0x100000000) + (low >>> 0);
}

function writeBigVarint(val, pbf) {
    var low, high;

    if (val >= 0) {
        low  = (val % 0x100000000) | 0;
        high = (val / 0x100000000) | 0;
    } else {
        low  = ~(-val % 0x100000000);
        high = ~(-val / 0x100000000);

        if (low ^ 0xffffffff) {
            low = (low + 1) | 0;
        } else {
            low = 0;
            high = (high + 1) | 0;
        }
    }

    if (val >= 0x10000000000000000 || val < -0x10000000000000000) {
        throw new Error('Given varint doesn\'t fit into 10 bytes');
    }

    pbf.realloc(10);

    writeBigVarintLow(low, high, pbf);
    writeBigVarintHigh(high, pbf);
}

function writeBigVarintLow(low, high, pbf) {
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos]   = low & 0x7f;
}

function writeBigVarintHigh(high, pbf) {
    var lsb = (high & 0x07) << 4;

    pbf.buf[pbf.pos++] |= lsb         | ((high >>>= 3) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f;
}

function makeRoomForExtraLength(startPos, len, pbf) {
    var extraLen =
        len <= 0x3fff ? 1 :
        len <= 0x1fffff ? 2 :
        len <= 0xfffffff ? 3 : Math.ceil(Math.log(len) / (Math.LN2 * 7));

    // if 1 byte isn't enough for encoding message length, shift the data to the right
    pbf.realloc(extraLen);
    for (var i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
}

function writePackedVarint(arr, pbf)   { for (var i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);   }
function writePackedSVarint(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);  }
function writePackedFloat(arr, pbf)    { for (var i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);    }
function writePackedDouble(arr, pbf)   { for (var i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);   }
function writePackedBoolean(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);  }
function writePackedFixed32(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);  }
function writePackedSFixed32(arr, pbf) { for (var i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]); }
function writePackedFixed64(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);  }
function writePackedSFixed64(arr, pbf) { for (var i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]); }

// Buffer code below from https://github.com/feross/buffer, MIT-licensed

function readUInt32(buf, pos) {
    return ((buf[pos]) |
        (buf[pos + 1] << 8) |
        (buf[pos + 2] << 16)) +
        (buf[pos + 3] * 0x1000000);
}

function writeInt32(buf, val, pos) {
    buf[pos] = val;
    buf[pos + 1] = (val >>> 8);
    buf[pos + 2] = (val >>> 16);
    buf[pos + 3] = (val >>> 24);
}

function readInt32(buf, pos) {
    return ((buf[pos]) |
        (buf[pos + 1] << 8) |
        (buf[pos + 2] << 16)) +
        (buf[pos + 3] << 24);
}

function readUtf8(buf, pos, end) {
    var str = '';
    var i = pos;

    while (i < end) {
        var b0 = buf[i];
        var c = null; // codepoint
        var bytesPerSequence =
            b0 > 0xEF ? 4 :
            b0 > 0xDF ? 3 :
            b0 > 0xBF ? 2 : 1;

        if (i + bytesPerSequence > end) break;

        var b1, b2, b3;

        if (bytesPerSequence === 1) {
            if (b0 < 0x80) {
                c = b0;
            }
        } else if (bytesPerSequence === 2) {
            b1 = buf[i + 1];
            if ((b1 & 0xC0) === 0x80) {
                c = (b0 & 0x1F) << 0x6 | (b1 & 0x3F);
                if (c <= 0x7F) {
                    c = null;
                }
            }
        } else if (bytesPerSequence === 3) {
            b1 = buf[i + 1];
            b2 = buf[i + 2];
            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80) {
                c = (b0 & 0xF) << 0xC | (b1 & 0x3F) << 0x6 | (b2 & 0x3F);
                if (c <= 0x7FF || (c >= 0xD800 && c <= 0xDFFF)) {
                    c = null;
                }
            }
        } else if (bytesPerSequence === 4) {
            b1 = buf[i + 1];
            b2 = buf[i + 2];
            b3 = buf[i + 3];
            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
                c = (b0 & 0xF) << 0x12 | (b1 & 0x3F) << 0xC | (b2 & 0x3F) << 0x6 | (b3 & 0x3F);
                if (c <= 0xFFFF || c >= 0x110000) {
                    c = null;
                }
            }
        }

        if (c === null) {
            c = 0xFFFD;
            bytesPerSequence = 1;

        } else if (c > 0xFFFF) {
            c -= 0x10000;
            str += String.fromCharCode(c >>> 10 & 0x3FF | 0xD800);
            c = 0xDC00 | c & 0x3FF;
        }

        str += String.fromCharCode(c);
        i += bytesPerSequence;
    }

    return str;
}

function writeUtf8(buf, str, pos) {
    for (var i = 0, c, lead; i < str.length; i++) {
        c = str.charCodeAt(i); // code point

        if (c > 0xD7FF && c < 0xE000) {
            if (lead) {
                if (c < 0xDC00) {
                    buf[pos++] = 0xEF;
                    buf[pos++] = 0xBF;
                    buf[pos++] = 0xBD;
                    lead = c;
                    continue;
                } else {
                    c = lead - 0xD800 << 10 | c - 0xDC00 | 0x10000;
                    lead = null;
                }
            } else {
                if (c > 0xDBFF || (i + 1 === str.length)) {
                    buf[pos++] = 0xEF;
                    buf[pos++] = 0xBF;
                    buf[pos++] = 0xBD;
                } else {
                    lead = c;
                }
                continue;
            }
        } else if (lead) {
            buf[pos++] = 0xEF;
            buf[pos++] = 0xBF;
            buf[pos++] = 0xBD;
            lead = null;
        }

        if (c < 0x80) {
            buf[pos++] = c;
        } else {
            if (c < 0x800) {
                buf[pos++] = c >> 0x6 | 0xC0;
            } else {
                if (c < 0x10000) {
                    buf[pos++] = c >> 0xC | 0xE0;
                } else {
                    buf[pos++] = c >> 0x12 | 0xF0;
                    buf[pos++] = c >> 0xC & 0x3F | 0x80;
                }
                buf[pos++] = c >> 0x6 & 0x3F | 0x80;
            }
            buf[pos++] = c & 0x3F | 0x80;
        }
    }
    return pos;
}

var index$5 = Point$1;

function Point$1(x, y) {
    this.x = x;
    this.y = y;
}

Point$1.prototype = {
    clone: function() { return new Point$1(this.x, this.y); },

    add:     function(p) { return this.clone()._add(p);     },
    sub:     function(p) { return this.clone()._sub(p);     },
    mult:    function(k) { return this.clone()._mult(k);    },
    div:     function(k) { return this.clone()._div(k);     },
    rotate:  function(a) { return this.clone()._rotate(a);  },
    matMult: function(m) { return this.clone()._matMult(m); },
    unit:    function() { return this.clone()._unit(); },
    perp:    function() { return this.clone()._perp(); },
    round:   function() { return this.clone()._round(); },

    mag: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },

    equals: function(p) {
        return this.x === p.x &&
               this.y === p.y;
    },

    dist: function(p) {
        return Math.sqrt(this.distSqr(p));
    },

    distSqr: function(p) {
        var dx = p.x - this.x,
            dy = p.y - this.y;
        return dx * dx + dy * dy;
    },

    angle: function() {
        return Math.atan2(this.y, this.x);
    },

    angleTo: function(b) {
        return Math.atan2(this.y - b.y, this.x - b.x);
    },

    angleWith: function(b) {
        return this.angleWithSep(b.x, b.y);
    },

    // Find the angle of the two vectors, solving the formula for the cross product a x b = |a||b|sin(θ) for θ.
    angleWithSep: function(x, y) {
        return Math.atan2(
            this.x * y - this.y * x,
            this.x * x + this.y * y);
    },

    _matMult: function(m) {
        var x = m[0] * this.x + m[1] * this.y,
            y = m[2] * this.x + m[3] * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _add: function(p) {
        this.x += p.x;
        this.y += p.y;
        return this;
    },

    _sub: function(p) {
        this.x -= p.x;
        this.y -= p.y;
        return this;
    },

    _mult: function(k) {
        this.x *= k;
        this.y *= k;
        return this;
    },

    _div: function(k) {
        this.x /= k;
        this.y /= k;
        return this;
    },

    _unit: function() {
        this._div(this.mag());
        return this;
    },

    _perp: function() {
        var y = this.y;
        this.y = this.x;
        this.x = -y;
        return this;
    },

    _rotate: function(angle) {
        var cos = Math.cos(angle),
            sin = Math.sin(angle),
            x = cos * this.x - sin * this.y,
            y = sin * this.x + cos * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _round: function() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }
};

// constructs Point from an array if necessary
Point$1.convert = function (a) {
    if (a instanceof Point$1) {
        return a;
    }
    if (Array.isArray(a)) {
        return new Point$1(a[0], a[1]);
    }
    return a;
};

var Point = index$5;

var vectortilefeature = VectorTileFeature$2;

function VectorTileFeature$2(pbf, end, extent, keys, values) {
    // Public
    this.properties = {};
    this.extent = extent;
    this.type = 0;

    // Private
    this._pbf = pbf;
    this._geometry = -1;
    this._keys = keys;
    this._values = values;

    pbf.readFields(readFeature, this, end);
}

function readFeature(tag, feature, pbf) {
    if (tag == 1) feature.id = pbf.readVarint();
    else if (tag == 2) readTag(pbf, feature);
    else if (tag == 3) feature.type = pbf.readVarint();
    else if (tag == 4) feature._geometry = pbf.pos;
}

function readTag(pbf, feature) {
    var end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
        var key = feature._keys[pbf.readVarint()],
            value = feature._values[pbf.readVarint()];
        feature.properties[key] = value;
    }
}

VectorTileFeature$2.types = ['Unknown', 'Point', 'LineString', 'Polygon'];

VectorTileFeature$2.prototype.loadGeometry = function() {
    var pbf = this._pbf;
    pbf.pos = this._geometry;

    var end = pbf.readVarint() + pbf.pos,
        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        lines = [],
        line;

    while (pbf.pos < end) {
        if (!length) {
            var cmdLen = pbf.readVarint();
            cmd = cmdLen & 0x7;
            length = cmdLen >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += pbf.readSVarint();
            y += pbf.readSVarint();

            if (cmd === 1) { // moveTo
                if (line) lines.push(line);
                line = [];
            }

            line.push(new Point(x, y));

        } else if (cmd === 7) {

            // Workaround for https://github.com/mapbox/mapnik-vector-tile/issues/90
            if (line) {
                line.push(line[0].clone()); // closePolygon
            }

        } else {
            throw new Error('unknown command ' + cmd);
        }
    }

    if (line) lines.push(line);

    return lines;
};

VectorTileFeature$2.prototype.bbox = function() {
    var pbf = this._pbf;
    pbf.pos = this._geometry;

    var end = pbf.readVarint() + pbf.pos,
        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    while (pbf.pos < end) {
        if (!length) {
            var cmdLen = pbf.readVarint();
            cmd = cmdLen & 0x7;
            length = cmdLen >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += pbf.readSVarint();
            y += pbf.readSVarint();
            if (x < x1) x1 = x;
            if (x > x2) x2 = x;
            if (y < y1) y1 = y;
            if (y > y2) y2 = y;

        } else if (cmd !== 7) {
            throw new Error('unknown command ' + cmd);
        }
    }

    return [x1, y1, x2, y2];
};

VectorTileFeature$2.prototype.toGeoJSON = function(x, y, z) {
    var size = this.extent * Math.pow(2, z),
        x0 = this.extent * x,
        y0 = this.extent * y,
        coords = this.loadGeometry(),
        type = VectorTileFeature$2.types[this.type],
        i, j;

    function project(line) {
        for (var j = 0; j < line.length; j++) {
            var p = line[j], y2 = 180 - (p.y + y0) * 360 / size;
            line[j] = [
                (p.x + x0) * 360 / size - 180,
                360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90
            ];
        }
    }

    switch (this.type) {
    case 1:
        var points = [];
        for (i = 0; i < coords.length; i++) {
            points[i] = coords[i][0];
        }
        coords = points;
        project(coords);
        break;

    case 2:
        for (i = 0; i < coords.length; i++) {
            project(coords[i]);
        }
        break;

    case 3:
        coords = classifyRings(coords);
        for (i = 0; i < coords.length; i++) {
            for (j = 0; j < coords[i].length; j++) {
                project(coords[i][j]);
            }
        }
        break;
    }

    if (coords.length === 1) {
        coords = coords[0];
    } else {
        type = 'Multi' + type;
    }

    var result = {
        type: "Feature",
        geometry: {
            type: type,
            coordinates: coords
        },
        properties: this.properties
    };

    if ('id' in this) {
        result.id = this.id;
    }

    return result;
};

// classifies an array of rings into polygons with outer rings and holes

function classifyRings(rings) {
    var len = rings.length;

    if (len <= 1) return [rings];

    var polygons = [],
        polygon,
        ccw;

    for (var i = 0; i < len; i++) {
        var area = signedArea(rings[i]);
        if (area === 0) continue;

        if (ccw === undefined) ccw = area < 0;

        if (ccw === area < 0) {
            if (polygon) polygons.push(polygon);
            polygon = [rings[i]];

        } else {
            polygon.push(rings[i]);
        }
    }
    if (polygon) polygons.push(polygon);

    return polygons;
}

function signedArea(ring) {
    var sum = 0;
    for (var i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

var VectorTileFeature$1 = vectortilefeature;

var vectortilelayer = VectorTileLayer$2;

function VectorTileLayer$2(pbf, end) {
    // Public
    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    // Private
    this._pbf = pbf;
    this._keys = [];
    this._values = [];
    this._features = [];

    pbf.readFields(readLayer, this, end);

    this.length = this._features.length;
}

function readLayer(tag, layer, pbf) {
    if (tag === 15) layer.version = pbf.readVarint();
    else if (tag === 1) layer.name = pbf.readString();
    else if (tag === 5) layer.extent = pbf.readVarint();
    else if (tag === 2) layer._features.push(pbf.pos);
    else if (tag === 3) layer._keys.push(pbf.readString());
    else if (tag === 4) layer._values.push(readValueMessage(pbf));
}

function readValueMessage(pbf) {
    var value = null,
        end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
        var tag = pbf.readVarint() >> 3;

        value = tag === 1 ? pbf.readString() :
            tag === 2 ? pbf.readFloat() :
            tag === 3 ? pbf.readDouble() :
            tag === 4 ? pbf.readVarint64() :
            tag === 5 ? pbf.readVarint() :
            tag === 6 ? pbf.readSVarint() :
            tag === 7 ? pbf.readBoolean() : null;
    }

    return value;
}

// return feature `i` from this layer as a `VectorTileFeature`
VectorTileLayer$2.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

    this._pbf.pos = this._features[i];

    var end = this._pbf.readVarint() + this._pbf.pos;
    return new VectorTileFeature$1(this._pbf, end, this.extent, this._keys, this._values);
};

var VectorTileLayer$1 = vectortilelayer;

var vectortile = VectorTile$1;

function VectorTile$1(pbf, end) {
    this.layers = pbf.readFields(readTile, {}, end);
}

function readTile(tag, layers, pbf) {
    if (tag === 3) {
        var layer = new VectorTileLayer$1(pbf, pbf.readVarint() + pbf.pos);
        if (layer.length) layers[layer.name] = layer;
    }
}

var VectorTile = vectortile;

// Network & Protobuf powered!
// NOTE: Assumes the globals `VectorTile` and `Pbf` exist!!!
L.VectorGrid.Protobuf = L.VectorGrid.extend({

        options: {
                minZoom: 0,             // Like L.TileLayer
                maxZoom: 18,            // Like L.TileLayer
                maxNativeZoom: null,    // Like L.TileLayer
                minNativeZoom: null,    // Like L.TileLayer
                subdomains: 'abc',      // Like L.TileLayer
                zoomOffset: 0,          // Like L.TileLayer
                zoomReverse: false,     // Like L.TileLayer
        },


        initialize: function(url, options) {
                // Inherits options from geojson-vt!
//              this._slicer = geojsonvt(geojson, options);
                this._url = url;
                L.VectorGrid.prototype.initialize.call(this, options);
        },


        _getSubdomain: L.TileLayer.prototype._getSubdomain,

        getTileSize: L.TileLayer.prototype.getTileSize,

        _getZoomForUrl: L.TileLayer.prototype._getZoomForUrl,

        _getVectorTilePromise: function(coords) {
                var data = {
                        s: this._getSubdomain(coords),
                        x: coords.x,
                        y: coords.y,
                        z: this._getZoomForUrl(),
                };
                if (this._map && !this._map.options.crs.infinite) {
                        var invertedY = this._globalTileRange.max.y - coords.y;
                        if (this.options.tms) { // Should this option be available in Leaflet.VectorGrid?
                                data['y'] = invertedY;
                        }
                        data['-y'] = invertedY;
                }

                var tileUrl = L.Util.template(this._url, L.extend(data, this.options));

                return fetch(tileUrl).then(function(response){

                        if (!response.ok) {
                                return {layers:[]};
                        }

                        return response.blob().then( function (blob) {
//                              console.log(blob);

                                var reader = new FileReader();
                                return new Promise(function(resolve){
                                        reader.addEventListener("loadend", function() {
                                                // reader.result contains the contents of blob as a typed array

                                                // blob.type === 'application/x-protobuf'
                                                var pbf = new index( reader.result );
//                                              console.log(pbf);
                                                return resolve(new VectorTile( pbf ));

                                        });
                                        reader.readAsArrayBuffer(blob);
                                });
                        });
                }).then(function(json){

//                      console.log('Vector tile:', json.layers);
//                      console.log('Vector tile water:', json.layers.water);   // Instance of VectorTileLayer

                        // Normalize feature getters into actual instanced features
                        for (var layerName in json.layers) {
                                var feats = [];

                                for (var i=0; i<json.layers[layerName].length; i++) {
                                        var feat = json.layers[layerName].feature(i);
                                        feat.geometry = feat.loadGeometry();
                                        feats.push(feat);
                                }

                                json.layers[layerName].features = feats;
                        }

                        return json;
                });
        }
});


L.vectorGrid.protobuf = function (url, options) {
        return new L.VectorGrid.Protobuf(url, options);
};

L.Canvas.Tile = L.Canvas.extend({

        initialize: function (tileCoord, tileSize, options) {
                L.Canvas.prototype.initialize.call(this, options);
                this._tileCoord = tileCoord;
                this._size = tileSize;

                this._initContainer();
                this._container.setAttribute('width', this._size.x);
                this._container.setAttribute('height', this._size.y);
                this._layers = {};
                this._drawnLayers = {};
                this._drawing = true;

                if (options.interactive) {
                        // By default, Leaflet tiles do not have pointer events
                        this._container.style.pointerEvents = 'auto';
                }
        },

        getCoord: function() {
                return this._tileCoord;
        },

        getContainer: function() {
                return this._container;
        },

        getOffset: function() {
                return this._tileCoord.scaleBy(this._size).subtract(this._map.getPixelOrigin());
        },

        onAdd: L.Util.falseFn,

        addTo: function(map) {
                this._map = map;
        },

        _onClick: function (e) {
                var point = this._map.mouseEventToLayerPoint(e).subtract(this.getOffset()), layers = [], layer;

                for (var id in this._layers) {
                        layer = this._layers[id];
                        if (layer.options.interactive && layer._containsPoint(point) && !this._map._draggableMoved(layer)) {
                                L.DomEvent._fakeStop(e);
                                layers.push(layer);
                        }
                }
                if (layers.length)  {
                        this._fireEvent(layers, e);
                }
        },

        _onMouseMove: function (e) {
                if (!this._map || this._map.dragging.moving() || this._map._animatingZoom) { return; }

                var point = this._map.mouseEventToLayerPoint(e).subtract(this.getOffset());
                this._handleMouseOut(e, point);
                this._handleMouseHover(e, point);
        },

        /// TODO: Modify _initPath to include an extra parameter, a group name
        /// to order symbolizers by z-index

        _updateIcon: function (layer) {
                if (!this._drawing) { return; }

                var icon = layer.options.icon,
                    options = icon.options,
                    size = L.point(options.iconSize),
                    anchor = options.iconAnchor ||
                                 size && size.divideBy(2, true),
                    p = layer._point.subtract(anchor),
                    ctx = this._ctx,
                    img = layer._getImage();

                if (img.complete) {
                        ctx.drawImage(img, p.x, p.y, size.x, size.y);
                } else {
                        L.DomEvent.on(img, 'load', function() {
                                ctx.drawImage(img, p.x, p.y, size.x, size.y);
                        });
                }

                this._drawnLayers[layer._leaflet_id] = layer;
        }
});


L.canvas.tile = function(tileCoord, tileSize, opts){
        return new L.Canvas.Tile(tileCoord, tileSize, opts);
};

/*
 * Copyright 2017, Joachim Kuebart <joachim.kuebart@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   1. Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the
 *      distribution.
 *
 *   3. Neither the name of the copyright holder nor the names of its
 *      contributors may be used to endorse or promote products derived
 *      from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

    function zip() {
        var args = Array.prototype.slice.call(arguments);
        return Object.keys(args[0]).map(function (i) {
            return args.map(function (a) { return a[i]; });
        });
    }

    /**
     * An immutable value type for summaries.
     */
    function summary() {
        return summaryImp(0, 0);

        // Private implementation
        function summaryImp(m_walks, m_distance) {
            var self = {};

            self.walks = function () { return m_walks; };
            self.distance = function () { return m_distance; };

            self.toString = function () {
                return [
                    m_walks +' walks', (Math.round(m_distance / 100) / 10) +'km',
                ].join(' — ');
            };

            self.accumulate = function (dist) {
                return summaryImp(1 + m_walks, dist + m_distance);
            };

            return self;
        }
    }

    /**
     * The summary pane reacts to changes in the visible year layers.
     */
    function summaryPane(walks, onChange) {
        var self = {};
        var m_visibleYears = {};
        var m_summary = summary();

        function handleVisible(year, visible) {
            if (visible != m_visibleYears[year]) {
                m_visibleYears[year] = visible;
                m_summary = walks.flatMap(function (walk) {
                        return zip(walk.dates, walk.distances);
                    }).reduce(function (sum, dateDistance) {
                        if (m_visibleYears[dateDistance[0].substr(0, 4)]) {
                            return sum.accumulate(dateDistance[1]);
                        } else {
                            return sum;
                        }
                    }, summary());
                if (onChange) {
                    onChange.call(self);
                }
            }
        }

        self.addLayer = function (layer, year) {
            layer.on('add', handleVisible.bind(null, year, true)).
                on('remove', handleVisible.bind(null, year, false));
            return self;
        };

        self.removeLayer = function (layer) {
            layer.off('add').off('remove');
            return self;
        };

        self.render = function () {
            var frag = document.createDocumentFragment(), div;
            if (m_summary.walks()) {
                div = document.createElement('div');
                div.textContent = ''+ m_summary;
                frag.appendChild(div);
            }
            return frag;
        };

        return self;
    }

/*
 * Copyright 2017, Joachim Kuebart <joachim.kuebart@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   1. Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the
 *      distribution.
 *
 *   3. Neither the name of the copyright holder nor the names of its
 *      contributors may be used to endorse or promote products derived
 *      from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

// Missing monadic operation
if ('function' !== typeof Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, 'flatMap', {
        'value': function () {
            'use strict';

            // return [].concat(f(this[0]), f(this[1]), ...)
            return Array.prototype.concat.apply([],
                Array.prototype.map.apply(this, arguments)
            );
        },
    });
}

/**
 * Return a Promise that resolves to the response object on success. If
 * `type` is unspecified, JSON is assumed.
 */
function load(url, type) {
    'use strict';

    var xhr = new XMLHttpRequest();

    xhr.open('GET', url);
    xhr.responseType = type || 'json';

    return new Promise(function (resolve, reject) {
        xhr.onload = function () {
            if (200 === this.status) {
                resolve(this.response);
            } else {
                reject(new Error([url, this.status, this.statusText].join(': ')));
            }
        };
        xhr.send();
    });
}

/*
 * Copyright 2017, Joachim Kuebart <joachim.kuebart@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   1. Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the
 *      distribution.
 *
 *   3. Neither the name of the copyright holder nor the names of its
 *      contributors may be used to endorse or promote products derived
 *      from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

var CSS = {
    'DETAILS': 'gpxmap-details',
    'HBOX': 'gpxmap-hbox',
    'SELECT': 'gpxmap-select',
    'TRACK': 'gpxmap-track',
    'VBOX': 'gpxmap-vbox',
    'VIEW': 'gpxmap-view',
};

/**
 * If this looks familiar that's because it's binary search. We find
 * 0 <= i <= array.length such that !pred(i - 1) && pred(i) under the
 * assumption !pred(-1) && pred(length).
 */
function search(array, pred) {
    var le = -1, ri = array.length;
    while (1 + le !== ri) {
        var mi = le + ((ri - le) >> 1);
        if (pred(array[mi])) {
            ri = mi;
        } else {
            le = mi;
        }
    }
    return ri;
}

function yearColour(idx) {
    return ['hsl(',
        170 + 45 * (idx >> 1), ',',
        100, '%,',
        27 * (1 + idx % 2), '%)'
    ].join('');
}

function walkPopup(date, walk) {
    var popup = document.createDocumentFragment();
    var anchor = document.createElement('a');
    var idx = search(walk.dates, function (d) { return date <= d; });

    if (walk.dates[idx] !== date) {
        console.log('walkPopup', date, walk);
        return;
    }

    var elem0 = document.createElement('h3');
    elem0.textContent = walk.title;
    popup.appendChild(elem0);

    elem0 = document.createElement('div');
    elem0.textContent = [
            [ +date.substr(8, 2)
            , +date.substr(5, 2)
            , +date.substr(0, 4)
            ].join('/'),
            +(walk.distances[idx] / 1000).toFixed(1) +'km',
            walk.walkers +' walkers',
            walk.categories.join(' — '),
            '',
        ].join(' — ');

    anchor.setAttribute('href', walk.link);
    anchor.textContent = 'blog';
    elem0.appendChild(anchor);
    popup.appendChild(elem0);

    elem0 = document.createElement('p');
    elem0.textContent = walk.people.sort().join(' • ');
    popup.appendChild(elem0);

    return popup;
}

function gpxmap(id, options) {
    // Create all configured tile layers.
    var tileLayers = options.tileLayers.map(function (layer) {
        return {
            'name': layer.name,
            'tileLayer': L.tileLayer(layer.url, layer.options),
        };
    });

    // Create layers control.
    var layersControl = L.control.layers(null, null, { 'hideSingleBase':true });
    tileLayers.forEach(function (layer) {
        layersControl.addBaseLayer(layer.tileLayer, layer.name);
    });

    // Create the DOM structure for our map.
    var domContainer = L.DomUtil.get(id);
    L.DomUtil.addClass(domContainer, CSS.VBOX);

    // Create map with an initial tile layer and layers control.
    var gpxmap = L.map(L.DomUtil.create('div', CSS.VIEW, domContainer)).
        addControl(L.control.scale()).
        addControl(layersControl).
        addLayer(tileLayers[0].tileLayer);

    var domDetails = L.DomUtil.create('div', CSS.DETAILS, domContainer);

    var hiddenYear = {};
    function trackStyle(hover, selected) {
        return function (props) {
            var year = props.date.substr(0, 4);
            return hiddenYear[year] ? [] : {
                'className': CSS.TRACK,
                'color': yearColour(year - 2011),
                'opacity': hover ? 1 : .8,
                'weight': hover ? 4 : selected ? 3.5 : 2,
            };
        };
    }

    // This layer shows walking tracks.
    var walkLayer = L.vectorGrid.protobuf(
        options.url, {
            'pane': 'overlayPane',
            'maxNativeZoom': 13,
            'getFeatureId': function (walk) { return walk.properties.date; },
            'vectorTileLayerStyles': { '': trackStyle(false) },
        }
    ).addTo(gpxmap);

    // This layer has invisible mouse-responsive tracks.
    var selected;
    var mouseLayer = L.vectorGrid.protobuf(
        options.url, {
            'pane': 'overlayPane',
            'maxNativeZoom': 13,
            'getFeatureId': function (walk) { return walk.properties.date; },
            'vectorTileLayerStyles': { '': function (props) {
                return hiddenYear[props.date.substr(0, 4)] ? [] : {
                    'opacity': 0,
                    'weight': 20,
                };
            } },
            'interactive': true,
        }
    ).on('mouseover', function (evt) {
        walkLayer.setFeatureStyle(evt.layer.properties.date, trackStyle(true));
    }).on('mouseout', function (evt) {
        var date = evt.layer.properties.date;
        if (date === selected) {
            walkLayer.setFeatureStyle(date, trackStyle(false, true));
        } else {
            walkLayer.resetFeatureStyle(date);
        }
    }).addTo(gpxmap);

    load(options.index).then(function (walks) {
        // Collect all years.
        var years = {};
        walks.flatMap(function (walk) { return walk.dates; }).
            forEach(function (date) { years[date.substr(0, 4)] = true; });

        // Build popup from matching index entry.
        mouseLayer.on('click', function (evt) {
            var date = evt.layer.properties.date;
            var idx = search(walks, function (walk) {
                return date < walk.dates[0];
            }) - 1;
            var popup = walkPopup(date, walks[idx]);

            L.DomEvent.stopPropagation(evt);
            if (date === selected) {
                return;
            }
            if (selected) {
                walkLayer.resetFeatureStyle(selected);
            }
            if (popup) {
                L.DomUtil.empty(domDetails);
                domDetails.appendChild(walkPopup(date, walks[idx]));
                selected = date;
                walkLayer.setFeatureStyle(selected, trackStyle(true, true));
            }
        });

        // Set up a summary pane that reacts when years are toggled.
        function renderSummary() {
            var h3 = L.DomUtil.create('h3');

            h3.textContent = options.title;
            L.DomUtil.empty(domDetails);
            domDetails.appendChild(h3);
            domDetails.appendChild(this.render());
        }
        var sumPane = summaryPane(walks, renderSummary);
        gpxmap.on('click', function () {
            if (selected) {
                walkLayer.resetFeatureStyle(selected);
                selected = void 0;
                renderSummary.call(sumPane);
            }
        });

        // Create one layer group per year and add to the map.
        Object.keys(years).forEach(function (year) {
            var lg = L.layerGroup().on('add', function () {
                if (hiddenYear[year]) {
                    selected = void 0;
                    hiddenYear[year] = false;
                    walkLayer.redraw();
                    mouseLayer.redraw();
                }
            }).on('remove', function () {
                if (!hiddenYear[year]) {
                    selected = void 0;
                    hiddenYear[year] = true;
                    walkLayer.redraw();
                    mouseLayer.redraw();
                }
            });
            gpxmap.addLayer(lg);
            layersControl.addOverlay(lg, year);
            sumPane.addLayer(lg, year);
        });

        // Adjust the map's viewport when all GPX tracks are loaded
        var bounds = L.latLngBounds(walks.flatMap(function (walk) {
            return walk.bboxes;
        }).flatMap(function (bbox) {
            var l = bbox.length >> 1;
            return L.GeoJSON.coordsToLatLngs([
                [ bbox[0], bbox[1] ], [ bbox[l], bbox[1 + l] ]
            ]);
        }));
        gpxmap.setMaxBounds(bounds.pad(.05)).fitBounds(bounds);
    });

    return gpxmap;
}

exports.CSS = CSS;
exports.gpxmap = gpxmap;

}((this.GPXMAP = this.GPXMAP || {})));
