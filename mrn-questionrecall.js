//Lambda starter - standard call line
exports.handler = async (event) => {
    //Variables
    ///Stores the number of questions that need to be returned, sent through the API
    var numOfQuestions = parseInt(event.queryStringParameters.numOfQuestions);
    ///Stores the file path to get to the questions. Sent through API
    var filePath = event.queryStringParameters.filePath;
    ///Stores the topic(s) that are to be loaded during the 
    var topics = event.multiQueryStringParameters.topics;
    ///The response object - to be sent back through the api. One object to make the JSON rsponse formatting easier
    var responseObject = {};
    
    //Loading
    ///Loads the response object with questions and indexes. Awaits the S3 calls
    responseObject.questions = await getQuestions(numOfQuestions, filePath, topics);

    //Generates a valid lambda response that the API gateway will accept
    return generateLambdaResponse(responseObject);
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///S3 link, subset of AWS, connects function to the object store
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
///S3 bucket name - needed to pull objects from the correct place
const bucketID = "mrn-questiondata";
///Name of the index file(s)
const indexID = "_index.json";

///Region that the bucket is stored in. Needed to pull object from the correct bucket - updated into the aws config
AWS.config.update({
  region: "eu-west-2",
});

//Sorts out which question to get from s3, then pulls it from the object store
///numOfQuestions: the number of questions that the user has requested
///filePath: the location of the text files in s3
async function getQuestions(numOfQuestions, filePath, topics){
    //Variables
    var responseObject = {
        ///Stores the questions
        questions: [],
        ///Stores the indexes
        indexes: []
    };
    
    ///The index file from the folder that the questions are to be pulled from
    var index = await getFile(filePath + indexID);

    ///For testing
    //console.log("count: " + index.count);

    //Randomised question logic
    ///Loops through the same amount of times that questions are asked for
    for(var i = 0; i < numOfQuestions; i++)
    {
        var currentTopic = Math.floor(Math.random() * topics.length);

        ///Boolean variable for do while control
        var validNum = false;
        ///Temp variable for the file that is to be looked up for the question
        var fileName;

        ///Loops through until a valid file is found
        do {
            ///Generates a random number between 0 and the max value in the index file
            var n = Math.floor(Math.random() * index[topics[currentTopic]].count);
            ///Looks up the random number and returns the file name stored in the index file
            fileName = index[topics[currentTopic]].questions[n].q;
            
            ///If the random file name hasn't been used yet
            if(!responseObject.indexes.includes(fileName)) {
                ///Then the number is valid/exit the loop this iteration
                validNum = true;
                ///Add the file name to the indexes array
                responseObject.indexes.push(fileName);
                ///Format the temporary variable into a json file name, ready for pulling the file
                fileName += ".json";
            }
            else {
                ///Otherwise the file name isn't valid as it is a repeat
                validNum = false;
            }
        } while (!validNum);
        
        ///For testing
        //console.log(fileName);
        
        ///Get the question file
        responseObject.questions.push(await getFile(filePath + fileName));
        ///Filter out the question file until only the question remains
        responseObject.questions[i] = responseObject.questions[i].question;
    }

    return responseObject;
}

//Gets the specified file from S3
///fileName: the name of the file to be pulled from S3
async function getFile (fileName){
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
    ///Varianle to store the response
    var data = {};
    
    ///In a try catch to handle errors
    try{
        ///Put the body of the s3 request in a constant
        const { Body } = await s3.getObject(params).promise();
        ///Convert the response into an object and store that in a varaible to reurn
        data = JSON.parse(Body.toString());
        ///For testing
        //console.log("Body: " + JSON.stringify(data));
    }
    catch (err) {
        ///Log the error if there is one
        console.log(err);
    }
    
    return data;
}

//Formats a response object into a response that the APi gateway will accept
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