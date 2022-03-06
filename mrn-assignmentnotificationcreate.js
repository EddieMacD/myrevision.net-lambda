exports.handler = async (event) => {
    try {
        //Variables
        ///The ID of the assignment that the notification is for
        var assignmentID = event.queryStringParameters.assignmentID;

        ///The type of notification: create, update, delete, or complete
        var type = event.queryStringParameters.type;

        ///Stores the IDs of users that the notification is for
        var userIDs = [];

        var responseBody = {};


        //Send Notifications
        ///If the notification is for an assignment being completed
        if (type === "complete") {
            ///Get a list of user IDs of the teachers in the relevant class
            userIDs = await getUserIDs(assignmentID, "<>");

            ///Send a notification to each of those teachers
            responseBody.data = await completeNotifications(assignmentID, userIDs, event.queryStringParameters.senderUserEmail, event.queryStringParameters.mark);
        } else {
            ///If the notification is not for a completed assignment, get a list of user IDs of all of the students in a relevant class
            userIDs = await getUserIDs(assignmentID, "=");

            ///Send notifications to each of those students
            responseBody.data = await otherNotifications(type, assignmentID, userIDs);
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
///Link to Lambda - used to call lambda functions
const lambda = new AWS.Lambda({
    region: 'eu-west-2'
});

//Handler for retrieving user IDs
///assignmentID: the assignment that the notification is for
///filter: either = or <>, depending on whether the user list should be students or not students
async function getUserIDs(assignmentID, filter) {
    //Get IDs
    ///Array to store the IDs, returned at the end of the function
    var userIDs = [];

    ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
    try {
        ///Getting the user IDs from the database
        var dbData = await recallUserIDs(assignmentID, filter)
    } catch (e) {
        console.log(e);
        throw ("Error getting IDs for creating notifications");
    }

    ///For each record retrieved from the database
    dbData.records.forEach((element) => {
        ///Push the ID to the IDs array
        userIDs.push(element[0].longValue);
    });

    return userIDs;
}

//Gets a list of user's IDs from a class
///assignmentID: the ID of the assignment that the class 
///filter: whether or not to get a list of students
async function recallUserIDs(assignmentID, filter) {
    //Get IDs
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement selects all user IDs from the link table where the assignment and UClink entry have the same class ID, whether the user is a student or not (dependant on filter), and on the assignment ID 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT L.user_id FROM assignments A INNER JOIN user_class_link L ON A.class_id=L.class_id INNER JOIN users U ON U.user_id=L.user_id WHERE A.assignment_id=' + assignmentID + ' AND U.access_level' + filter + '"student";',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Handles notifications for assignment completes
///assignmentID: the ID of the assignment that the notification is for
///userIDs: an array of user IDs for all of the relevant assignment targets
///senderUserEmail: the email address of the sender
///mark: the mark that the user got on the assignment
async function completeNotifications(assignmentID, userIDs, senderUserEmail, mark) {
    //Get Details
    ///An object to store the input data - formatted to API standards. Contains a 
    var lambdaPayload = {
        "queryStringParameters": {
            "type": "ass_complete",
            "featureID": assignmentID,
            "recieverID": userIDs,
            "senderUserEmail": senderUserEmail,
            "mark": mark
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-notificationcreate',
        Payload: JSON.stringify(lambdaPayload)
    };

    ///Invoking the Lambda function
    return lambda.invoke(lambdaParams).promise();
}

//Handles Create, Update, and Delete notifications
///type: the specific type of notification
///assignmentID: the ID of the assignment that the notification is for
///userIDs: an array of user IDs for all of the relevant assignment targets
async function otherNotifications(type, assignmentID, userIDs) {
    //Get Details
    ///An object to store the input data - formatted to API standards. Contains a 
    var lambdaPayload = {
        "queryStringParameters": {
            "type": "ass_" + type,
            "featureID": assignmentID,
            "recieverID": userIDs
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-notificationcreate',
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