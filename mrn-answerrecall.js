exports.handler = async (event) => {
    //Variables
    ///The indexes of the loaded questions - needed to get the correct answers in the correct order. Parsed through API
    var indexes = event.multiValueQueryStringParameters.indexes;
    ///The location of the question files in the S3 bucket, sent through the API
    var filePath = event.queryStringParameters.filePath;
    ///The response object - to be sent back through the api. One object to make the JSON rsponse formatting easier
    var responseObject = {
        ///The answers that correspond with the ids and the questions
        answers: []
    };
    
    //Get answers
    ///Loads the response object with answers
    responseObject.answers = await getAnswers(indexes, filePath);

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

//Gets the answers from s3
async function getAnswers(indexes, filePath)
{
    //Get answers
    ///Temporary variable to store the recalled answers
    var answers = [];
    
    ///For each index
    for(var i = 0; i < indexes.length; i++)
    {
        ///Get the corresponding question file from s3
        answers.push(await getFile(filePath + indexes[i] + ".json"));
        ///Filter the file down to just the answer
        answers[i] = answers[i].answer;
    }

    return answers;
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
    ///Variable to store the response
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