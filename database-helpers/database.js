function initDb(db) {
    // init users collection and indexes
    db.createCollection('users', {
        validator: { $and: [ 
            {
                "username": {
                    $type: "string", 
                    $exists: true
                },
                "password": {
                    $type: "string", 
                    $exists: true
                }
    }]}}, function(err, collection) {
        console.log(err)
        if(err) {
            console.log("Already exists")
        } else {
            console.log("created collection users");
        }
    });
    db.collection('users').createIndex( {'username': 1}, { unique: true } );
}

const dbClient = require('mongodb').MongoClient;

//"mongodb://localhost:27017"
module.exports = {
    initDatabaseConnection: function initDatabaseConnection(fullUrl, callback) {
        dbClient.connect(fullUrl, {useNewUrlParser:true}, function(err, db) {
            if (err) throw err;
            else {
                db = db.db("cloudstorage");
                initDb(db);
                callback(db);
            }
        })
    }
}