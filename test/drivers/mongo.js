require('should');
var _ = require('lodash');
var q = require('q');
var Promise = require('bluebird');
var MongoDriver = require('../../lib/drivers/mongodb');
var mongoClient = Promise.promisifyAll(require('mongodb').MongoClient);

var dropTestDatabase = function (done) {
  mongoClient.connectAsync('mongodb://localhost:27017/motoreTest')
    .then(function (db) {
      db = Promise.promisifyAll(db);
      return db.dropDatabaseAsync();
    })
    .then(mongoClient.closeAsync)
    .then(done.bind(null, null));
};

var insertTestData = function (done, data) {
  mongoClient.connectAsync('mongodb://localhost:27017/motoreTest')
    .then(function (db) {
      db = Promise.promisifyAll(db);
      return db.dropDatabaseAsync()
        .then(function () {
          return db.createCollectionAsync('table1')
           .then(function () {
             return db.collectionAsync('table1');
           });
        })
        .then(function (collection) {
          collection = Promise.promisifyAll(collection);
          return collection.insertAsync( data || [
            { number: 1 },
            { number: 2 },
            { number: 3 }
          ])
          .then(function () {
            return collection.createIndexAsync({ exampleIndex: 'text' });
          });
        });
    })
    .then(mongoClient.closeAsync)
    .then(done.bind(null, null));
};

describe('MongoDB', function () {

  var mongo;

  // Connect to Mongo
  before(function (done) {
    return mongoClient.connectAsync('mongodb://localhost:27017/motoreTest')
      .then(function (db) {
        db = Promise.promisifyAll(db);
        return db.createCollectionAsync('table1');
      })
      .then(function () {
        mongo = new MongoDriver({
          host: 'localhost',
          port: 27017,
          db: 'motoreTest'
        }, {
          sourceOrTarget: 'source'
        });
        return mongo.connect();
      })
     .then(done.bind(null, null));
  });

  describe('connecting', function () {

    it('should have connected propertly', function () {
      mongo.conn.should.be.a.Object;
    });

    // Doesn't work
    it('should throw an error if the it\' source and the database doesn\'t exist', function (done) {
      var conn = new MongoDriver({
          host: 'localhost',
          port: 27017,
          db: 'databaseThatDoesntExist'
        }, {
          sourceOrTarget: 'source'
        });
        conn.connect()
         .catch(function (err) {
           err.message.should.match(/database/);
           err.message.should.match(/exist/);
           done();
         });
    });

    it('should throw an error if the it\' target and the database exists', function (done) {
      var conn = new MongoDriver({
          host: 'localhost',
          port: 27017,
          db: 'motoreTest'
        }, {
          sourceOrTarget: 'target'
        });
        conn.connect()
         .catch(function (err) {
           err.message.should.match(/database/);
           err.message.should.match(/exist/);
           done();
         });
    });

    it('should throw an error if it can\'t connect to the host', function (done) {
        var conn = new MongoDriver({
          host: 'localhost',
          port: 9999,
          db: 'databaseThatDoesntExist'
        }, {
          sourceOrTarget: 'source'
        });
        conn.connect()
         .catch(function (err) {
           err.name.should.equal('MongoError');
           err.message.indexOf('ECONNREFUSED').should.not.equal(-1);
           done();
         });
    });

  });

  describe('getTables', function () {

    var tables = ['table1', 'helloWorld' + Math.random(), 'anotherTable' + Math.random()];
    before(function (done) {
      mongoClient.connectAsync('mongodb://localhost:27017/motoreTest')
        .then(function (db) {
          db = Promise.promisifyAll(db);
          return db.dropDatabaseAsync()
            .then(function () {
              return q.all(tables.map(function (table) {
                return db.createCollectionAsync(table)
                  .then(function () {
                    return db.collectionAsync(table);
                  })
                  .then(function (coll) {
                    coll = Promise.promisifyAll(coll);
                    return coll.createIndex({ 'exampleIndex': 'text' });
                  });
              }));
            });
        })
        .then(mongoClient.closeAsync)
        .then(done.bind(null, null));
    });

    it('should get all the tables in the database as an object with a name property', function (done) {
      mongo.getTables()
        .then(function (collections) {
          _.pluck(collections, 'name').sort().should.eql(tables.sort());
          done();
        });
    });

    it('should provide the primary key for every table', function (done) {
      mongo.getTables()
        .then(function (collections) {
          var primaryIndexes = _.pluck(collections, 'primaryIndex');
          primaryIndexes.length.should.equal(collections.length);
          _.unique(primaryIndexes).should.eql(['_id']);
          done();
        })
        .catch(done);
    });

    // After
    after(dropTestDatabase);
  });

  describe('createTables', function () {

    it('should create tables passed to it as an object', function (done) {
      var tables = [
        { name: 'hello' },
        { name: 'hello' + Math.random() },
        { name: 'hello2' },
      ];
      mongo.createTables(tables)
        .then(function () {
          return mongo.getTables();
        })
        .then(function (_tables) {
          _.pluck(tables, 'name').sort().should.eql(_.pluck(tables, 'name').sort());
          done();
        })
        .catch(done);
    });
  });

  describe('getNumberOfRows', function () {

    before(insertTestData);

    it('should get the number of rows in a collection', function (done) {
      mongo.getNumberOfRows('table1')
        .then(function (numOfRows) {
          numOfRows.should.equal(3);
          done();
        })
        .catch(done);
    });

    after(dropTestDatabase);
  });

  describe('getRows', function () {

    before(insertTestData);

    it('should get the rows in a collection', function (done) {
      mongo.getRows('table1', 2, 0)
        .then(function (rows) {
          rows.should.be.an.Array;
          rows.length.should.equal(2);
          rows[0].number.should.equal(1);
          done();
        });
    });

    after(dropTestDatabase);
  });

  describe('insertRows', function () {

    before(insertTestData);

    it('should insert the rows into the collection', function (done) {
      mongo.insertRows('table1', [{ hello: 1 }, { hello: 2 }])
       .then(function () {
         return mongo.getRows('table1', 10, 0);
       })
       .then(function (rows) {
         rows.length.should.equal(5);
         rows.should.containDeep([{ hello: 1 }, { hello : 2 }]);
         done();
       });
    });

    after(dropTestDatabase);
  });
});

