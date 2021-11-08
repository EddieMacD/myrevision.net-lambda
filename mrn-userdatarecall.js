exports.handler = async (event) => {
    try {
        //Variables
        ///A user's username. Automatically generated by cognitio on sign up and theoretically secure
        var username = event.queryStringParameters.username;
        

        //Get Data
        ///Get a user's data from cognito
        var cognitoData = await getUserData(username);

        ///Store the email in a variable
        var userEmail = cognitoData.UserAttributes[2].Value;
    
        ///Call the database to get the user's access level
        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Get the user's email from the database
            var dbData = await getAccessLevel(userEmail);
        } catch (e) {
            throw("Error retrieving access level.");
        }
        
        ///Generates a response body with the database data and the user's email
        var responseBody = {};
        responseBody.accessLevel = dbData.records[0][0].stringValue;
        responseBody.email = userEmail;

    	return generateLambdaResponse(responseBody);
    } catch(e) {
        return generateFailResponse(e);
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();
///Cognito link - allows manipulation or retrieval of users and their data
const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

//Gets a user's data from cognito based on their username
///username: a user's automatically generated username
async function getUserData(username) {
    //Get User Data
    ///An object containing all of the necessary parameters to retrieve user data. Includes the user pool ID and a user's username 
    var cognitoParams = {
        Username: username,
        UserPoolId: 'eu-west-2_7lDI3aJAl'
    };
    
    ///Getting the user data from cognito
    return cognitoIdentityServiceProvider.adminGetUser(cognitoParams).promise();
}

//A function that uses a database query to select a user's access level based on their email
///userEmail: the email of the user requesting their access level
async function getAccessLevel (userEmail) {
    //Get Access Level
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement gets the school name that corresponds to the user's email 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT access_level FROM users WHERE email="' + userEmail + '";',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Execute the SQL statement
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