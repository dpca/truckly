"use strict";

require("dotenv").load();
const _ = require("lodash");
const request = require("request");
const Twit = require("twit");

_.each([
  "TWITTER_CONSUMER_KEY",
  "TWITTER_CONSUMER_SECRET",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_TOKEN_SECRET",
  "SLACK_HOOK_URL"
], function(v) {
  if (!process.env[v]) {
    throw new Error(v + " not defined, please set it in .env");
  }
});

/**
 * Returns a string day of the week given a day
 * @param {Integer} date
 * @return {String} Day of the week
 */
function dayOfWeek(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

/**
 * Returns whether or not the tweet should be posted to slack
 * @param {Object} truck
 * @param {Object} tweet
 * @return {Boolean} True if tweet should be sent to slack
 */
function shouldSendTweet(truck, tweet) {
  let time = new Date(tweet.created_at);
  return _.includes(truck.days, dayOfWeek(time)) && time.getHours() < 14;
}

/**
 * Returns a nicely formatted slack attachment to post
 * @param {Object} tweet
 * @return {Object} Slack attachment
 */
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

/**
 * Returns the message to send to slack
 * @param {Object} tweet
 * @return {Object} Slack message body
 */
function constructSlackBody(tweet) {
  return { attachments: [ constructSlackAttachment(tweet) ] };
}

/**
 * Sends the given tweet to slack
 * @param {Object} tweet
 */
function messageSlack(tweet) {
  request.post({
    url: process.env.SLACK_HOOK_URL,
    body: JSON.stringify(constructSlackBody(tweet))
  }, function(error, response, body) {
    if (error) { console.log(error); }
  });
}

const trucks = require("./config/trucks.json");

let T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

let stream = T.stream("statuses/filter", {
  follow: _.map(trucks, function(truck) { return truck.id; })
});
stream.on("tweet", function(tweet) {
  let thisTruck = _.find(trucks, { id: tweet.user.id });
  if (!thisTruck) { return; }
  if (shouldSendTweet(thisTruck, tweet)) {
    messageSlack(tweet);
  }
});
