exports.handler = async (event) => {
    try {
        //Variables
        ///The user's username
        var username = event.queryStringParameters.username;

        ///The email that the user wishes to change to
        var newEmail = event.queryStringParameters.newEmail;
        
        ///Validating the email using a ReGex test, imported from online. Also makes sure that the email is show enough to be in the database
        if (!(/([\d\w!#$%&'*+-/=?^`{|}~]+\.?[\d\w!#$%&'*+-/=?^`{|}~]+)+@([\d\w]+-?[\d\w]+)+\.\w{2,6}/.test(newEmail)) || newEmail.length > 320) {
            throw("Invalid email address. You cannot change your email to this");
        }
        

        //Change email
        ///Getting the user's old email address from the system for changing the database - doubles as validating the username
        var cognitoData = await getUserEmail(username);
        var oldEmail = cognitoData.UserAttributes[2].Value;
        
        ///Changing the email in cognito
        cognitoData = await setUserEmail(username, newEmail);

        ///Changing the email in the database - shouldn't fail but encapsulated anyway
        try {
            var dbData = await changeDatabaseEmail(newEmail, oldEmail);
        } catch (e) {
            throw "There was an error changing your email address";
        }
        
        var responseBody = {};
        
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

//Gets the user's email form their cognito profile
///username: the user's username
async function getUserEmail(username) {
    //Get User Data
    ///An object containing all of the necessary parameters to retrieve user data. Includes the user pool ID and a user's username 
    var cognitoParams = {
        Username: username,
        UserPoolId: 'eu-west-2_7lDI3aJAl'
    };
    
    ///Getting a user's data
    return cognitoIdentityServiceProvider.adminGetUser(cognitoParams).promise();
}

//Sets a user's new email to their cognito profile
///username: a user's username
///newEmail: the email the the user wishes to change to
async function setUserEmail(username, newEmail) {
    //Change Email
    ///An object containing all of the necessary parameters to change a user's email. Includes the new email, the user pool ID, and a user's username 
    var cognitoParams = {
        UserAttributes: [{
            Name: "email",
            Value: newEmail
        }],
        Username: username,
        UserPoolId: 'eu-west-2_7lDI3aJAl'
    };
    
    ///Updating the user's email
    return cognitoIdentityServiceProvider.adminUpdateUserAttributes(cognitoParams).promise();
}

//Changing a user's email on the database
///newEmail: the email address that the user wishes to change to
///oldEmail: the email that the user is currently/used to use
async function changeDatabaseEmail (newEmail, oldEmail) {
    //Change Email
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement updates the user's email that corresponds to their currently stored email 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'UPDATE users SET email="' + newEmail + '" WHERE email="' + oldEmail + '";',
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