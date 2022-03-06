exports.handler = async (event) => {
    try {
        //Variables
        ///The email of the user that is requesting notifications
        var userEmail = event.queryStringParameters.email;

        ///The number of users that were on previous pages
        var offset = parseInt(event.queryStringParameters.offset);

        ///The amount of users to be stored on the current page
        var amount = parseInt(event.queryStringParameters.amount);


        //Get Notifications
        ///Encapsulated database failure
        try {
            ///Gets the user's ID from the database using their email
            var userID = await getUserID(userEmail);

            var responseBody = {};

            ///Gets the page of notifications from the database
            responseBody.notifications = await getNotificationPage(userID, offset, amount);
            responseBody.notifications = responseBody.notifications.records

            ///Gets the number of notifications that the user has 
            responseBody.count = await getNotificationCount(userID);

            ///If there is a value for the count then return it, if not then return 0
            try {
                responseBody.count = responseBody.count.records[0][0].longValue;
            } catch {
                responseBody.count = 0;
            }
        } catch (e) {
            console.log(e);
            throw ("Error getting notifications");
        }

        return generateLambdaResponse(responseBody);
    } catch (e) {
        console.log(e);
        return generateFailResponse(e);
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();

//Wrapper function for getting the user's ID from the database
///userEmail: the email of the user
async function getUserID(userEmail) {
    //Get ID
    ///Get the ID from the database and store it in a variable
    var userID = await recallUserID(userEmail);

    ///Extract the ID from the returned object and return it
    userID = userID.records[0][0].longValue;

    return userID;
}

//Gets a user's ID from their email address
///userEmail: the email of the user
async function recallUserID(userEmail) {
    //Get ID
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement gets the ID of the active user with a specific email address
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT user_id FROM users WHERE email="' + userEmail + '" AND user_active=1;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Gets a page of users from the database
async function getNotificationPage(userID, offset, amount) {
    //Get Notifications
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT notification_id, type, feature_id, description FROM notifications WHERE user_id=' + userID + ' AND is_read=0 ORDER BY timestamp ASC LIMIT ' + offset + ', ' + amount + ' ;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Performing the SQL query
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Counts the number of users in a school and returns a value
///school: the school to have it's user's counted
async function getNotificationCount(userID) {
    //Get School Count
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement counts all of the users in an inputted school, grouped by the school ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT COUNT(*) FROM notifications WHERE user_id=' + userID + ' AND is_read=0 GROUP BY user_id;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

function generateLambdaResponse(responseObject) {
    const response = {
        ///HTTP status code for all good
        "statusCode": 200,
        ///Allow call from anwyhere - must sync with API
        "headers": {
            "access-control-allow-origin": "*"
        },
        ///My data to be sent
        "body": JSON.stringify(responseObject),
        ///Is the response encoded in base 64
        "isBase64Encoded": false
    };

    return response;
}

function generateFailResponse(error) {
    const response = {
        ///HTTP status code for bad
        "statusCode": 500,
        ///Allow call from anwyhere - must sync with API
        "headers": {
            "access-control-allow-origin": "*"
        },
        ///My data to be sent
        "body": error.toString(),
        ///Is the response encoded in base 64
        "isBase64Encoded": false
    };

    return response;
}