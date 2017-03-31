var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var mongoose = require('mongoose');
var User = require('./models/userModel.js');

// We used ES6 syntax with the Authenticate middleware because it was easier to build with and understand
var {authenticate} = require('./middleware/authenticate');
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Comment out one of the two following lines, depending on which database you are using

if (process.env.DATABASE_URL) {
  mongoose.connect('mongodb://heroku_0fn1fg98:vi2sk4eagfo3dj3pbg1407vr0l@ds133450.mlab.com:33450/heroku_0fn1fg98/hydra');
} else {
  try {
    mongoose.connect('mongodb://localhost/hydra');
  } catch (err) {
    mongoose.createConnection('mongodb://localhost/hydra');
  }
}
var db = mongoose.connection;


app.use(express.static(path.join(__dirname, '../client/')));

// Set up POST request listener for creating a new user
// Expects to receive email and password in req.body
app.post('/api/signup', function(req, res) {
  console.log('Received the following POST request to create a user: ', req.body);
  // Mongoose method to create a user

  var user = new User(req.body);
  user.save().then(() => {
    return user.generateToken();
  }).then(token => {
    res.header('x-auth', token).send(user);
  }).catch(err => {
    res.status(400).send(err);
  });
});

// Set up POST request listener for signing in a user
// Expects to receive a user_id in req.body
app.post('/api/signin', function(req, res) {
  var {email, password} = req.body;
  console.log('Received the following GET request for a user: ', req.body);
  User.findByCredentials(email, password).then(user => {
    return user.generateToken().then(token => {
      res.header('x-auth', token).send(user);
    });
  }).catch(err => {
    res.status(400).send(err);
  });
});

app.get('/api/users', authenticate, (req, res) => {
  res.status(200).send(req.user);
});

app.delete('/api/token', authenticate, (req, res) => {
  req.user.removeToken(req.token).then(() => {
    res.status(200).send();
  }, () => {
    res.status(400).send();
  });
});

// Set up POST request listener for creating a new trip
// Expects to receive user_id and trip in req.body, where trip is an object with a tripName property
app.post('/api/trips', authenticate, function(req, res) {
  console.log('Received the following POST request to create a trip: ', req.body);
  // Mongoose method to retrieve and update a user
  User.findOneAndUpdate({'_id': req.body.user_id}, {$push: { trips: { tripName: req.body.trip.tripName } } }, {new: true}, function(err, user) {
    if (err) {
      console.log('Error: ', err);
    } else {
      res.json(user);
    }
  });
});

app.post('/api/itineraries', authenticate, function(req, res) {
  // Pass in request object that includes user id, trip object id, activity object
  console.log('Received the following POST request to create an itinerary item: ', req.body);
  User.findById(req.body.user_id, function(err, user) {
    if (err) {
      console.log('Error: ', error);
    } else {
      // Commented out version with day schema
      // user.trips.id(req.body.trip_id).days.id(req.body.day_id).activities.push(req.body.activity);
      user.trips.id(req.body.trip_id).itineraries.push(req.body.itinerary);
      user.save();
      res.json(user);
    }
  });
});

// Set up POST request listener for creating a new activity
// Expects to receive user_id, trip_id, and activity in req.body,
// where activity is an object with description and category properties
app.post('/api/activities', authenticate, function(req, res) {
  // Pass in request object that includes user id, trip object id, activity object
  console.log('Received the following POST request to create an activity: ', req.body);
  User.findById(req.body.user_id, function(err, user) {
    if (err) {
      console.log('Error: ', error);
    } else {
      // Commented out version with day schema
      // user.trips.id(req.body.trip_id).days.id(req.body.day_id).activities.push(req.body.activity);
      user.trips.id(req.body.trip_id).activities.push(req.body.activity);
      user.save();
      res.json(user);
    }
  });
});

// Set up DELETE request listener for deleting an activity
// Expects to receive user_id, trip_id, and activity_id in req.body
app.delete('/api/activities', authenticate, function(req, res) {
  console.log('Received the following DELETE request to delete an activity: ', req.body);
  // Call Mongoose remove method on id matching the request
  User.findById(req.body.user_id, function(err, user) {
    if (err) {
      console.log('Error: ', error);
    } else {
      // The following code splices an individual activity out of the activities array
      var activities = user.trips.id(req.body.trip_id).activities;
      activities.splice(activities.indexOf(activities.id(req.body.activity_id)), 1);
      user.save();
      res.json(user);
    }
  });
});

const yelp = require('yelp-fusion');
const access_token = 'fGoGg9R3LTeL_o3xFdss8s14Ue258y-6NRnQaLnBY8JKfe_tKZIkmhY3pGwyCIHFPB9UZRQTC_YUoWBknukDeGxD1UlkQ088bxrb53GCuZ7KqDZFySlFWpqAfn7cWHYx';
const client = yelp.client(access_token);


app.post('/api/yelpSearch', function(req, res) {
  var searchQuery = req.body;

  client.search(searchQuery).then(response => {
    res.status(200).send(response.jsonBody.businesses);
  }).catch(e => { console.log(e); });
});

app.post('/api/yelpBusiness', function(req, res) {
  var id = req.body.id;
  var moreInfo = {};
  client.business(id)
    .then(response => {
      moreInfo['details'] = response.jsonBody;
      client.reviews(req.body.id)
        .then(response => {
          moreInfo['reviews'] = response.jsonBody.reviews;
          res.status(200).send(moreInfo);
        });
    });
});


var port = process.env.PORT || 3000;
// var ip = process.env.IP || 'localhost';

app.listen(port, function() {
  console.log('Listening on port ' + port);
});
