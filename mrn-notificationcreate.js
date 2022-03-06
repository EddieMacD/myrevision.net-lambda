exports.handler = async (event) => {
    try {
        //Variables
        ///Extracts the timestampe, notification type, linked feature ID, and reciever user ID from the query string parameters
        var notificationData = {};
        notificationData.timestamp = getTimestamp();
        notificationData.type = event.queryStringParameters.type;
        notificationData.featureID = event.queryStringParameters.featureID;
        notificationData.userID = event.queryStringParameters.recieverID;

        ///Empty varaibles to store the sender user's name and the assignment name
        var senderUserName = "";
        var assignmentName = "";

        ///Stores the create SQL used on the database
        var notificationSQL = "";


        //Get Create
        ///Switches on notification type
        switch (notificationData.type) {
            case 'flag':
                ///If the notification is for a flag
                ///Get the sender user's name
                senderUserName = await getUserName(event.queryStringParameters.senderUserEmail);

                ///Write a relevant notification text to tell the recipient that a user has flagged a certain question
                notificationData.info = senderUserName + " has flagged " + event.queryStringParameters.questionIndex;

                ///Create the correct SQL statement
                notificationSQL = compileSingleNotificationSQL(notificationData);
                break;

            case 'comment':
                ///If the notification is for a comment
                ///Get the sender user's name
                senderUserName = await getUserName(event.queryStringParameters.senderUserEmail);
                
                ///Write a relevant notification text to tell the recipient that a user has commented "something" a certain question
                notificationData.info = senderUserName + " has commented \\\"" + event.queryStringParameters.comment + "\\\" on " + event.queryStringParameters.questionIndex;
                
                ///Create the correct SQL statement
                notificationSQL = compileSingleNotificationSQL(notificationData);
                break;

            case 'ass_create':
                ///If the notification is for assignment creation
                ///Get the name of the assignment
                assignmentName = await getAssignmentName(notificationData.featureID);

                ///Write a relevant notification text to tell the recipient that an assignment was created
                notificationData.info = "Assignment \\\"" + assignmentName + "\\\" created.";

                ///Create the correct SQL statement
                notificationSQL = compileMultipleNotificationSQL(notificationData);
                break;

            case 'ass_edit':
                ///If the notification is for assignment edits
                ///Get the name of the assignment
                assignmentName = await getAssignmentName(notificationData.featureID);

                ///Write a relevant notification text to tell the recipient that an assignment was updated
                notificationData.info = "Assignment \\\"" + assignmentName + "\\\" details updated.";

                ///Create the correct SQL statement
                notificationSQL = compileMultipleNotificationSQL(notificationData);
                break;

            case 'ass_delete':
                ///If the notification is for assignment deletes
                assignmentName = await getAssignmentName(notificationData.featureID);

                ///Write a relevant notification text to tell the recipient that an assignment was deleted
                notificationData.info = "Assignment \\\"" + assignmentName + "\\\" deleted.";

                ///Create the correct SQL statement
                notificationSQL = compileMultipleNotificationSQL(notificationData);
                break;

            case 'ass_complete':
                ///If the notification is for assignment completion
                ///Get the sender user's name
                senderUserName = await getUserName(event.queryStringParameters.senderUserEmail);

                ///Get the name of the assignment
                assignmentName = await getAssignmentName(notificationData.featureID);

                ///Write a relevant notification text to tell the recipient that an assignment was completed by a user
                notificationData.info = "Assignment \\\"" + assignmentName + "\\\" completed by " + senderUserName + " with a mark of " + event.queryStringParameters.mark;
                
                ///Create the correct SQL statement
                notificationSQL = compileMultipleNotificationSQL(notificationData);
                break;

            default:
                throw ("You can't make a notification of this type");
        }

        //Create notification
        var responseBody = {};

        ///Encapsulated database failure 
        try {
            ///Create the notification(s) on the database using the previously provided SQL
            var dbData = await createNotification(notificationSQL);
        } catch (e) {
            console.log(e);
            throw ("Error creating notification");
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

//Gets the current timestamp in a format that the database finds friendly
function getTimestamp() {
    //Timestamp
    ///The current time as an ISO string - e.g. '2021-11-03T15:33:31.424Z'
    var now = new Date().toISOString();

    ///Cutting off the Z
    return now.substring(0, 23);
}

//Wrapper function for recalling a user's name from the database
///userEmail: the email address of the user
async function getUserName(userEmail) {
    //Get Name
    ///Recalls the name fields from the database
    var userName = await recallUserName(userEmail);

    ///Extracts those fields into a single string
    userName = userName.records[0][0].stringValue + " " + userName.records[0][1].stringValue;

    return userName;
}

//Recalls a user's names from the database using their email address
///userEmail: the email address of the user
async function recallUserName(userEmail) {
    //Get Names
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL query selects the first and last names of the active user with a specific email address
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT first_name, last_name FROM users WHERE email="' + userEmail + '" AND user_active=1;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Wrapper function for recalling the name of an assignment
///assignmentID: the ID of the assignment
async function getAssignmentName(assignmentID) {
    //Get Name
    ///Recalling the name from the database
    var assignmentName = await recallAssignmentName(assignmentID);

    ///Extracting the name from the returned object
    assignmentName = assignmentName.records[0][0].stringValue;

    return assignmentName;
}

//Recalling the assignment name from the database
///assignmentID: the ID of the assignment
async function recallAssignmentName(assignmentID) {
    //Get Name
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL query selects the name of an assignment with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT name FROM assignments WHERE assignment_id=' + assignmentID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Gets the SQL for creating a notification for one user
///notificationData: the data used to create a notification
function compileSingleNotificationSQL(notificationData) {
    //Create SQL
    ///Writes the first part of the insert statement, detailing what values will be entered for the notification
    var notificationSQL = 'INSERT INTO notifications (timestamp, type, feature_id, user_id, description) VALUES';

    ///Adds the values that will be entered to the SWL
    notificationSQL += '("' + notificationData.timestamp + '", "' + notificationData.type + '", ' + notificationData.featureID + ', "' + notificationData.userID + '", "' + notificationData.info + '");#';

    return notificationSQL;
}

//Gets the SQL for creating notifications for multiple users
///notificationData: the data used to create notifications
function compileMultipleNotificationSQL(notificationData) {
    //Create SQL
    ///Writes the first part of the insert statement, detailing what values will be entered for the notification
    var notificationSQL = 'INSERT INTO notifications (timestamp, type, feature_id, user_id, description) VALUES';

    ///For every user the notification is for
    for (var i = 0; i < notificationData.userID.length; i++) {
        ///Add a set of values to the string
        notificationSQL += ' ("' + notificationData.timestamp + '", "' + notificationData.type + '", ' + notificationData.featureID + ', "' + notificationData.userID[i] + '", "' + notificationData.info + '")';

        ///If this is not the last entry then add a comma and a line break
        if (i < notificationData.userID.length - 1) {
            notificationSQL += ", \n";
        }
    }

    ///Add a semicolon to the end to finish the query
    return notificationSQL + ";";
}

//Executes the provided SQL statement - used to create a notification
///notificationSQl: a full SQL statement for creating a user
async function createNotification(notificationSQL) {
    //Create Notification
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: notificationSQL,
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