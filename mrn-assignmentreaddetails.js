exports.handler = async (event) => {
    try {
        //Get Assignment
        ///An object to store the input data
        var assignmentID = event.queryStringParameters.assignmentID;

        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Recall the assignment data from the database
            var assignmentData = await getAssignment(assignmentID);
        } catch (e) {
            console.log(e);
            throw ("There was an error retrieving assignment data")
        }


        //Validate Class
        ///The ID of the class that the assignment was set for, retrieved from the assignment
        var classID = parseInt(assignmentData.records[0][4].longValue);

        ///The sender's username - used to verify they are allowed to create a user
        var senderUser = event.queryStringParameters.senderUsername;

        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///Check that they are in the class
        var classCheck = await getClassCheck(senderUserData.email, classID);
        classCheck = JSON.parse(JSON.parse(classCheck.Payload).body);

        ///If they are not in the class then throw an error
        if (!classCheck) {
            throw ("You are not authorised to retrieve an assignment that you have not been set.");
        }

        return generateLambdaResponse(assignmentData.records[0]);
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

//Checks whether or not a user is in a class
///email: the email of the user that is being checked
///classID: the ID of the class that the user is being checked for membership 
async function getClassCheck(email, classID) {
    //Check Class
    ///An object to store the input data - formatted to API standards. Contains the user's email
    var lambdaPayload = {
        "queryStringParameters": {
            "email": email,
            "classID": classID
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-classcheck',
        Payload: JSON.stringify(lambdaPayload)
    };

    ///Invoking the Lambda function
    return lambda.invoke(lambdaParams).promise();
}

//Gets details about an assignment from the database
///assignmentID: the ID of the assignment that details are wanted for
async function getAssignment(assignmentID) {
    //Get Assignment
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL statement selects the name, description, deadline, filters, and class ID of an assignment with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT name, description, deadline, filters_json, class_id FROM assignments WHERE assignment_ID=' + assignmentID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Executes the SQL statement
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