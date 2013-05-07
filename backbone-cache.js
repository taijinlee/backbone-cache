(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module and set browser global
    define(['underscore', 'jquery', 'backbone', 'jscache', 'async'], function(_, $, Backbone, JSCache, async) {
      return (root.Backbone = factory(_, $, Backbone, JSCache, async));
    });
  } else {
    // Browser globals
    root.Backbone = factory(root._, $, root.Backbone, JSCache, async);
  }
}(this, function(_, $, Backbone, JSCache, async) {

  Backbone.cache = new JSCache(-1, false, new JSCache.LocalStorageCacheStorage('BackboneCache'));
  Backbone.cache.get = Backbone.cache.getItem;
  Backbone.cache.set = function(key, value, expireSeconds) {
    var expireMillis = expireSeconds ? expireSeconds * 1000 : 86400000 /* 1 day */;
    var expirationAbsolute = new Date((new Date().getTime()) + expireMillis);
    Backbone.cache.setItem(key, value, { expirationAbsolute: expirationAbsolute });
  };
  Backbone.cache.dirty = Backbone.cache.removeItem;

  Backbone.Model.prototype.cacheSet = function(expireSeconds, callback) {
    var attributes = this.attributes;
    if (!attributes.id) { return; } // don't cache anything without an id
    Backbone.cache.set(_.result(this, 'url'), attributes, expireSeconds);
    return callback(null, this);
  };


  Backbone.Model.prototype.cacheGet = function(callback) {
    var url = _.result(this, 'url');
    var cacheData = Backbone.cache.get(url);
    if (!cacheData){
      return callback(new Error('cache missed'));
    }

    this.set(cacheData);
    return callback(null, this);
  };

  Backbone.Collection.prototype.cacheSet = function (expireSeconds, callback) {
    var self = this;
    async.each(this.models, function(model, done){
      model.cache(expireSeconds, done);
    }, function(err){
      Backbone.cache.set(_.result(self, 'url'), self.pluck('id'), expireSeconds);
      return callback(null, self);
    });
  };

  Backbone.Collection.prototype.cacheGet = function (callback) {
    var self = this;
    var url = _.result(this, 'url');
    var ids = Backbone.cache.get(url);

    if (!ids){
      return callback(new Error('cache missed'));
    }

    async.map(ids, function(id, done){
      new model.model({id:id}).fetch({
        cache:true, 
        success: function(model, response, options){
          done(null, model);
        }
      });
    }, function(err, results){
        model.add(results);
        return callback(null, self);
    });   
  };

  var backboneSync = Backbone.sync;
  Backbone.sync = function(method, model, options) {
    var url = _.result(model, 'url');
    var expireSeconds = options.expireSeconds || null;
    var prefill = options.prefill || false;

    model.once('sync', function(model, response, options) {
      if (method === 'read') {
        model.cache(expireSeconds);
      } else if (method === 'update' || method === 'patch' || method === 'delete') {
        Backbone.cache.dirty(url);
      }
    });

    // no cache case
    if (method !== 'read' || options.cache === false) {
      return backboneSync.apply(this, arguments);
    }

    var self = this; 
    var mockXhr = new $.Deferred();
    model.cacheGet(function(error, model){
      if (error){
        return backboneSync.apply(this, arguments).done(function(){
          mockXhr.resolve(model);
        });
      }
      if (prefill) {
        model.trigger('prefill', model, mockXhr, options);
        return backboneSync.apply(self, arguments).done(function(){
          mockXhr.resolve(model);
        });
      } else {
        model.trigger('sync', model, mockXhr, options);
        if (typeof options.success === 'function'){
          options.success();
        }
        return mockXhr.resolve(model);
      }
    });

    return mockXhr;
  };

  return Backbone;

}));
