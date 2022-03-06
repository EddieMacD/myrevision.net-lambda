exports.handler = async (event) => {
    try {
        //Variables
        ///Extract the relevant data from the query string and place them in variables
        var recieverID = event.queryStringParameters.recieverID;
        var filePath = event.queryStringParameters.filePath;
        var fileName = event.queryStringParameters.fileName;
        var senderUserEmail = event.queryStringParameters.senderUserEmail;

        ///Create variables for the history ID and response body
        var historyID;
        var responseBody = {};

        ///Encapsulate database failure
        try {
            ///Recall the specific ID of question history
            historyID = await getHistoryID(senderUserEmail, filePath, fileName);
        } catch (e) {
            console.log(e);
            throw ("error creating flag");
        }

        ///Send a notification to the target teacher that they have been sent a flag
        responseBody = await sendNotification(historyID, recieverID, filePath, fileName, senderUserEmail);

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
///Link to Lambda - used to call lambda functions
const lambda = new AWS.Lambda({
    region: 'eu-west-2'
});

//Wrapper function for getting the history ID from the database
///email: the email of the user who completed the question
///filePath: the file path of the question that was completed
///fileName: the file name of the question that was completed
async function getHistoryID(email, filePath, fileName) {
    //Get ID
    ///Get the ID from the database and store it in a variable
    var historyID = await recallHistoryID(email, filePath, fileName);

    ///Extract the ID from the returned object and return it
    historyID = historyID.records[0][0].longValue;

    return historyID;
}

//Recalling the ID of the specific instance of question history
///email: the email of the user who completed the question
///filePath: the file path of the question that was completed
///fileName: the file name of the question that was completed
async function recallHistoryID(email, filePath, fileName) {
    //Get History
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement selects the most recent history ID from an entry by a specific user on a specific question
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT question_history_id FROM question_history H INNER JOIN users U ON H.user_id=U.user_id INNER JOIN questions Q on Q.question_id=H.question_id WHERE U.email="' + email + '" AND Q.file_path="'
            + filePath + '" AND Q.file_name="' + fileName + '" ORDER BY H.timestamp DESC LIMIT 1;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Wrapper function for getting the user's ID from the database
///userEmail: the email of the user
async function getUserID(userEmail) {
    //Get ID
    ///Get the ID from the database and store it in a variable
    var userID = await recallUserID(userEmail);

    ///Extract the ID from the returned object and return it
    userID = userID.records[0][0].longValue;

    return userID;
}

//Gets a user's ID from their email address
///userEmail: the email of the user
async function recallUserID(userEmail) {
    //Get ID
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement gets the ID of the active user with a specific email address
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT user_id FROM users WHERE email="' + userEmail + '" AND user_active=1;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Sends a notification to the relevant teacher that a flag was created
///historyID: the ID of this specific instance of question history
///recieverID: the ID of the teacher that the flag was sent to
///filePath: the file path of the relevant question
///fileName: the file name of the relevan question
///senderUserEmail: the email of the user that sent the flag
async function sendNotification(historyID, recieverID, filePath, fileName, senderUserEmail) {
    //Get Details
    ///An object to store the input data - formatted to API standards. Contains all input parameters
    var lambdaPayload = {
        "queryStringParameters": {
            "type": "flag",
            "featureID": historyID,
            "recieverID": recieverID,
            "questionIndex": convertQuestionIndex(filePath, fileName),
            "senderUserEmail": senderUserEmail
        }
    };

    ///An object to store the parameters of the function call - the name of the function and the payload (input, stringified)
    var lambdaParams = {
        FunctionName: 'mrn-notificationcreate',
        Payload: JSON.stringify(lambdaPayload)
    };

    ///Invoking the Lambda function
    return lambda.invoke(lambdaParams).promise();
}

//Converts a generic file name into a subject specific file name - puts three letters in the front for the corresponding file path elements
///filePath: the file path of the relevant question
///fileName: the name of the relevant question 
function convertQuestionIndex(filePath, fileName) {
    //Variables
    ///The output, returned at the end of the function, stores the file index
    var fileIndex = "";

    ///The location of the files in the object store - stores locally to allow manipulation 
    var temp = filePath;

    //Index conversion
    ///For each filter
    for (var i = 0; i < 3; i++) {
        ///Add the first character of the file path to the index
        fileIndex += temp[0];

        ///Removes the front element of the file path and the corresponding slash
        temp = temp.substring(temp.indexOf("/") + 1);
    }

    ///Add the file name to the index
    fileIndex += fileName;

    return fileIndex;
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