exports.handler = async (event) => {
    //Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
    try {
        //Variables
        ///The input parameters from the website
        var params = JSON.parse(event.body);

        ///The user's data once decoded from the parameters into a database friendly form
        var userData = await decodeUserData(params);

        ///The response object
        var responseBody = {};
        

        //Store History
        ///Write a record to the question history table
        if(userData.assignmentID) {
            responseBody = await writeQuestionHistoryAssignment(userData);
        } else {
            responseBody = await writeQuestionHistoryNoAssignment(userData);
        }
    
    	return generateLambdaResponse(responseBody);
    } catch(e) {
        return generateFailResponse("There was an error creating user data");
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();

//Takes in a user's data from the website and decodes it into a form that the database will accept
async function decodeUserData(params) {
    //Data Decoding
    ///An object to store the data once decoded
    var userData = {};

    ///The user's answer, stringified
    userData.userAnswersJSON = JSON.stringify(params.userAnswers);

    ///The amount of time the useer spent on a question
    userData.timestamp = params.timestamp;
    
    ///The ID of the question, retrieved via the file name and the file path
    userData.questionID = await recallQuestionID(params.questionID);
    userData.questionID = userData.questionID.records[0][0].longValue;
    
    ///The ID of the user, retrieved via user's email
    userData.userID = await recallUserID(params.userID.email);
    userData.userID = userData.userID.records[0][0].longValue;
    
    ///If the question was part of an assignment
    if(params.assignmentID) {
        ///Retrieve the ID of the assignment
        userData.assignmentID = params.assignmentID;
    }
    
    return userData;
}

//Gets a question ID based on metadata about the question
///questionData: an object that contains a file name and a file path
async function recallQuestionID (questionData) {
    //Get Question ID
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement gets the question ID that corresponds to the file name and the file path
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT question_id FROM questions WHERE file_name="' + questionData.fileName + '" AND file_path="' + questionData.filePath + '";',
        database: 'mrn_database',
        includeResultMetadata: false
    };   
        
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Gets a user's ID based on their email
///userEmail: the user's email
async function recallUserID (userEmail) {
    //Get User ID
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement gets a user's ID that corresponds to their email 
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT user_id FROM users WHERE email="' + userEmail + '";',
        database: 'mrn_database',
        includeResultMetadata: false
    };   
        
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Writes a question history record for a question that wasn't part of an assignment
///userData: the user's data about the question - to populate all fields except assignment ID
async function writeQuestionHistoryNoAssignment(userData) {
    //Write History
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement inserts a record into the question history table, populating all of the columns EXCEPT assignment ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'INSERT INTO question_history (user_answer_json, timestamp, question_id, user_id) VALUES (' + userData.userAnswersJSON
              + ', "' + userData.timestamp + '", ' + userData.questionID + ', ' + userData.userID + ');',
        database: 'mrn_database',
        includeResultMetadata: false
    };   
    
    console.log(sqlParams.sql);
    
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Writes a question history record for a question that was part of an assignment
///userData: the user's data about the question - to populate all fields
async function writeQuestionHistoryAssignment (userData) {
    //Write History
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluser's ARN, the database's name and the SQL query
    ///The SQL statement inserts a record into the question history table, populating all of the columns
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'INSERT INTO question_history (user_answer_json, timestamp, question_id, user_id, assignment_id) VALUES ("' + userData.userAnswersJSON
              + '", "' + userData.timestamp + '", ' + userData.questionID + ', ' + userData.userID + ', ' + userData.assignmentID + ');',
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