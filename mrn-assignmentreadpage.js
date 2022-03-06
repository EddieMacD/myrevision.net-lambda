exports.handler = async (event) => {
    try {
        //Sender Data
        ///The ID of the class that the assignment list is for
        var classID = event.queryStringParameters.classID;

        ///The number of users that were on previous pages
        var offset = event.queryStringParameters.offset;

        ///The amount of users to be shown on the current page
        var amount = event.queryStringParameters.amount;

        var responseBody = {}


        //Get Assignments
        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Gets a list of assignments from the database
            responseBody.assignments = await getAssignments(classID, offset, amount);
            responseBody.assignments = responseBody.assignments.records;

            ///Gets the number of total assignments for that class
            responseBody.count = await getAssignmentCount(classID);

            ///If there is a value then return it, if not then return 0
            try {
                responseBody.count = responseBody.count.records[0][0].longValue;
            } catch {
                responseBody.count = 0;
            }
        } catch (e) {
            console.log(e)
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

//Gets a page of assignments set for a class
///classID: the ID of the class that the page is for
///offset: how many users have gone before this page
///amount: how many users are on the current page
async function getAssignments(classID, offset, amount) {
    //Get Assignments
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///This SQL query selects an assignment's name, description, ID, and deadline depending on the class ID and whether or not the assignment is active
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT A.assignment_id, A.name, A.description, A.deadline FROM assignments A INNER JOIN classes C ON A.class_id = C.class_id ' +
            'WHERE C.class_id=' + classID + ' AND A.assignment_active <> 0 ORDER BY A.deadline LIMIT ' + offset + ', ' + amount + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Executes the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Counts the number of assignments that a class has outstanding
///classID: the class who's assignments are being counted
async function getAssignmentCount(classID) {
    //Get Assignment Count
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement counts all of the assignments outstanding for a class
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT COUNT(*) FROM assignments A INNER JOIN classes C ON A.class_id = C.class_id ' +
            'WHERE C.class_id=' + classID + ' AND A.assignment_active <> 0 GROUP BY C.class_id;',
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