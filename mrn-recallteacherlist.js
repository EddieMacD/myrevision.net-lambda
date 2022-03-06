exports.handler = async (event) => {
    try {
        //List teachers
        ///The email of the user that requested the list
        var userEmail = event.queryStringParameters.email;

        var responseBody = {};

        ///Encapsulated database failure
        try {
            ///Recalling the ID of the user who sent the request
            var userID = await getUserID(userEmail);

            ///Recalling the list of teachers from the database
            responseBody.teachers = await getTeachers(userID)
            responseBody.teachers = responseBody.teachers.records;
        } catch (e) {
            console.log(e);
            throw ("error getting teacher list")
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

//Recalls a list of teachers in the same class as a user
///userID: the ID of the user who is requesting the list
async function getTeachers(userID) {
    //Get Data
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement selects the names and IDs of users who are teachers in a class that the requester is in
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT U.first_name, U.last_name, U.user_id FROM users U INNER JOIN user_class_link L ON U.user_id=L.user_id WHERE U.access_level="teacher" ' 
            + 'AND L.class_id IN (SELECT class_id FROM user_class_link WHERE user_id=' + userID + ') GROUP BY U.user_id;',
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