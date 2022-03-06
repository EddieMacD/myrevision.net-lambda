exports.handler = async (event) => {
    try {
        //Sender Data
        ///The school that the data is being queried from
        var email = event.queryStringParameters.email;

        ///The number of users that were on previous pages
        var offset = event.queryStringParameters.offset;

        ///The amount of users to be shown on the current page
        var amount = event.queryStringParameters.amount;

        var responseBody = {};


        //Get Assignments
        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Gets the user's ID from the database
            var userID = await getUserID(email);
            userID = userID.records[0][0].longValue;

            ///Uses the user's ID to get a page of assignments
            responseBody.assignments = await getAssignments(userID, offset, amount);
            responseBody.assignments = responseBody.assignments.records;

            ///Gets the number of total assignments for that user
            responseBody.count = await getAssignmentCount(userID);

            ///If there is a value for the count then return it, if not then return 0
            try {
                responseBody.count = responseBody.count.records[0][0].longValue;
            } catch {
                responseBody.count = 0;
            }

        } catch (e) {
            console.log(e);
            throw ("There was an error retrieving assignment data");
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

//Gets a user's ID based on their email address
///email: the email address of the user
async function getUserID(email) {
    //Get ID
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query selects a user ID with a specific email address 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT user_id FROM users WHERE email="' + email + '";',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Executes the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Gets a list of assignments for a specific user
///userID: the ID of the user that is requesting a list of assignments
///offset: how many assignments have gone before this page
///amount: how many assignments are on the current page
async function getAssignments(userID, offset, amount) {
    //Get Assignments
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query gets the assignment ID, name, description, deadline, and class name related to an assignment
    ///It selects this by joining through to the user's table and selecting assignments tied to that user's ID
    ///It also selects based on assignment ids not in a seperate query listing all of the assignment IDs in that user' history
    ///Active assignments only are selected and the request is limited by parameters and ordered by deadline
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT A.assignment_id, A.name, A.description, A.deadline, C.name FROM assignments A INNER JOIN classes C ON A.class_id = C.class_id ' +
            'INNER JOIN user_class_link L ON C.class_id=L.class_id INNER JOIN users U ON L.user_id=U.user_id WHERE U.user_id=' + userID +
            ' AND A.assignment_id NOT IN (SELECT assignment_id FROM question_history WHERE user_id=' + userID +
            ' AND assignment_id > 0 GROUP BY assignment_id) AND A.assignment_active <> 0 ORDER BY A.deadline LIMIT ' + offset + ', ' + amount + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Executes the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Counts the number of assignments that a user has outstanding
///userID: the user who's assignments are being counted
async function getAssignmentCount(userID) {
    //Get Assignment Count
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement counts all of the assignments outstanding for a user
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT COUNT(*) FROM assignments A INNER JOIN classes C ON A.class_id = C.class_id ' +
            'INNER JOIN user_class_link L ON C.class_id=L.class_id INNER JOIN users U ON L.user_id=U.user_id WHERE U.user_id=' + userID +
            ' AND A.assignment_id NOT IN (SELECT assignment_id FROM question_history WHERE user_id=' + userID +
            ' AND assignment_id > 0 GROUP BY assignment_id) AND A.assignment_active <> 0 GROUP BY U.user_id;',
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