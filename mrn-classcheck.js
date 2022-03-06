exports.handler = async (event) => {
    //Encapsulate database failure and throw basic error message. Prevent database existance from being public to help prevent SQL injection
    try {
        //Variables
        ///The user's email - to be used to query the database
        var email = event.queryStringParameters.email;

        ///The ID of the class that the user may belong to
        var classID = event.queryStringParameters.classID;

        ///Validating the email using a ReGex test. Also makes sure that the email is short enough to be in the database
        if (!(/([\d\w!#$%&'*+-/=?^`{|}~]+\.?[\d\w!#$%&'*+-/=?^`{|}~]+)+@([\d\w]+-?[\d\w]+)+\.\w{2,6}/.test(email)) || email.length > 320) {
            throw ("You cannot retrive the school of this user. Invalid email address");
        }


        //Get UserID
        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Querying the database to get the user's ID
            var dbData = await getUserID(email, classID);
        } catch (e) {
            console.log(e);
            throw ("There was an checking whether you belong to this class.");
        }

        ///Storing the actual value in a response object
        var responseBody = {};

        ///If the user's ID was successfully selected then store the value, if not then return false
        try {
            responseBody.userID = dbData.records[0][0].longValue;
        } catch (e) {
            responseBody.userID = false;
        }

        return generateLambdaResponse(responseBody);
    } catch (e) {
        return generateFailResponse(e);
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();

//A function that uses a cross-table database query to select a user's ID based on their email and the class ID
///userEmail: the email of the user requesting their school
async function getUserID(userEmail, classID) {
    //Get School
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement gets a user's ID with a specific email that belongs to a certain class
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT U.user_id FROM users U INNER JOIN user_class_link L ON U.user_id=L.user_id WHERE U.email = "' + userEmail + '" AND L.class_id=' + classID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

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