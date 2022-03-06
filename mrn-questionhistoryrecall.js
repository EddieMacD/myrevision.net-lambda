exports.handler = async (event) => {
    try {
        var responseBody = {};

        //Recall History
        ///Encapsulated database failure
        try {
            ///If there is a given history ID
            if (event.queryStringParameters.historyID) {
                ///Get the history ID from the query string parameters and use it to get the history data
                var historyID = parseInt(event.queryStringParameters.historyID);
                responseBody.historyData = await getHistory(historyID);
            } else {
                ///If not leave the object blank and set the question ID to the value in the query string parameters
                responseBody.historyData = {};
                responseBody.historyData.questionID = parseInt(event.queryStringParameters.questionID)
            }

            ///Recall data about the question file from the database
            responseBody.fileData = await getFileData(responseBody.historyData.questionID);

            ///Recall the question file data from the file store
            responseBody.questionData = await getFile(responseBody.fileData.filePath + responseBody.fileData.fileName + ".json");
        } catch (e) {
            console.log(e);
            throw ("Error getting question data");
        }

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
///S3 link, subset of AWS, connects function to the object store
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
///S3 bucket name - needed to pull objects from the correct place
const bucketID = "mrn-questiondata";

///Region that the bucket is stored in. Needed to pull object from the correct bucket - updated into the aws config
AWS.config.update({
    region: "eu-west-2",
});

//Wrapper function for recalling data about an instance of question history
///historyID: the ID of the specific intance of question history
async function getHistory(historyID) {
    //Get Details
    ///Recalls the history data from the database
    var data = await recallHistory(historyID);

    ///Puts the user's answer, the question ID, and the time spent
    var historyData = {};
    historyData.userAnswer = JSON.parse(data.records[0][0].stringValue);
    historyData.questionID = data.records[0][1].longValue;
    historyData.timeSpent = data.records[0][2].longValue;

    return historyData;
}

//Recall data about an instance of question history from the database
///historyID: the ID of the specific intance of question history
async function recallHistory(historyID) {
    //Get Names
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL query selects the user's answer, the question ID, and the time spent on the question for a record with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT user_answer_json, question_id, time_spent FROM question_history WHERE question_history_id=' + historyID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Wrapper function for recalling the file name and path about a question file
///questionID: the ID of the question in the database
async function getFileData(questionID) {
    //Get Data
    ///Gets the data from the database
    var data = await recallFileData(questionID);

    ///Extracts the file name and path from the object and returns it 
    var fileData = {};
    fileData.fileName = data.records[0][0].stringValue;
    fileData.filePath = data.records[0][1].stringValue;

    return fileData;
}

//Recalls the file name and path from the database
///questionID: the ID of the question in the database
async function recallFileData(questionID) {
    //Get Data
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement recalls the file name and path from a question with a specific ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT file_name, file_path FROM questions WHERE question_id=' + questionID + ';',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Gets the specified file from S3
///fileName: the name of the file to be pulled from S3
async function getFile(fileName) {
    ///For testing
    //console.log("get file: " + fileName);

    //S3 call parameters
    ///Stored in an object to be parsed correctly 
    const params = {
        ///The name of the bucket that the file is being pulled from
        Bucket: bucketID,
        ///The the file path and the name of the file that is being pulled
        Key: fileName
    };

    //S3 pull
    ///Variable to store the response
    var data = {};

    ///Put the body of the s3 request in a constant
    const { Body } = await s3.getObject(params).promise();
    ///Convert the response into an object and store that in a varaible to reurn
    data = JSON.parse(Body.toString());
    ///For testing
    //console.log("Body: " + JSON.stringify(data));

    return data;
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