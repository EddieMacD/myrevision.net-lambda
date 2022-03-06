exports.handler = async (event) => {
    try {
        //Sender Data
        ///An object to store the input data
        var params = JSON.parse(event.body);

        ///The ID of the class that the assignment is for
        var classID = params.classID;

        ///The sender's username - used to verify they are allowed to create a user
        var senderUser = params.senderUsername;

        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///If the user is a teacher
        if (senderUserData.accessLevel === "teacher") {
            ///Check that they are in the class
            var classCheck = await getClassCheck(senderUserData.email, classID);
            classCheck = JSON.parse(JSON.parse(classCheck.Payload).body);

            ///If they are not in the class then throw an error
            if (!classCheck) {
                throw ("You are not authorised to create and assignment for class you do not belong to.");
            } else {
                senderUserData.userID = classCheck;
            }

        } else if (senderUserData.accessLevel != "admin") {
            ///If the user is not a teacher or admin then throw an error
            throw ("You are not authorised to set assignments");
        }


        //Validate New Data
        ///Put the data from the input parameters into a new object
        var assignmentData = {};
        assignmentData.ID = parseInt(params.assignmentData.ID);
        assignmentData.name = params.assignmentData.name;
        assignmentData.info = params.assignmentData.info;
        assignmentData.deadline = params.assignmentData.deadline;

        ///Validate each field in turn
        if (assignmentData.name.length > 31 || assignmentData.name.length < 0) {
            ///Range check the name
            throw ("This name is invalid");
        } else if (assignmentData.info.length > 255 || assignmentData.info.length < 0) {
            ///Range check the description
            throw ("This description is invalid");
        } else if (!(/\d{4}-(0[1-9]|1[012])-(0[1-9]|[1-2]\d|3[01])T([01]\d|2[0-3])(:[0-5]\d){2}\.\d{3}/.test(assignmentData.deadline))) {
            ///Format check the name
            throw ("This date is invalid");
        }

        ///An object to store the response and to be passed back to the site, to conform with API standards
        var responseBody = {};

        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Delete the user from the database
            var dbData = await editAssignment(assignmentData);
        } catch (e) {
            console.log(e);
            throw ("Error editing assignment");
        }

        ///Creates notifications for the class about the edited assignment
        await createNotifications(assignmentData.ID);

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

//Edits assignment data in the database
///assignmentData: information about the assignment in an object - both the data being changed and the ID
async function editAssignment(assignmentData) {
    //Edit Assignment
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query updates the assignments table to set the name, description, and deadline of an assignment with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'UPDATE assignments SET name="' + assignmentData.name + '", description="' + assignmentData.info + '", deadline="' +
            assignmentData.deadline + '" WHERE assignment_id=' + assignmentData.ID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Executes the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Creates a notification for the class about this assignment
///assignmentID: the ID of the assignment that was created
async function createNotifications(assignmentID) {
    //Create Notification
    ///An object to store the input data - formatted to API standards. Contains an assignment ID and notification type
    var lambdaPayload = {
        "queryStringParameters": {
            "type": "edit",
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