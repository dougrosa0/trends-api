const aws = require('aws-sdk');
const googleTrends = require('google-trends-api');

aws.config.update({
  region: 'us-west-2'
});
const docClient = new aws.DynamoDB.DocumentClient();

exports.emailTrends = async function(req) {
  console.log(req.body);
  var searchDate = req.body.date;
  var email = req.body.email
  console.log("Emailing trends for " + searchDate);

  var params = {
      TableName : "googleTrends",
      KeyConditionExpression: "#sd = :searchDate",
      ExpressionAttributeNames:{
          "#sd": "searchDate"
      },
      ExpressionAttributeValues: {
          ":searchDate": searchDate
      }
  };

  docClient.query(params, function(err, data) {
      if (err) {
          console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
      } else {
          var emailContent = "<h2>Trending Google Searches " + searchDate + "</h2>";
          emailContent += "<table><tr><th>Rank</th><th>Search</th><th>Traffic amount</th></tr>";
          console.log("Query succeeded.");
          console.log("Query text | Day rank | Traffic amount | Query link")
          data.Items.sort(function(a, b) {
              return a.dayRank - b.dayRank;
          })
          data.Items.forEach(function(item) {
              emailContent += "<tr><td>" + item.dayRank + "</td><td><a href=\"" + encodeURI('https://google.com/search?q=' + item.queryText) + "\">" + item.queryText + "</a></td><td>" + item.trafficAmount + "</td></tr>";
              console.log(item.queryText + " | " + item.dayRank + " | " + item.trafficAmount + " | " + item.queryLink);
          });
          emailContent += "</table>";
          sendEmail(emailContent);
      }
  });

  function sendEmail(content) {

    // Create sendEmail params data
    var params = {
      Destination: {
        ToAddresses: [
          email
        ]
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

    // Create the promise and SES service object
    var sendPromise = new aws.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

    // Handle promise's fulfilled/rejected states
    sendPromise.then(
      function(data) {
        console.log("Email sent successfully. MessageId: " + data.MessageId);
      }).catch(
        function(err) {
        console.error(err, err.stack);
      });
  }
};

exports.readTrends = async function(req) {
  var searchDate = req.params.date;

  const params = {
    TableName: "googleTrends",
    KeyConditionExpression: "#sd = :searchDate",
    ExpressionAttributeNames: {
      "#sd": "searchDate"
    },
    ExpressionAttributeValues: {
      ":searchDate": searchDate
    }
  };

  try {
    const data = await new Promise((resolve, reject) => {
      docClient.query(params, function (err, data) {
        if (err) {
          console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
          reject(err);
        } else {
          data.Items.sort(function (a, b) {
            return a.dayRank - b.dayRank;
          })
          const trends = data.Items.map(function (item) {
            return {
              dayRank: item.dayRank,
              queryText: item.queryText,
              trafficAmount: item.trafficAmount
            };
          });
          resolve(trends);
        }
      });
    });

    const response = {
      statusCode: 200,
      body: JSON.stringify(data),
    };

    return response;
  } catch (err) {
    console.error("Error:", JSON.stringify(err, null, 2));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }

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

      for (let j = 0; j < trendingSearches.length; j++) {
        const search = trendingSearches[j];
        const rank = j+1;
        const query = search.title.query;
        const trafficAmount = search.formattedTraffic;
        console.log(searchDate + " " + query + " " + trafficAmount);
        await saveItem(query, searchDate, trafficAmount, rank);
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Items saved to DynamoDB" })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" })
    };
  }
};



function saveItem(queryString, searchDate, trafficAmount, dayRank) {
  const queryLink = encodeURI('https://google.com/search?q=' + queryString);
  const params = {
    Item: {
      "searchDate": searchDate,
      "queryText": queryString,
      "trafficAmount": trafficAmount,
      "dayRank": dayRank,
      "queryLink": queryLink
    },
    TableName: "googleTrends"
  };
  return docClient.put(params).promise();
}