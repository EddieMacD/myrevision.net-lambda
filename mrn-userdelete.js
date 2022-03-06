exports.handler = async (event) => {
    try {
        //Variables
        ///The school of the sender
        var senderSchool = event.queryStringParameters.school;

        ///The username of the sender
        var senderUser = event.queryStringParameters.senderUsername;

        ///An object to store information about the user that is to be deleted
        var deletedUser = {};

        ///The email of the user that is to be deleted
        deletedUser.email = event.queryStringParameters.deletedEmail;

        ///Getting the username of the user that is to be deleted and storeing it in the deleted user object
        var cognitoData = await getCognitoUsername(deletedUser.email);
        deletedUser.username = cognitoData.Users[0].Username;

        ///Getting data about the sender (email and access level) and storing it in a new sender user object
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///Getting the school of the sender user and storing it in a new variable        
        var userSchool = await getUserSchool(senderUserData.email);
        userSchool = JSON.parse(JSON.parse(userSchool.Payload).body).school;


        //Validation
        ///If the user is authorised to perform this action (a teacher or student)
        if (senderUserData.accessLevel == "teacher" || senderUserData.accessLevel == "admin") {
            if (senderUserData.accessLevel == "teacher" && senderSchool != userSchool) {
                ///If the user is a teacher and deleting from a different school throw an error
                throw ("You are not authorised to use this feature on another school.");
            } else if (!(/([\d\w!#$%&'*+-/=?^`{|}~]+\.?[\d\w!#$%&'*+-/=?^`{|}~]+)+@([\d\w]+-?[\d\w]+)+\.\w{2,6}/.test(deletedUser.email)) || deletedUser.email.length > 320) {
                ///Validating the email address to make sure that it could be in the database
                throw ("You can not delete a user with this information. Invalid email address");
            }


            //Deleting User
            ///An object to store the response and to be passed back to the site, to conform with API standards
            var responseBody = {};

            ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
            try {
                ///Delete the user from the database
                var dbData = await deleteUserFromDatabase(deletedUser.email);
            } catch (e) {
                throw ("Error deleting user from the user data");
            }

            ///Delete the user from cognito
            responseBody.cognitoData = await deleteCognitoUser(deletedUser.username);
        } else {
            throw ("You are not authorised to use this feature");
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
///Cognito link - allows manipulation or retrieval of users and their data
const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
///Link to Lambda - used to call lambda functions
const lambda = new AWS.Lambda({
    region: 'eu-west-2'
});

//Gets a user's username from cognito
///email: a user's email address - used to get the username
async function getCognitoUsername(email) {
    //Get Username
    ///An object containing the necessary parameters to get a user's username - the pool ID, the number of users to get and the filter (email)
    var cognitoParams = {
        //"AttributesToGet": [ "Username" ],
        "Filter": "email=\"" + email + "\"",
        "Limit": 1,
        "UserPoolId": "eu-west-2_7lDI3aJAl"
    };

    ///Get the required users
    return cognitoIdentityServiceProvider.listUsers(cognitoParams).promise();
}

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

//Gets a user's school from the preexisting Lambda function
///email: the email to be used to get the user's school
async function getUserSchool(email) {
    //Get School
    ///An object to store the input data - formatted to API standards. Contains the user's email
    var lambdaPayload = {
        "queryStringParameters": {
            "email": email
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-userschoolrecall',
        Payload: JSON.stringify(lambdaPayload)
    };

    ///Invoking the Lambda function
    return lambda.invoke(lambdaParams).promise();
}

//Deletes a user from the cognito system
///username: the username of the user that is to be deleted
async function deleteCognitoUser(username) {
    //Delete User
    ///An object containing the required information to delete a user - the username and the user pool ID
    var cognitoParams = {
        UserPoolId: 'eu-west-2_7lDI3aJAl',
        Username: username,
    };

    ///Delete the user
    return cognitoIdentityServiceProvider.adminDeleteUser(cognitoParams).promise();
}

//Deletes a user from the database
///email: the user's email address
async function deleteUserFromDatabase(email) {
    //Delete User
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement deletes users based on the email address
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'UPDATE users SET user_active=0 WHERE email="' + email + '"',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Executes the SQL statement
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