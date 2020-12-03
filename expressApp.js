
//use express module
var express = require("express");

//create an app
var app = express();

//set app port to listen to
app.set('port', process.env.PORT || 2468);
 
//set up middleware
app.use( express.static(__dirname + "/public") );


//-------------------------------------------
//SESSION COOKIES SET UP

//use cookie parser module for handling cookies
var cookieParser = require('cookie-parser');
app.use(cookieParser());

//use session cookies module
var session = require('express-session');

//create session cookie
app.use( session({
    name: 'moto_session_cookie',
    secret: 'we all love coe457',
    resave: true,            //given: have to do with saving session under various conditions
    saveUninitialized: true, //given: just leave them as is
    cookie: {
        maxAge: (1000 * 60 * 60 * 24 * 30)       //cookie should expire after 30 days
    }
})); 

//-------------------------------------------
//MONGODB DATABASE SET UP

//use mongoose module
const mongoose = require('mongoose');
const { Double } = require("bson");

//connect to 'motoUser' database
mongoose.connect('mongodb://localhost:27017/motoUsers', {useNewUrlParser: true, useUnifiedTopology: true});

//create a schema first for User Information
const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    password: String
})

//create a collection called User with the userSchema
const UserCollection = mongoose.model("User", userSchema);


//------------------------
//TO KEEP RECORD OF USER ROUTES
//create a schema for Route Information
const routeSchema = new mongoose.Schema({
    email: String,
    startingLocation: {lat: Number, long: Number},
    destinationLocation: {lat: Number, long: Number}
}); 

//create a collection called Route with the routeSchema
const RouteCollection = mongoose.model("Route", routeSchema);

//-------------------------------------------
//respond to requests

//---------------------
app.get('/', function(req, res)
{
    console.log("\nGET request received for '/'.");
    returnContent = "<html> <body> <h3>Connected to Server successfully.</h3>";
    returnContent += " <p>Try accessing <a href='http://localhost:2468/moto_login_HTML.html'>http://localhost:2468/moto_login_HTML.html</a> to get to the Moto Login Page.</p>";
    returnContent += " </body></html>";
    res.send(returnContent);
});


//---------------------
//called to validate existing login credentials
app.get('/checkLoginCredentials', function(req, res) {
    console.log("\nGET request received for '/checkLoginCredentials'.");
    //check if email and password from login form exist in user DB
    UserCollection.findOne({email: req.query.loginEmail, password: req.query.loginPassword}, function(err, userFound) { 
        if(err) //error checking db
        {
            console.log("Error reading users.");
            res.send("DB Error");
        } 
        else //db checked correctly
        {
            //if returned result was empty, then user login is not valid
            if (!userFound)    //DB query result was empty
            {
                console.log("Login credentials sent were invalid.");
                res.send("Invalid login credentials");
            }
            else    //successful login - login credentials match a record in DB
            {
                console.log("Login credentials sent were valid for user:", userFound.name);
                res.send("Valid login credentials");
            }
        }
    });
    
});


//---------------------
//called to log user into the session (executes after validation or on reaccessing the application with 'Remember Me' checked)
app.get('/logUserIn', function(req, res) {
    console.log("\nGET request received for '/logUserIn'.");
    //data received in query: {loginEmail, loginPassword, rememberMe, cookiesAccepted}

    //check if this is user's first time logging into the session (if session email has been set)
    if (!req.session.email)     //not yet set -> user's not logged in from before
    {
        //set user email in session cookie (strictly necessary cookie)
        req.session.email = req.query.loginEmail;

        //store user's 'Remember Me' status preference
        req.session.rememberUser = req.query.rememberMe;    /*can be set without accepting cookies*/

        //check if user accepted cookies
        if (req.query.cookiesAccepted == 'true')  //user accepted to use extra cookies -> save additional user info to session cookie
        {
            
            //store indicator that this is user's first time logging in
            req.session.firstTimeLogin = true;

            //retrieve user's name from database
            UserCollection.findOne({email: req.query.loginEmail}, function(err, userFound) { 
                if(err) //error checking db
                {
                    console.log("Error reading user name from DB.");
                }
                else //db checked correctly [email already validated by this point so a user should always be returned]
                {   
                    if (!userFound)
                    {
                        console.log("ERROR - Could not find user in DB.");
                        res.status(400).send(new Error('Error with finding user in Database.'));    //unlikely to happen
                    }
                    else
                    {
                        console.log("User's Name found. Name:", userFound.name);
                        req.session.userName = userFound.name;
                        console.log("New session-saved userName:", req.session.userName);
                        res.send("Successsful Login");
                    }
                }     
            });
        }
        else    //cookies not accepted
        {
            //submit with only email
            console.log("User '" + req.session.email + "' has been logged in.");
            res.send("Successsful Login");
        }
    }
    else    //else: session email has been set -> user already logged in before
    {
        //all session variables needed have already been set

        //update 'firstTimeLogin' IF it exists ('firstTimeLogin' variable will not exist if cookies were not permitted by user)
        if (req.session.firstTimeLogin)
        {
            req.session.firstTimeLogin = false;
        }

        console.log("User '" + req.session.email + "' has been logged in.");
        res.send("Successful Login");   
    }
});

//---------------------
//called to validate new email before registering user (to ensure email does not already exist in system)
app.get('/checkUniqueSignupEmail', function(req, res) {
    console.log("\nGET request received for '/checkUniqueSignupEmail'.");
    
    //check if email already exists in DB
    UserCollection.findOne({email: req.query.signupEmail}, function(err, userFoundForEmail) { 
        if(err) //error checking db
        {
            console.log("Error checking sign up email from DB.");
            res.send("DB error");
        }
        else //db checked correctly
        {
            if (userFoundForEmail)  //email already exists in DB -> cannot be used for new registration
            {
                console.log("Email already existed in database - Invalid for new user registration.");
                res.send("Existing email");
            }
            else    //DB query returned empty -> email is unique and not yet registered
            {
                console.log("Email did not exist in database - Valid for new user registration.");
                res.send("Valid email");
            }
        }
    });

});


//---------------------
//called to register a new user into the MotoUser Database
app.get('/registerNewUser', function(req, res) {
    console.log("\nGET request received for '/registerNewUser'.");
    
    //add user - create a document (instance on db collection)
    var newUser = new UserCollection({
        email: req.query.email,
        name: req.query.name,
        password: req.query.password
    })
    // save the record in the db
    newUser.save();
    console.log("New user added to DB for", req.query.email);

    res.send("Success");
});


//---------------------
//called to retrieve session details when displaying pages (for redirected login, denial of access, etc.)
app.get('/getSessionDetails', function(req, res) {
    console.log("\nGET request received for '/getSessionDetails'.");
    
    var fullSessionDetails = {};

    //set details object based on the available cookie values (depends on if cookies were accepted by user)
    if (req.session.userName)   //if exists, then cookies were accepted and all session variables are available
    {    fullSessionDetails = {
            email: req.session.email,
            userName: req.session.userName,
            rememberUser: req.session.rememberUser,
            firstTimeLogin: req.session.firstTimeLogin,
            lastTimeVisited: req.session.lastTimeVisited    /*last time visited is set from previous call to this function*/
        };

        //set user's 'lastAccessed' time to the current time this function was called (to be used as 'last accessed time' for next call)
        req.session.lastTimeVisited = (new Date()).toLocaleString();    //current date and time in formatted string

        //update 'firstTimeLogin' if currently false (since any future call will not be the first time anymore)
        if (req.session.firstTimeLogin == true)
        {    req.session.firstTimeLogin = false;   }
    
    }
    else    //user's name is not stored in session
    {
        //check if email is stored in session (-> user is logged in but did not accept extra cookies)
        if (req.session.email)
        {
            fullSessionDetails = { 
                email: req.session.email,
                rememberUser: req.session.rememberUser  /*can be set without accepting cookies*/
            };
        }
        //else: if email not stored, then that means there is no user currently logged in -> return empty session details (as declared)
    }

    //return session details
    console.log("Session Details sent: ", fullSessionDetails);
    res.send(fullSessionDetails);

});

//---------------------
app.get('/saveNewLocationCoordinates', function(req, res) {
    console.log("\nGET request received for '/saveNewLocationCoordinates'.");

    //retrieve start and destination coordinates from request query
    console.log("Request Query:", req.query);
    console.log("LoggedInUser:", req.session.email);

    //add new route record - create a document (instance on db collection)
    var newRouteRecord = new RouteCollection({
        email: req.session.email,
        startingLocation: {lat: req.query.startingCoordinates.lat, long: req.query.startingCoordinates.lng},
        destinationLocation: {lat: req.query.destinationCoordinates.lat, long: req.query.destinationCoordinates.lng}
    });
    //save record in db
    newRouteRecord.save().then(() => {
        console.log('New User Route has been saved to Database.');
        res.send("Successful Route save.");
    });
});


//---------------------
app.get('/logUserOut', function(req, res) {
    console.log("\nGET request received for '/logUserOut'.");

    //clear cookie
    res.clearCookie("moto_session_cookie");

    //delete session
    req.session = null;
    //req.session.destroy();

    console.log("Session has been deleted and cookies have been cleared.");
    res.send("Session Deleted");
});


//-------------------------------------------
//-------------------------------------------

//launch the server
app.listen( app.get('port'), function() {
    console.log("\nExpress started on http://localhost:" + app.get('port') + "; press Ctrl-C to terminate.\n");
} )
