exports.handler = async (event) => {
    try { 
        //Sender Data
        ///The ID of the assignment that is being deleted
        var assignmentID = parseInt(event.queryStringParameters.assignmentID);

        ///The sender's username - used to verify they are allowed to create a user
        var senderUser = event.queryStringParameters.senderUsername;
        
        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///If the user is a teacher
        if (senderUserData.accessLevel === "teacher") {
            ///Get the ID of the class that the assignment was created for
            var classID = await getClassID(assignmentID);
            classID = classID.records[0][0].longValue;

            ///Check that the teacher is in that class
            var classCheck = await getClassCheck(senderUserData.email, classID);
            classCheck = JSON.parse(JSON.parse(classCheck.Payload).body);

            ///If they are not in the class then throw an error
            if (!classCheck) {
                throw ("You are not authorised to create and assignment for class you do not belong to.");
            }

        } else if (senderUserData.accessLevel != "admin") {
            ///If the user is not a teacher or admin then throw an error
            throw ("You are not authorised to set assignments");
        }

        ///An object to store the response and to be passed back to the site, to conform with API standards
        var responseBody = {};

        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Delete the assignment from the database
            var dbData = await deleteAssignment(assignmentID);
        } catch (e) {
            console.log(e);
            throw("Error deleting assignment");
        }
        
        ///Create a notification for the class about the assignment being deleted
        await createNotifications(assignmentID);
        
        return generateLambdaResponse(responseBody);
    } catch(e) {
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

//Gets the ID of the class that the assignment was set for
///assignmentID: the ID of the relevant assignment
async function getClassID(assignmentID) {
    //Get ID
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL querys selects the class ID from the assignment with the specific assignment ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT class_id FROM assignments WHERE assignment_id=' + assignmentID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };
    
    ///Executes the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Checks whether or not a user is in a class
///email: the email of the user that is being checked
///classID: the ID of the class that the user is being checked for membership 
async function getClassCheck(email, classID) {
    //Get School
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

//Deletes an assignment from the database
///assignmentID: the ID of the assignment that is being deleted
async function deleteAssignment (assignmentID) {
    //Delete Assignment
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query updates the assignments table to set the field assignment_active to 0 where the assignment has the specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'UPDATE assignments SET assignment_active=0 WHERE assignment_id=' + assignmentID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };
    
    ///Executes the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Creates a notification for the class about this assignment
///assignmentID: the ID of the assignment that was deleted
async function createNotifications (assignmentID) {
    //Get Details
    ///An object to store the input data - formatted to API standards. Contains an assignment ID and notification type
    var lambdaPayload = {
        "queryStringParameters": {
            "type":"delete",
            "assignmentID": assignmentID
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-assignmentnotificationcreate',
        Payload: JSON.stringify(lambdaPayload)
    };
    
    ///Invoking the Lambda function
    return lambda.invoke(lambdaParams).promise();
}

function generateLambdaResponse (responseObject) {
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

function generateFailResponse (error) {
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