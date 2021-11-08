exports.handler = async (event) => {
    try {
        //Sender Data
        ///An object to store the input data
        var params = JSON.parse(event.body);

        ///The sender's username - used to verify they are allowed to create a user
        var senderUser = params.senderUsername;
        
        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);
        
        ///The sender user's school name
        var senderSchool = await getUserSchool(senderUserData.email);
        senderSchool = JSON.parse(JSON.parse(senderSchool.Payload).body).school;
        

        //Sender Validation
        ///If the sender is a teacher or an admin then let them create a useer
        if (senderUserData.accessLevel == "teacher" || senderUserData.accessLevel == "admin")
        {
            //New User Data
            ///Transferring the parameters into a new object.
            var newUserData = {};
            newUserData.email = params.email;
            newUserData.school = params.school;
            newUserData.firstName = params.firstName;
            newUserData.lastName = params.lastName;
            newUserData.DOB = params.DOB;
            newUserData.accessLevel = params.accessLevel;
            

            //New User Validation
            if (senderUserData.accessLevel == "teacher" && newUserData.school != senderSchool) {
                ///If the user is a teacher and creating for a different school then throw an exception
                throw("You are not authorised to use this feature on another school.");
            } else if (!(/([\d\w!#$%&'*+-/=?^`{|}~]+\.?[\d\w!#$%&'*+-/=?^`{|}~]+)+@([\d\w]+-?[\d\w]+)+\.\w{2,6}/.test(newUserData.email)) || newUserData.email.length > 320) {
                ///A RegEx test for an email, makes sure that it is valid for the database
                throw("You cannot create a user with this information. Invalid email address");
            } else if (newUserData.firstName.length < 1 || newUserData.firstName.length > 64) {
                ///A check to see if the first name is valid for the database
                throw("You cannot create a user with this information. Invalid first name");
            } else if (newUserData.lastName.length < 1 || newUserData.lastName.length > 128) {
                ///A check to see if the last name is valid for the database
                throw("You cannot create a user with this information. Invalid last name");
            } else if (!(/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/.test(newUserData.DOB))) {
                ///A regex test of the date of birth, making sure that it is valid for the database
                throw("You cannot create a user with this information. Invalid date of birth");
            } else if (newUserData.accessLevel != "student" && newUserData.accessLevel != "teacher") {
                ///Guaranteeing that the user is being created with a valid access level - e.g. not an admin
                throw("You cannot create a user with this information. Invalid user type");
            }
            

            //Creating New User
            ///A response body to return due to API standards
            var responseBody = {};

            ///Creating the user in cognito
            responseBody.cognitoData = await setCognitoUser(newUserData.email);
    
            ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
            try {
                ///Getting the ID of the school that the user is being inserted into
                newUserData.school = await recallSchoolID(newUserData.school);
                newUserData.school = newUserData.school.records[0][0].longValue;
    
                ///Creating the new user in the database
                var dbData = await insertUserIntoDatabase(newUserData);
            } catch (e) {
                throw("Error creating user data. Please try again");
            }
        } else {
            throw("You are not authorised to use this feature");
        }

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
    
    return lambda.invoke(lambdaParams).promise();
}

//Creates a user inside the cognito environment
///userEmail: the email of the user that is being created
async function setCognitoUser (userEmail) {
    //Create User
    ///The parameters involved in creating a user - the user pool id, the new username (email in this instance), a temporary password, a few attributes and how to contact the user (email)
    var cognitoParams = {
        UserPoolId: 'eu-west-2_7lDI3aJAl',
        Username: userEmail,
        TemporaryPassword: generatePassword(),
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
            { 
                    Name: "email",
                    Value: userEmail
            },
            {
                    Name: 'email_verified',
                    Value: 'true'
            },
        ]
    };
    
    ///Create the user
    return cognitoIdentityServiceProvider.adminCreateUser(cognitoParams).promise();
} 

//Generates a random password that satisfies the password requirement
function generatePassword() {
    //Variables
    ///The character sets - upper case letters; lower case letters; numbers; and some symbols. Used as the base of the password generator
    const lowerCaseSet = "abcdefghijklmnopqrstuvwxyz";
    const upperCaseSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numberSet = "0123456789";
    const symbolSet = "$*[]{}()?!@#%_~";
    
    ///A variable to store the auto-password
    var output = "";
    

    //Password Generation
    ///Generates a fixed length password - currently 10 characters
    for(var i = 0; i < 2; i++) {
        ///Contains a ratio of 1 upper case; 2 lower case; 1 number; and 1 symbol
        output += randomChar(upperCaseSet);
        output += randomChar(lowerCaseSet);
        output += randomChar(symbolSet);
        output += randomChar(lowerCaseSet);
        output += randomChar(numberSet);
    }

    return output.shuffle();
}

//Returns a random character from a set
///charSet: a set of characters
function randomChar(charSet) {
    //Randomise Character
    ///A JS way of getting a random integer, since Math.random() returns only a decimal between 1 and 0
    var random = Math.floor(Math.random() * charSet.length);
    
    ///Returning the corresponding character to the random number
    return charSet[random];
}

//Adding a method to the String class - imported, shuffles a string up into it's corresponding parts
String.prototype.shuffle = function () {
    var a = this.split("");
    var n = a.length;

    for(var i = n - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    
    return a.join("");
}

//Gets a school's ID based on it's name
///userSchool: the name of the school that the user is inserting into
async function recallSchoolID (userSchool) {
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT school_id FROM schools WHERE name="' + userSchool + '"',
        database: 'mrn_database',
        includeResultMetadata: false
    };   
    
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Takes in a user's data and adds the corresponding record to the database
///userData: an object containing a user's data
async function insertUserIntoDatabase (userData) {
    //Create User
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement inserts a user's data into the user's table
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'INSERT INTO users (email, first_name, last_name, access_level, school_id, dob) VALUES ("' + userData.email + '", "' 
            + userData.firstName + '", "' + userData.lastName + '", "' + userData.accessLevel + '", ' + userData.school + ', "' + userData.DOB + '");',
        database: 'mrn_database',
        includeResultMetadata: false
    };
    
    ///Running the SQL command
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