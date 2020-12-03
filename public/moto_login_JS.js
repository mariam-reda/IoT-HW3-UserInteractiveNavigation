//create initial variable for cookie usage (set based on user's consent)
var cookieUsage = false;    //default extra cookie use is 'false'


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
            alert("Login Page should not be accessed when user is already logged in. \nRedirecting to Moto Map Page...");
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
//Login validation - check the credentials for an EXISTING user
function checkLoginCredentials() 
{
    console.log("Login button clicked");
    $("#invalidCredentialsMessage").hide();

    if ( ($("#loginEmail").val() != "") && ($("#loginPassword").val() != "") )
    {
        //check login credentials with server
        $.get("/checkLoginCredentials",     
            { loginEmail: $("#loginEmail").val(), loginPassword: $("#loginPassword").val() },
        
        ).done(function(data) {                 //success callback function
            console.log("Response:", data);
            
            switch(data)
            {
                case "DB Error":
                    alert("Error. Could not connect to Database to check credentials.");
                    break;
                case "Invalid login credentials":
                    // alert("Credentials invalid.");
                    $("#invalidCredentialsMessage").text("Login is invalid - email or password are not correct. Please try again.");
                    $("#invalidCredentialsMessage").show();
                    break;
                case "Valid login credentials":
                    $("#invalidCredentialsMessage").text("Login credentials are valid. You will now be logged in and redirected to the Moto Map page.");
                    $("#invalidCredentialsMessage").css("color", "green");
                    $("#invalidCredentialsMessage").show();
                    loginUser();
                    break;
            }
            
        }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
            alert("Error. Could not connect to server.\n" + ex);
        });
    }   
}

//---------------------------------
//Log user into the system session (and redirect to maps page)
function loginUser() 
{
    //send user data to server to log user into the session
    $.get("/logUserIn",     
            {   loginEmail: $("#loginEmail").val(), 
                loginPassword: $("#loginPassword").val(),
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
