var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors')
var verifierRouter = require('./routes/api');
var formatterRouter = require('./routes/formatter');
var githubTestRouter = require('./routes/githubTest');//githubのテスト用

var app = express();

// CORSを無視する
app.use(cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '1000mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v0.1/verifier', verifierRouter);
app.use('/api/v0.1/formatter', formatterRouter);
app.use('/api/v0.1/githubTest', githubTestRouter);//githubのテスト用

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  // res.render('error');
  console.log(err.status)
});

module.exports = app;
