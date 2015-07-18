var Model   = require('../lib/model');
var Schema  = require('../lib/schema');
var Rebound = require('../')
var es      = require('elasticsearch');
var should  = require('should');
var util    = require('./testutil');
var faker   = require('faker');

describe('Model:', function () {
  describe('create model', function () {
    it('create model without Rebound Object', function () {
      var User = new Model(
        Rebound.connection,{
            index: 'test',
            type: 'test'
        },
        {},
        new Schema({
          username: String,
          password: String,
          age: Number
      }));
      User.should.be.ok;
      User.should.have.properties(['connection', 'schema']);
      User.schema.should.be.instanceof(Schema);
    });

    it('create model with Rebound Object', function () {
      var UserSchema = new Schema({
        username: String,
        password: String,
        age: Number
      });
      var User = Rebound.model('User', {},UserSchema);
      User.should.be.ok;
      User.should.have.properties(['connection', 'schema']);
      User.schema.should.be.instanceof(Schema);
      User.schema.should.eql(UserSchema);
    });
  });

  describe('Model CRUD', function() {
    var TestSchema = new Schema({
      name: String,
      count: Number
    });
    var TestModel = new Model(Rebound.connection, {}, {index: 'test', type: 'text'}, TestSchema);

    describe('model create', function() {
      it('create document with doc', function() {
        return TestModel
          .create({
            name: faker.name.findName(),
            count: faker.random.number()
          })
          .then(function (result) {
            result.should.be.ok;
            result.created.should.be.true;
          });
      });

      it('create document with doc', function() {
        util.shouldThrowError(function () {
          TestModel.create({ name: faker.name.findName() });
        });
      });
    });

    describe('model delete', function() {
      it('delete created document', function() {
        return TestModel
          .create({
            name: faker.name.findName(),
            count: faker.random.number()
          })
          .then(function (result) {
            return TestModel.delete(result._id);
          })
          .then(function (result) {
            result.should.be.ok;
            result.found.should.be.true;
            result._version.should.be.eql(2);
          });
      });

      it('delete created document by query', function() {
        return TestModel
          .create({
            name: faker.name.findName(),
            count: 10
          })
          .then(function (result) {
            return TestModel.deleteByQuery({
                query: {
                  term: {
                    count: 10
                  }
                }
              });
          })
          .then(function (result) {
            result._indices.test._shards.failed.should.eql(0);
          });
      });
    });

    describe('model update', function() {
      it('update document', function() {
        this.timeout(4000);
        var doc = {
          name: faker.name.findName(),
          count: faker.random.number()
        };

        return TestModel
          .create(doc)
          .delay(500)
          .then(function (result) {
            result.created.should.be.true;
            return TestModel.get(result._id);
          })
          .then(function (result) {
            result._source.name.should.eql(doc.name);
            result._source.count.should.eql(doc.count);
            doc = {
              name: faker.name.findName(),
              count: faker.random.number()
            };
            return TestModel.update(result._id, doc);
          })
          .then(function (result) {
            result._version.should.be.eql(2);
            return result;
          })
          .then(function (result) {
            return TestModel.get(result._id);
          })
          .then(function (result) {
            TestSchema.validateDoc(result._source);
            result._source.name.should.eql(doc.name);
            result._source.count.should.eql(doc.count);
          })
      });
    });

    describe('model search', function() {
      it('search is configured properly', function() {
        this.timeout(4000);
        var doc = {
          name: faker.name.findName(),
          count: faker.random.number()
        };

        return TestModel
          .create(doc)
          .delay(1000)
          .then(function (result) {
            return TestModel
              .search({
                query: {
                  match: {
                    name: doc.name
                  }
                }
              })
          })
          .then(function (result) {
            result.hits.should.be.ok;
            result.hits.total.should.eql(1);
            TestSchema.validateDoc(result.hits.hits[0]._source);
          });
      });
    });
  });

  after(function () {
    return es.Client().indices.delete({index: 'test'});
  });
});
