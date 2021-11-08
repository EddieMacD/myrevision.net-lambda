exports.handler = async (event) => {
    try {
        //Variables
        ///The password that the user wishes to change to
        var newPassword = event.queryStringParameters.newPassword;
        
        ///The user's username
        var username = event.queryStringParameters.username;
        

        //Change Password
        ///Gets changes the password in cognito and stores the response in a response body (just to meet HTTP protocols - a response must be given)
        var responseBody = {};
        responseBody.cognitoData = await setPassword(newPassword, username);

    	return generateLambdaResponse(responseBody);
    } catch(e) {
        return generateFailResponse(e);
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Cognito link - allows manipulation or retrieval of users and their data
const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

//Change a user's password
///newPassword: the password that a user wishes to change their password to
///username: the user's username
async function setPassword(newPassword, username) {
    //Change Password
    ///An object containing all of the necessary parameters to change a user's password. Includes the new password, whether the change is permenant, the user pool ID, and a user's username 
    var cognitoParams = {
       "Password": newPassword,
       "Permanent": true,
       "Username": username,
       "UserPoolId": "eu-west-2_7lDI3aJAl"
    };
    
    return cognitoIdentityServiceProvider.adminSetUserPassword(cognitoParams).promise();
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