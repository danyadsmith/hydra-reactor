const chalk = require('chalk');
const config = require('../config/config');
const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

mongoose.Promise = global.Promise;

const Schema = mongoose.Schema;

const UserSchema = new Schema();

UserSchema.add({
  firstName: {
    type: String,
    required: true,
    unique: false
  },
  lastName: {
    type: String,
    required: true,
    unique: false
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    validate: {
      isAsync: true,
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password: {
    type: String,
    required: true,
    unique: false,
    minLength: 1
  },
  tokens: [{
    access: {
      type: String
    },
    token: {
      type: String
    }
  }],
  trips: [{
    type: Schema.Types.ObjectId,
    ref: 'Trip'
  }]
});

UserSchema.methods.generateToken = function () {

  if (config.debug) {
    console.log(chalk.yellow('Entering the GenerateToken function...'));
  }

  var user = this;

  if (config.debug) {
    console.log(chalk.white('User: ', JSON.stringify(user, null, 2)));
  }

  var access = 'auth';
  var token = jwt.sign({_id: user._id.toString(), access}, 'somesecret');

  user.tokens.push({access, token});

  return user.save().then(() => {
    return token;
  });
};

UserSchema.methods.removeToken = function (token) {
  var user = this;

  return user.update({
    $pull: {
      tokens: {token}
    }
  });
};

// 'UserSchema.statics' is a collection of methods on the UserSchema model
UserSchema.statics.findByToken = function (token) {
  //var User = this;
  var decoded;

  try {
    decoded = jwt.verify(token, 'somesecret');
  } catch (err) {
    return Promise.reject(err);
  }
  // find user by id and token
  return User.findOne({
    '_id': decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  }).populate('trips');
};

// find user by email and password
UserSchema.statics.findByCredentials = function (email, password) {
  //var User = this;

  return User.findOne({email}).populate('trips').then((user) => {
    if (!user) {
      console.log('Promise.reject');
      return Promise.reject();
    }
    // because bcrypt didn't support Promises, use generic Promise
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if (res) {
          resolve(user);
        } else {
          reject(err);
        }
      });
    });
  });
};

// Mongoose middleware, runs before each 'save'
UserSchema.pre('save', function (next) {
  var user = this;

  if (!user.isModified('password')) {
    return next();
  }
  // hash user password using salt 10 times
  bcrypt.hash(user.password, 10, (err, hash) => {
    if (err) {
      return next(err);
    }
    user.password = hash;
    next();
  });
});

var User = mongoose.model('User', UserSchema);

module.exports = User;
