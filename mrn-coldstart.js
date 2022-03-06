exports.handler = async (event, context) => {
    //Timer
    ///An imported timemout method - if the inputted promise resolves in the allotted time then continue as normal, if the promise does not resolve then throw an error
    const timeout = (promise, time, exception) => {
        let timer;
        return Promise.race([
            promise,
            new Promise((resolve, reject) => timer = setTimeout(reject, time, exception))
        ]).finally(() => clearTimeout(timer));
    };


    //Variables
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement gets the user ID of the user with ID 1 - a useless statement with low effort, only for a single ping
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT user_id FROM users where user_id=1;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///A string for a timeout error - used to control the error of a timeout
    const timeoutError = "timeout error";


    //Ping Database
    try {
        ///Calls the timout method, put in a constant since javascript is weird
        const item = await timeout(
            (async () => {
                ///Run SQL command - ping database
                var dbData = await rdsDataService.executeStatement(sqlParams).promise();
                ///For testing only
                //console.log(JSON.stringify(dbData));
            })(),
            ///Amount of time left in the function minus a second - allows timout method to fail before the function auto times out
            context.getRemainingTimeInMillis() - 1000,
            ///The timeout error string to be thrown
            timeoutError
        );

        ///If the function was successful then return true
        return generateLambdaResponse(true);
    } catch (e) {
        //Error handling
        ///If the timeout did not occur then
        if (e !== timeoutError) {
            ///Throw a standard lambda fail
            return generateFailResponse(e);
        }
        else {
            ///Return a SUCCESS - but with a false as the return object
            ///The method still worked in waking up the database - just that it wasnt currently awake
            return generateLambdaResponse(false);
        }
    }
};

//Global constants
///AWS link
const AWS = require('aws-sdk');
///Database link - allows for SQL querying
const rdsDataService = new AWS.RDSDataService();

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