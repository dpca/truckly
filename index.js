"use strict";

require("dotenv").load();
var _ = require("lodash");
var request = require("request");
var Twit = require("twit");

_.each(["TWITTER_CONSUMER_KEY",
        "TWITTER_CONSUMER_SECRET",
        "TWITTER_ACCESS_TOKEN",
        "TWITTER_ACCESS_TOKEN_SECRET",
        "SLACK_HOOK_URL"], function(v) {
  if (!process.env[v]) {
    throw new Error(v + " not defined, please set it in .env");
  }
});

function dayOfWeek(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

function shouldSendTweet(truck, tweet) {
  var time = new Date(tweet.created_at);
  return _.includes(truck.days, dayOfWeek(time)); // && time.getHours() < 12;
}

function constructTweetHeader(truck, tweet) {
  return truck.name + " just tweeted! " + "<https://twitter.com/" + tweet.user.screen_name + "/@" + tweet.user.screen_name + ">";
}

function constructSlackAttachment(tweet) {
  return {
    fallback: "@" + tweet.user.screen_name + ": " + tweet.text,
    pretext: tweet.user.name + " just tweeted!",
    author_name: "@" + tweet.user.screen_name,
    author_link: "https://twitter.com/" + tweet.user.screen_name,
    text: tweet.text,
    color: "#439FE0" // light blue
  };
}

function constructSlackBody(tweet) {
  return { attachments: [ constructSlackAttachment(tweet) ] };
}

function messageSlack(tweet) {
  request.post({
    url: process.env.SLACK_HOOK_URL,
    body: JSON.stringify(constructSlackBody(tweet))
  }, function(error, response, body) {
    if (error) { console.log(error); }
  });
}

var trucks = require("./config/trucks.json");

var T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

var stream = T.stream("statuses/filter", {
  follow: _.map(trucks, function(truck) { return truck.id; })
});
stream.on("tweet", function(tweet) {
  var thisTruck = _.find(trucks, { id: tweet.user.id });
  if (!thisTruck) { return; }
  if (shouldSendTweet(thisTruck, tweet)) {
    messageSlack(tweet);
  }
});
