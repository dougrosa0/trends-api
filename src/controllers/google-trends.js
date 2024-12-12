const AWS_REGION = 'us-west-2';
const TABLE_NAME = 'googleTrends';
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const googleTrends = require('google-trends-api');

const client = new DynamoDBClient({ region: AWS_REGION, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } });
const docClient = DynamoDBDocumentClient.from(client);
const sesClient = new SESClient({ region: AWS_REGION, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } });

exports.emailTrends = async function(req) {
  var searchDate = req.body.date;
  var email = req.body.email
  console.log("Emailing trends for " + searchDate);

  var params = {
      TableName : TABLE_NAME,
      KeyConditionExpression: "#sd = :searchDate",
      ExpressionAttributeNames:{
          "#sd": "searchDate"
      },
      ExpressionAttributeValues: {
          ":searchDate": searchDate
      }
  };

  try {
    const result = await docClient.send(new QueryCommand(params));
    let emailContent = "<h2>Trending Google Searches " + searchDate + "</h2>";
    emailContent += "<table><tr><th>Rank</th><th>Search</th><th>Traffic amount</th></tr>";
    
    result.Items.sort((a, b) => a.dayRank - b.dayRank);
    
    result.Items.forEach(function(item) {
      emailContent += "<tr><td>" + item.dayRank + "</td><td><a href=\"" + encodeURI('https://google.com/search?q=' + item.queryText) + "\">" + item.queryText + "</a></td><td>" + item.trafficAmount + "</td></tr>";
    });
    
    emailContent += "</table>";
    await sendEmail(email, emailContent);
  } catch (err) {
    console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
  }
};

async function sendEmail(email,content) {
  const params = {
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: content
          },
          Text: {
          Charset: "UTF-8",
          Data: content
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Google Trends'
      }
    },
    Source: 'dougrosa0@gmail.com'
  };

  try {
    const result = await sesClient.send(new SendEmailCommand(params));
    console.log("Email sent successfully. MessageId: " + result.MessageId);
  } catch (err) {
    console.error(err, err.stack);
  }
}

exports.readTrends = async function(req) {
  var searchDate = req.params.date;

  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "#sd = :searchDate",
    ExpressionAttributeNames: {
      "#sd": "searchDate"
    },
    ExpressionAttributeValues: {
      ":searchDate": searchDate
    }
  };

  const result = await docClient.send(new QueryCommand(params));
  const trends = result.Items.sort((a, b) => a.dayRank - b.dayRank)
    .map(item => ({
      dayRank: item.dayRank,
      queryText: item.queryText,
      trafficAmount: item.trafficAmount
    }));

  return {
    statusCode: 200,
    body: JSON.stringify(trends),
  };
};

exports.writeTrends = async function() {
  try {
    const results = await googleTrends.dailyTrends({ geo: 'US' });
    const dailyGoogleTrends = JSON.parse(results);
    const days = dailyGoogleTrends.default.trendingSearchesDays;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const trendingSearches = day.trendingSearches;
      const searchDate = day.date;
      console.log("Writing trends for " + searchDate);

      for (let j = 0; j < trendingSearches.length; j++) {
        const search = trendingSearches[j];
        const rank = j+1;
        const query = search.title.query;
        const trafficAmount = search.formattedTraffic;
        await saveItem(query, searchDate, trafficAmount, rank);
      }
    }
    console.log("Trends saved successfully");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Trends saved" })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" })
    };
  }
};

async function saveItem(queryString, searchDate, trafficAmount, dayRank) {
  const queryLink = encodeURI('https://google.com/search?q=' + queryString);
  const params = {
    Item: {
      "searchDate": searchDate,
      "queryText": queryString,
      "trafficAmount": trafficAmount,
      "dayRank": dayRank,
      "queryLink": queryLink
    },
    TableName: TABLE_NAME
  };
  return docClient.send(new PutCommand(params));
}