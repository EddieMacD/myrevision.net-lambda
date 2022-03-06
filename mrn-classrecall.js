exports.handler = async (event) => {
    try {
        //Variables
        ///The school to lookup classes for
        var schoolName = event.queryStringParameters.school;

        ///The response body
        var responseBody = {};


        //Get Schools
        ///Encapsulate database failure
        try {
            ///Get all of the classes for this school
            responseBody.userClasses = await getClasses(schoolName);
            responseBody.userClasses = responseBody.userClasses.records;
        } catch (e) {
            throw ("Error getting classes");
        }

        ///If there aren't any classes then set the value to false
        if (!responseBody.userClasses[0]) {
            responseBody.userClasses = false;
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

//Gets all of the classes for a school
///schoolName: the name of the school that the classes are being recalled for
async function getClasses(schoolName) {
    //Get Classes
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement gets all of the classes that link to the corresponding school name
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT C.class_id, C.name FROM classes C INNER JOIN schools S ON C.school_id=S.school_ID WHERE S.name="' + schoolName + '" AND C.class_active <> 0 ORDER BY C.name ASC;',
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