exports.handler = async (event) => {
    try {
        //Data Extraction
        ///The ID of the class that a user is being removed from
        var classID = event.queryStringParameters.classID;

        ///The sender's username - used to verify they are allowed to create a user
        var senderUser = event.queryStringParameters.senderUsername;

        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser);
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///The sender user's school name
        var senderSchool = await getUserSchool(senderUserData.email);
        senderSchool = JSON.parse(JSON.parse(senderSchool.Payload).body).school;

        ///The school of the class - the school that the user being removed from the class should be from
        var targetSchool = await getSchoolOfClass(classID);
        targetSchool = targetSchool.records[0][0].stringValue;

        ///The ID of the user that is being removed from the class
        var userID = event.queryStringParameters.userID;

        //Sender Validation
        ///If the sender is a teacher or an admin then let them remove a user from a class
        if (senderUserData.accessLevel == "teacher" || senderUserData.accessLevel == "admin") {
            if (senderUserData.accessLevel == "teacher" && targetSchool != senderSchool) {
                ///If the user is a teacher and creating for a different school then throw an exception
                throw ("You are not authorised to use this feature on another school.");
            }


            //Delete Link
            ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
            try {
                ///Delete the link between a user and a class
                await deleteUserClassLink(userID, classID);
            } catch (e) {
                throw ("Error deleting the link between user to class");
            }

        } else {
            throw ("You are not authorised to perform this action");
        }

        var responseBody = {};

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
///Link to Lambda - used to call lambda functions
const lambda = new AWS.Lambda({
    region: 'eu-west-2'
});


//Gets a user's details from the preexisting Lambda function
///username: a user's username
async function getUserDetails(username) {
    //Get Details
    ///An object to store the input data - formatted to API standards. Contains a user's username
    var lambdaPayload = {
        "queryStringParameters": {
            "username": username
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-userdatarecall',
        Payload: JSON.stringify(lambdaPayload)
    };

    ///Invoking the Lambda function
    return lambda.invoke(lambdaParams).promise();
}

//Gets a user's school from the preexisting Lambda function
///email: the email to be used to get the user's school
async function getUserSchool(email) {
    //Get School
    ///An object to store the input data - formatted to API standards. Contains the user's email
    var lambdaPayload = {
        "queryStringParameters": {
            "email": email
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-userschoolrecall',
        Payload: JSON.stringify(lambdaPayload)
    };

    return lambda.invoke(lambdaParams).promise();
}

//Gets the name of the school that a class belongs to
///classID: the class that belongs to the school
async function getSchoolOfClass(classID) {
    //Get School
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL query selects the school name for a specific class ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT S.name FROM schools S INNER JOIN classes C ON S.school_id = C.school_id WHERE C.class_id=' + classID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Deletes the link between a user and a class
///userID: the ID of the user that is being removed from a class
///classID: the ID of the class that the user being removed from
async function deleteUserClassLink(userID, classID) {
    //Delete Link
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query deletes all users from the user class link table with a specific user ID and class ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'DELETE FROM user_class_link WHERE user_id=' + userID + ' AND class_id=' + classID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
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