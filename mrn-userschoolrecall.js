exports.handler = async (event) => {
    //Encapsulate database failure and throw basic error message. Prevent database existance from being public to help prevent SQL injection
    try {
        //Variables
        ///The user's email - to be used to query the database
        var email = event.queryStringParameters.email;
        
        ///Validating the email using a ReGex test, imported from online. Also makes sure that the email is short enough to be in the database
        if (!(/([\d\w!#$%&'*+-/=?^`{|}~]+\.?[\d\w!#$%&'*+-/=?^`{|}~]+)+@([\d\w]+-?[\d\w]+)+\.\w{2,6}/.test(email)) || email.length > 320) {
            throw("You cannot retrive the school of this user. Invalid email address");
        }        
           

        //Get School
        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Querying the database to get the user's school
            var dbData = await getSchoolName(email);
        } catch (e) {
            throw("There was an error getting your school name.");
        }

        ///Storing the actual value in a response object
        var responseBody = {};
        responseBody.school = dbData.records[0][0].stringValue;

    	return generateLambdaResponse(responseBody);
    } catch(e) {
        return generateFailResponse("Error reading user data");
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();

//A function that uses a cross-table database query to select a user's school name based on their email
///userEmail: the email of the user requesting their school
async function getSchoolName (userEmail) {
    //Get School
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement gets the school name that corresponds to the user's email 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT S.name FROM users U INNER JOIN schools S ON U.school_id = S.school_id WHERE U.email = "' + userEmail + '";',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    return rdsDataService.executeStatement(sqlParams).promise();
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