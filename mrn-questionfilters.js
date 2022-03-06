//Lambda starter - standard call line
exports.handler = async (event) => {
    try {
        //Variables
        ///Name of the index file(s)
        const indexID = "_index.json";

        ///Name of the topics file
        const topicsID = "_topics.json";

        ///Stores the file path to get to the questions. Sent through API
        var filePath = "";

        ///The response object - to be sent back through the api. One object to make the JSON rsponse formatting easier
        var responseObject = {};


        //Getting Filters
        ///If there is an input from the website
        if (event.queryStringParameters) {
            ///Then get the filepath from the system
            filePath = event.queryStringParameters.filePath;

            ///If the API is being called for topics
            if (event.queryStringParameters.topics === "true") {
                ///Get the topics from the current file path
                responseObject.filters = await getFile(filePath + topicsID);
            } else {
                ///If not topics then get the index file from the current file path
                responseObject.filters = await getFile(filePath + indexID);
            }
        } else {
            ///If there are no input parameters then get the index file from the root of the file system
            responseObject.filters = await getFile(indexID);
        }

        //Generates a valid lambda response that the API gateway will accept
        return generateLambdaResponse(responseObject);
    } catch (error) {
        return generateErrorResponse(error.toString());
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///S3 link, subset of AWS, connects function to the object store
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
///S3 bucket name - needed to pull objects from the correct place
const bucketID = "mrn-questiondata";

///Region that the bucket is stored in. Needed to pull object from the correct bucket - updated into the aws config
AWS.config.update({
    region: "eu-west-2",
});

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

//Formats an error into a response that the APi gateway will accept
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