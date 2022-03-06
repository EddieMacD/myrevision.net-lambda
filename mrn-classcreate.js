exports.handler = async (event) => {
    try {
        //Data Extraction
        ///Puts the class name and subject in an object
        var classData = {};
        classData.className = event.queryStringParameters.className;
        classData.classSubject = event.queryStringParameters.classSubject;

        ///The sender's username - used to verify they are allowed to create a class
        var senderUser = event.queryStringParameters.senderUsername;

        ///Getting the sender user's details (access level and email)
        var senderUserData = await getUserDetails(senderUser, "");
        senderUserData = JSON.parse(JSON.parse(senderUserData.Payload).body);

        ///The ID of the target school
        var targetSchool = 0;

        try {
            ///If the user is an admin
            if (senderUserData.accessLevel == "admin") {
                targetSchool = event.queryStringParameters.targetSchool;
                targetSchool = await getOtherSchool(targetSchool);
                targetSchool = targetSchool.records[0][0].longValue;
            } else {
                ///If the user is a teacher get the sender user's school name
                var senderSchool = await getUserSchool(senderUserData.email);
                senderSchool = JSON.parse(JSON.parse(senderSchool.Payload).body).school;

                ///The school of the class - the school that the user being added to the class should be from
                var targetSchool = await getSchoolOfClass(classID);
                targetSchool = targetSchool.records[0][0].stringValue;
            }
        } catch (e) {
            throw ("There was an error getting data to create the class.");
        }


        //Sender Validation
        ///If the sender is a teacher or an admin then let them create a useer
        if (senderUserData.accessLevel == "teacher" || senderUserData.accessLevel == "admin") {
            if (senderUserData.accessLevel == "teacher" && targetSchool != senderSchool) {
                ///If the user is a teacher and creating for a different school then throw an exception
                throw ("You are not authorised to use this feature on another school.");
            }


            //Create Class
            ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
            try {
                ///Create a class on the database
                var dbData = await createClass(classData.className, classData.classSubject, targetSchool);
            } catch (e) {
                throw ("Error creating class");
            }
        } else {
            throw ("You are not authorised to perform this action");
        }

        var responseBody = {};

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

//Gets a user's school name and ID
///email: the email to be used to get the user's school
async function getUserSchool(email) {
    //Get School
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement gets the school name and ID that corresponds to the user's email 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT S.name, S.school_id FROM users U INNER JOIN schools S ON U.school_id = S.school_id WHERE U.email = "' + email + '";',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Gets the name of the school that a class belongs to
///classID: the class that belongs to the school
async function getSchoolOfClass(classID) {
    //Get School
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL query selects the school name for a specific class ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT S.name FROM schools S INNER JOIN classes C ON S.school_id = C.school_id WHERE C.class_id=' + classID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Create a class on the database
///className: the name of the class
///classSubject: the subject that the class is for
///targetSchool: the ID of the school that the class is being created for
async function createClass(className, classSubject, targetSchool) {
    //Create User
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement inserts a user's data into the user's table
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'INSERT INTO classes (name, subject, school_id) VALUES ("' + className + '", "' + classSubject + '", "' + targetSchool + '");',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Running the SQL command
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