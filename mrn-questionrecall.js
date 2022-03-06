//Lambda starter - standard call line
exports.handler = async (event) => {
    //Error handler
    ///Try catch around everything
    try {
        //Variables
        var params = JSON.parse(event.body);
        ///Stores the number of questions that need to be returned, sent through the API
        var numOfQuestions = parseInt(params.numOfQuestions);
        ///Stores the file path to get to the questions. Sent through API
        var filePath = params.filePath;
        ///Stores the topic(s) that are to be loaded during the 
        var topics = params.topics;
        ///The response object - to be sent back through the api. One object to make the JSON rsponse formatting easier
        var responseObject = {};

        //Loading
        ///Loads the response object with questions and indexes. Awaits the S3 calls
        responseObject.questions = await getQuestions(numOfQuestions, filePath, topics);

        //Generates a valid lambda response that the API gateway will accept
        return generateLambdaResponse(responseObject);
    } catch (error) {
        ///Logs the error before returning it to the user 
        return generateErrorResponse(error);
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///S3 link, subset of AWS, connects function to the object store
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
///S3 bucket name - needed to pull objects from the correct place
const bucketID = "mrn-questiondata";
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();

///Region that the bucket is stored in. Needed to pull object from the correct bucket - updated into the aws config
AWS.config.update({
    region: "eu-west-2",
});

//Sorts out which question to get from s3, then pulls it from the object store
///numOfQuestions: the number of questions that the user has requested
///filePath: the location of the text files in s3
async function getQuestions(numOfQuestions, filePath, topics) {
    //Variables
    ///The type of files that are pulled from S3
    const fileType = ".json";

    ///A response object to store all of the relevant data
    var responseObject = {
        ///Stores the questions
        questions: [],
        ///Stores the indexes
        indexes: []
    };

    ///A concatenated string of all of the topics - in SQL syntax
    var topicLine = concatTopicLine(topics);


    //Get Questions
    ///Gets a list of indexes from the database, before extracting each value from their padding
    responseObject.indexes = await getIndexes(numOfQuestions, filePath, topicLine);
    responseObject.indexes = extractIndexes(responseObject.indexes.records);

    ///For every question that the user wants
    for (var i = 0; i < numOfQuestions; i++) {
        ///Get the question's file
        responseObject.questions.push(await getFile(filePath + responseObject.indexes[i] + fileType));
        ///Filter out the question file until only the question remains
        responseObject.questions[i] = responseObject.questions[i].question;
    }

    return responseObject;
}

//A function that takes in an array of topics and produces a string that can be processed by the database
///topics: an array containing all of the user's selected topics
function concatTopicLine(topics) {
    //Variables
    ///The string to contain the concatenated topic line
    var topicLine = '';


    //Concatenation
    ///An old method that makes no sense in hindsight
    ///Blinded by foreach i guess
    /*
    var first = false

    if(topics.length > 1) {
        topics.forEach((element) => {
            if(first) {
                first = false;
                topicLine += 'topic="' + element + '"';
            } else {
                topicLine += ' OR topic="' + element + '"';
            }
        });
    } else {
        topicLine = 'topic="' + topics[0] + '"';
    }
    */

    ///Add the first topic - no OR
    topicLine = 'topic="' + topics[0] + '"';

    ///For every other item in the array
    for (var i = 1; i < topics.count; i++) {
        ///Add that topic to the line with an or
        topicLine += ' OR topic="' + topics[i] + '"';
    }

    return topicLine;
}

//Gets a set of indexes from a randomised selection, within applied parameters
///numOfQuestion: the number of question that the user wants
///filePath: the location of the files in the S3 file system - what syllabus the question belongs to
///topics: a tring containing all of the available topics concatenated into one string, formatted appropriately for the SQL statement
async function getIndexes(numOfQuestions, filePath, topics) {
    ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
    try {
        //Get Indexes
        ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
        ///The SQL statement gets a list of indexes from the questions table where they belong to the correct syllabus and topic (also within a certain difficulty - for future implementation)
        ///The SQL statement also automatically pulls a random selection limited by the number of questions the user wants
        var sqlParams = {
            secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
            resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
            sql: 'SELECT file_name FROM questions WHERE file_path="' + filePath + '" AND (' + topics + ') AND 2.5 <= difficulty <= 7.5 AND isLive=1  ORDER BY RAND() LIMIT ' + numOfQuestions + ';',
            database: 'mrn_database',
            includeResultMetadata: false
        };

        ///Execute the SQL statement
        return rdsDataService.executeStatement(sqlParams).promise();
    } catch (e) {
        throw ("Error getting question data");
    }
}

//Extract Indexes
///input: the array of indexes, as pulled from the database 
function extractIndexes(input) {
    //Extract Indexes
    ///An array to store the indexes - returned at the end of the function
    var indexes = [];

    ///For each element in the input
    input.forEach((element) => {
        ///Push the actual string value to the new array
        indexes.push(element[0].stringValue);
    })

    return indexes;
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

//Formats a response object into a response that the API gateway will accept
function generateLambdaResponse(responseObject) {
    //Generate response
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

//Formats a response object into a response that the API gateway will accept
function generateErrorResponse(error) {
    //Generate response
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