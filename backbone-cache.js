(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module and set browser global
    define(['underscore', 'jquery', 'backbone', 'jscache'], function(_, $, Backbone, JSCache) {
      return (root.Backbone = factory(_, $, Backbone, JSCache));
    });
  } else {
    // Browser globals
    root.Backbone = factory(root._, $, root.Backbone, JSCache);
  }
}(this, function(_, $, Backbone, JSCache) {

  Backbone.cache = new JSCache(-1, false, new JSCache.LocalStorageCacheStorage('BackboneCache'));
  Backbone.cache.get = Backbone.cache.getItem;
  Backbone.cache.set = function(key, value, expireSeconds) {
    var expireMillis = expireSeconds ? expireSeconds * 1000 : 86400000 /* 1 day */;
    var expirationAbsolute = new Date((new Date().getTime()) + expireMillis);
    Backbone.cache.setItem(key, value, { expirationAbsolute: expirationAbsolute });
  };
  Backbone.cache.dirty = Backbone.cache.removeItem;

  Backbone.Model.prototype.cacheModel = function() {
    var attributes = this.attributes;
    if (!attributes.id) { return; } // don't cache anything without an id
    Backbone.cache.set(this.url(), attributes);
    return this;
  };

  var backboneSync = Backbone.sync;
  Backbone.sync = function(method, model, options) {
    var url = model.url();
    var expireSeconds = options.expireSeconds || null;
    var prefill = options.prefill || false;

    if (method === 'read' && options.cache === true) {
      var cached = Backbone.cache.get(url);
      if (cached !== null) {
        model.set(cached, { parse: true });
        var mockXhr = new $.Deferred();
        model.trigger('sync', model, mockXhr, options);
        if (!prefill) {
          return mockXhr.resolve(model);
        } // otherwise fall through to do
      }
    }

    model.on('sync', function(model, response, options) {
      if (method === 'read') {
        Backbone.cache.set(url, response, expireSeconds);
      } else if (method === 'update' || method === 'patch' || method === 'delete') {
        Backbone.cache.dirty(url);
      }
    });

    backboneSync.apply(this, arguments);
  };

  return Backbone;

}));
