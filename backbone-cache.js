(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module and set browser global
    define(['underscore', 'jquery', 'backbone', 'jscache'], function (_, $, Backbone, JSCache) {
      return (root.Backbone = factory(_, $, Backbone, JSCache));
    });
  } else {
    // Browser globals
    root.Backbone = factory(root._, $, root.Backbone, JSCache);
  }
}(this, function(_, $, Backbone, JSCache) {

  Backbone.cache = new JSCache();
  Backbone.cache.get = Backbone.cache.getItem;
  Backbone.cache.set = Backbone.cache.setItem;
  Backbone.cache.dirty = Backbone.cache.removeItem;

  var backboneSync = Backbone.sync;
  Backbone.sync = function(method, model, options) {
    var url = _.result(model, 'url');

    if (method === 'read' && options.cache === true) {
      var cached = Backbone.cache.get(url);
      if (cached !== null) {
        model.set(cached);
        model.trigger('sync');
        return; // return xhr?
      }
    }

    model.on('sync', function() {
      if (method === 'create') {
        Backbone.cache.set(url, model.attributes, {expirationAbsolute: new Date().options.expiration });
      } else if (method === 'update' || method === 'patch' || method === 'delete') {
        Backbone.cache.dirty(url);
      }
    });

    backboneSync.apply(this, arguments);
  };

}));
