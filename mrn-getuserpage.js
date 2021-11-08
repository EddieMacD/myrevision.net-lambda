exports.handler = async (event) => {
    try {
        //Variables
        ///The school that the data is beinf queried from
        var school = event.queryStringParameters.school;

        ///The number of users that were on previous pages
        var offset = parseInt(event.queryStringParameters.offset);

        ///The amount of users to be stored on the current page
        var amount = parseInt(event.queryStringParameters.amount);
        
        ///Validating amount - making sure that you can't overload the API
        ///Also validates the offset, but since it would be a programatic error it just sets to zero as opposed to throwing an error
        if(amount > 50) {
            throw("Invalid page size");
        } else if (offset < 0) {
            offset = 0;
        }
        
        ///The response body to store the user pages
        var responseBody = {};


        //Get User Page
        ///Encapsulated database failure and basic error message to prevent database's existance from being public. Helps prevent SQL injection
        try {
            ///Gets a set of users from the database and extract the records
            responseBody.userPage = await getUserPage(school, offset, amount);
            responseBody.userPage = responseBody.userPage.records;
            
            ///Also gets the number of total users in the current school, extracting the value
            responseBody.count = await getSchoolCount(school);
            responseBody.count = responseBody.count.records[0][0].longValue;
        } catch (e) {
            throw("Error getting users")
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

//Gets a page of users from the database
///school: what school to get the page from
///offset: how many users have gone before this page
///amount: how many users are on the current page
async function getUserPage (school, offset , amount) {
    //Get User Page
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement gets a several user's information, depending on the inputted amount and how many were before, where the school is the same as what was inputted
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT U.first_name, U.last_name, U.email, U.dob, U.access_level FROM users U INNER JOIN schools S ON U.school_id = S.school_id WHERE S.name="' + school + '" AND U.access_level <> "admin" ORDER BY U.access_level DESC, U.first_name, U.last_name ASC LIMIT ' + offset + ', ' + amount + ' ;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Performing the SQL query
    return rdsDataService.executeStatement(sqlParams).promise();
}

//Counts the number of users in a school and returns a value
///school: the school to have it's user's counted
async function getSchoolCount (school) {
    //Get School Count
    ///An object containing all of the necessary parameters to query the database. Includes credentials, the database cluster's ARN, the database's name and the SQL query
    ///The SQL statement counts all of the users in an inputted school, grouped by the school ID
    var sqlParams = {
        secretArn: 'arn:aws:secretsmanager:eu-west-2:293120934689:secret:rds-db-credentials/cluster-V4YUHCBNOQZWAQNYBYOORBOKP4/admin-hQLZYp',
        resourceArn: 'arn:aws:rds:eu-west-2:293120934689:cluster:mrn-database-cluster',
        sql: 'SELECT COUNT(*) FROM users U INNER JOIN schools S ON U.school_id = S.school_id  WHERE S.name="' + school + '" AND U.access_level <> "admin" GROUP BY S.school_id;',
        database: 'mrn_database',
        includeResultMetadata: false
    };

    ///Calling the SQL statement
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