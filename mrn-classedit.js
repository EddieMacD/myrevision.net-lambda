exports.handler = async (event) => {
    try {
        //Data Extraction
        ///The ID of the class to be edited
        var classID = event.queryStringParameters.classID;

        ///The new value of the data that is being changed
        var newValue = event.queryStringParameters.newValue;

        ///The type of value that is being changed
        var valueType = event.queryStringParameters.valueType;

        ///The sender's username - used to verify they are allowed to create a user
        var senderUser = event.queryStringParameters.senderUsername;

        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser);
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///The sender user's school name
        var senderSchool = await getUserSchool(senderUserData.email);
        senderSchool = JSON.parse(JSON.parse(senderSchool.Payload).body).school;

        ///The name of the school that the class belongs to
        var targetSchool = event.queryStringParameters.school;

        //Sender Validation
        ///If the sender is a teacher or an admin then let them create a useer
        if (senderUserData.accessLevel == "teacher" || senderUserData.accessLevel == "admin") {
            if (senderUserData.accessLevel == "teacher" && targetSchool != senderSchool) {
                ///If the user is a teacher and creating for a different school then throw an exception
                throw ("You are not authorised to use this feature on another school.");
            }


            //Edit Class
            ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
            try {
                ///Switch based on the value type
                switch (valueType) {
                    case "name":
                        ///If the name is being changed change the class' name
                        await changeClassName(newValue, classID);
                        break;

                    case "subject":
                        ///If the subject is being changed change the class' subject
                        await changeClassSubject(newValue, classID);
                        break;

                    default:
                        throw ("Error");
                }
            } catch (e) {
                throw ("Error editing class - you may have an invalid value");
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

//Changes the name of a class
///newName: the value that the name is being changed to
///classID: the ID of the class that is being changed
async function changeClassName(newName, classID) {
    //Change Name
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query updates the name field of a class with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'UPDATE classes SET name="' + newName + '" WHERE class_id=' + classID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Changes the subject of a class
///newSubject: the value that the subject is being changed to
///classID: the ID of the class that is being changed
async function changeClassSubject(newSubject, classID) {
    //Change Subject
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query updates the subject field of a class with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'UPDATE classes SET subject="' + newSubject + '" WHERE class_id=' + classID + ';',
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