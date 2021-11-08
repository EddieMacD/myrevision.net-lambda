exports.handler = async (event) => {
    try {
        //Variables
        ///The username of the user sending the API request
        var senderUser = event.queryStringParameters.username;
        
        ///The data of the sender user - got via the existing Lambda function
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);
        
        ///The access level of the sender user - extracted from the user data
        var accessLevel = senderUserData.accessLevel;
        //console.log(accessLevel);
        
        ///The response body
        var responseBody = {};
        

        //Get Schools
        ///If the sender user is an admin
        if(accessLevel == "admin") {
            ///Get all of the schools
            responseBody.schools = await getSchools();
            responseBody.schools = responseBody.schools.records;
        } else {
            ///If the sender user is not an admin then throw an error
            throw("You are not authorised to use this feature");
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

//Gets all of the schools from the database
async function getSchools () {
    //Get Schools
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement all of the names in the schools tabel 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT name FROM schools;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
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