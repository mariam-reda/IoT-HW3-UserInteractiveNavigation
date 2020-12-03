//create initial variable for cookie usage (set based on user's consent)
var cookieUsage = false;    //default extra cookie use is 'false' (in case user does not interact with cookie bar before submitting form)


//--------------------------------
//check session details to see if there is already a user currently logged in (- should not be accessing this page if they are)
function checkSessionDetails() {
    $.get("/getSessionDetails"
        /*no data to be passed*/
    ).done(function(data) {                 //success callback function
        var currentSessionData = data;
        //console.log("SessionDetails Response:", currentSessionData);
        
        //check if there is a currently-logged in user
        if (jQuery.isEmptyObject(currentSessionData))
        {
            console.log("Session is confirmed as empty - No logged in user yet.");
        }
        else //call returned some session info -> a user is currently logged in -> redirect to map page
        {
            console.log("Session indicates a user is logged in - redirecting to Map.");
            alert("Signup Page should not be accessed when user is already logged in. \nRedirecting to Moto Map Page...");
            window.location.replace('/moto_map_HTML.html');  
        }
        
    }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
        alert("Error. Could not connect to server.\n" + ex);
    });
}

//--------------------------------
//Handle accept/decline of cookie usage
function acceptCookies() 
{
    cookieUsage = true;
    console.log("Cookie Usage has been ACCEPTED.");
    hideCookieBar();
}

function declineCookies() 
{
    cookieUsage = false;
    console.log("Cookie Usage has been DECLINED.");
    hideCookieBar();
}

function hideCookieBar() 
{
    $("#cookieConsentBar").fadeOut();
}

//---------------------------------
//SignUp validation - check the credentials for a NEW user (to make sure they are unique before registering user in system)
function checkSignupCredentials() 
{
    console.log("Signup button clicked");
    $("#invalidCredentialsMessage").hide();

    if ( ($("#userName").val() != "") && ($("#signupEmail").val() != "") && ($("#signupPassword").val() != "") )
    {
        //check new Email credentials with server to make sure they do not already exist in database 
        $.get("/checkUniqueSignupEmail",     
            { signupEmail: $("#signupEmail").val() },
        
        ).done(function(data) {                 //success callback function
            console.log("Response:", data);
            
            switch(data)
            {
                case "DB Error":
                    alert("Error. Could not connect to Database to check credentials.");
                    break;
                case "Existing email":
                    // alert("Credentials invalid.");
                    $("#invalidCredentialsMessage").text("The email entered is already registered in the system. Please enter a new email.");
                    $("#invalidCredentialsMessage").show();
                    break;
                case "Valid email":
                    $("#invalidCredentialsMessage").text("Registration credentials are valid. You will now be registered, logged in, and redirected to the Moto Map page.");
                    $("#invalidCredentialsMessage").css("color", "green");
                    $("#invalidCredentialsMessage").show();
                    //alert("Successful");  
                    registerUser();
                    break;
            }
            
        }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
            alert("Error. Could not connect to server.\n" + ex);
        });
    }   
}

//---------------------------------
//Register new user into the User Database of the system (to allow them to then be logged in)
function registerUser() 
{
    //send user data to server to add new user to the MotoUsers Database
    $.get("/registerNewUser",     
            {   name: $("#userName").val(),
                email: $("#signupEmail").val(), 
                password: $("#signupPassword").val(),
            },
        
    ).done(function(data) {                 //success callback function
        console.log("Response:", data);
        
        //log user into the system directly after registration to then redirect to map page
        loginUser();

    }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
        alert("Error. Could not connect to server.\n" + ex);
    });
}

//---------------------------------
//Log user into the system session (and redirect to maps page)
function loginUser() 
{
    //send user data to server to log user into the session
    $.get("/logUserIn",     
            {   loginEmail: $("#signupEmail").val(), 
                loginPassword: $("#signupPassword").val(),
                rememberMe: $("#rememberMeCheck").is(':checked'),
                cookiesAccepted: cookieUsage
            },
        
    ).done(function(data) {                 //success callback function
        console.log("Response:", data);
        window.location.replace('/moto_map_HTML.html');     //redirect to map page

    }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
        alert("Error. Could not connect to server.\n" + ex);
    });
}

