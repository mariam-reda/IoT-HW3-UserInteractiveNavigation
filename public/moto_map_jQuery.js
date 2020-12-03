const MQTT_TOPIC = "moto/location-coordinates"; /*to publish to arrow all coordinate changes*/
var MQTT_TOPIC_EXPRESS = "moto/location-coordinates/new-route"; /*to publish to server for new routes set*/
var rememberUser_set;   /*whether user selected 'Remember Me' option or not*/
var userAlreadyLoggedOut = false;   /*used to avoid logging user out twice and causing error (logOut on button click then on window.beforeUnload triggered)*/


var mymap;
var currentLocationCoordinates;
var destinationLocationCoordinates;
var currentLocationMarker;
var accuracyRadiusCircle;
var radiusDisplayedOnce = false;
var control;

var startingLocationMarker; //will mark the starting location (first detected location, vs. current location being tracked while moving)

//---------------------------------------------
//custom red icon (used to differentiate between current location and destination (default blue icon))
var redIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

//custom violet icon (used to differentiate starting location)
var violetIcon = new L.Icon({
	iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
	shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
});

//-------------------------------------------------------------------
//-------------------------------------------------------------------
//SESSION COOKIE HANDLING (USER LOGIN/LOGOUT)

//check session details to see if there is already a user currently logged in (- should not be accessing this page if they are not)
function checkSessionDetails() {
    console.log("Getting session details..");

    //get session details from server
    $.get("/getSessionDetails"
        /*no data to be passed*/
    ).done(function(data) {                 //success callback function
        var currentSessionData = data;
        //console.log("SessionDetails Response:", currentSessionData);
        
        //check if there is a currently-logged in user
        if (jQuery.isEmptyObject(currentSessionData))   //no user logged in
        {
            console.log("Session is confirmed as empty - No logged in user yet.");

            //redirect user to 'Unauthorized Access' page
            window.location.replace('/unauthorizedAccess_HTML.html');
        }
        else //call returned some session info -> a user is currently logged in
        {
            console.log("Session indicates a user is logged in.");
            userAlreadyLoggedOut = false;

            // console.log(currentSessionData);
            // console.log("FT", currentSessionData.firstTimeLogin);
            // console.log("LTV", currentSessionData.lastTimeVisited);

            //use user's display name if available, otherwise use default 'User' in welcome message
            var userDisplayName = "User";
            if (currentSessionData.userName)
            {   userDisplayName = currentSessionData.userName;  }
            

            //retrieve user's name from response data (name is set to "User" by default if cookies have not been enabled, or user's selected display name if cookies are enabled)
            if (currentSessionData.firstTimeLogin == true || currentSessionData.firstTimeLogin == undefined)  //firstTimeLogin = true or undefined (if cookies not accepted)
            { $("#welcomeUser").text("Welcome, " + userDisplayName);   }
            else if (currentSessionData.firstTimeLogin == false)    //firstTimeLogin = false
            {   $("#welcomeUser").text("Welcome back, " + userDisplayName); }
            
            //retrieve last time visited if available
            if (currentSessionData.lastTimeVisited)
            {   $("#lastAccessed").text("Last Visited: " + currentSessionData.lastTimeVisited); }
            else    //if undefined, then do not display
            {   $("#lastAccessed").text("");    }


            //set up the map on the page
            setUpMap();

            //initialize MQTT connection (to publish location coordinates to Moto Direction Arrow)
            setUpMQTTClient();

            //store user's 'Remember Me' setting (for later use in logging out/closing window)
            if (currentSessionData.rememberUser != undefined)  /*if undefined, then there is no logged in user*/
            {
                rememberUser_set = (currentSessionData.rememberUser == 'true');
                console.log("Remember User Set:", rememberUser_set);
            }
            /*'rememberUser' is always either true or false for a logged-in user, regardless of whether they accepted/declined cookies (is independent from extra cookie use)*/
        
            //inform user of how refresh/close of window will affect their login
            if (rememberUser_set == true)
            {
                $("#infoPar").prepend("<span class='text-info'>NOTE: You <b>selected</b> the 'Remember Me' option on login, so refreshing or closing the page will keep you logged in until you manually log out.<br/></span>");
            }
            else if (rememberUser_set == false)
            {
                $("#infoPar").prepend("<span class='text-info'>NOTE: You <b>did not</b> select the 'Remember Me' option on login, so refreshing or closing the page will log you out of the session automatically.<br/></span>");
            }
        }
        
    }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
        alert("Error. Could not connect to server.\n" + ex);
    });
}

//---------------------------------

//logoutUser() - function is called when user explicitly clicks the 'Log Out' button, 
// OR when user closes the window and did not check the 'Remember Me' option on Login
function logoutUser() 
{
    //console.log("LogOut button clicked.");
    console.log("logoutUser() called.");

    //execute logout process on server (to delete session and clear cookies)
    $.get('/logUserOut',
        /*no data to be passed*/

    ).done( function(data) {        //success callback function
        console.log("User has been logged out of system.");
        userAlreadyLoggedOut = true;

        //redirect user back to logged-out page
        // window.location.replace('/moto_loggedOut_HTML.html');
        window.location.replace('/moto_logout_HTML.html');

    }).fail( function(jqxhr, settings, ex) {    //failure to connect to server callback function
        alert("Error. Could not connect to server.\n" + ex);
    });
}

//---------------
window.onbeforeunload = function() { 
    console.log("Window OnBeforeUnLoad function called.");
    //if (rememberUser_set == false)  /*user is logged in but did not select the 'Remember Me' option*/
    //if (userAlreadyLoggedOut == false)  /*function is explicitly triggered by page refresh/close (not by page redirecting after user has been logged out)*/
    if(rememberUser_set == false && userAlreadyLoggedOut == false)
    {
        console.log("Window OnBeforeUnLoad - log user out");
        logoutUser();
    } 
    //}
    /*if rememberUser_set = undefined, then there is no logged in user to log out*/
    /*if rememberUser_set = true, then keep current user logged in (maintain session as is)*/
}; 

//------------------------------------------------------------
//------------------------------------------------------------
//--MQTT SET UP CODE

//set up variables needed to connect to mqtt broker using mqtt-over-websockets
var mws_broker = "localhost";
var mws_port = 9001;

//create client using Paho Library
var client = new Paho.MQTT.Client(mws_broker, mws_port, "myclientid_" + parseInt(Math.random()*100, 10));

//set up client's onConnectionLost callback function
client.onConnectionLost = function(responseObject) {
    console.log("\nConnection Lost:", responseObject.errorMessage, "\n");
}

//set up client's onMessageArrived callback function
client.onMessageArrived = function(message) {
    console.log("\nMessage Arrived:\n\t", message.destinationName, ' -- ', message.payloadString);
}

//set options for MQTT connection
var options = {
    timeout: 3,
    onSuccess: function() {         //connection to MQTT broker was successful
        console.log("\nMQTT Connected!\n");

        //publishing will happen later, once route is set  

    },
    onFailure: function(message) {  //connection to MQTT broker was unsuccessful
        console.log("\nMQTT Connection failed:", message.errorMessage, "\n");
    }
}

//---------------------------------
function setUpMQTTClient()  //called on load of HTML page
{
    //connect client
    client.connect(options);   
}

//------------------------------------------------------------
//------------------------------------------------------------
//SETTING UP THE MAP

//window.onload = function() {
function setUpMap() {
    //Initialize map - set to world view initially
    mymap = L.map('motoMap_div').fitWorld();

    //Add Mapbox Streets tile layer to map
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibXJlZGEyMCIsImEiOiJja2dxeWY2bDEyejNlMzB0ZXJqajcyY2d1In0.B5o1M7F8RvZmBhKJ_dnYUg', {
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
            'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1
    }).addTo(mymap);

    //---------------------------------------------
    //Geolocation - locate user's current location
    mymap.locate({setView: true, watch: true, maxZoom: 16});    //will either call onLocationFound() or onLocationError
                                                                // 'watch:true' will continuously track user's location and update map accordingly (calls onLocationFound)

    //---------------------------------------------

    //Geolocation - location found function
    function onLocationFound(e) 
    {
        console.log("onLocationFound called.");
        
        //accuracy radius of location detected
        var radius = e.accuracy / 8;

        //store current location coordinates
        currentLocationCoordinates = e.latlng;

        //currentLocationMarker = L.marker(currentLocationCoordinates, {icon: redIcon}).addTo(mymap).bindPopup("<b>Detected Current Location</b><br/>You are within " + radius + " meters from this point").openPopup();


        //update display according to location read (first location detected; current tracked location w/o route set; updated current location when route set)
        if (startingLocationMarker == null) //first location being detected -> add starting location marker (fixed violet marker)
        {
            startingLocationMarker = L.marker(currentLocationCoordinates, {icon: violetIcon}).addTo(mymap).bindPopup("<b>Detected Starting Location</b><br/>You have started within " + radius + " meters from this point").openPopup();
            //starting marker is displayed throughout whole run
        }
        else if (startingLocationMarker != null && destinationLocationCoordinates == null)    //starting location already read, but no destination set -> just updating current location marker (tracking movement)
        {
            //create new current location marker or update coordinates of marker if existing
            if (currentLocationMarker == null)
            {   
                currentLocationMarker = L.marker(currentLocationCoordinates, {icon: redIcon}).addTo(mymap).bindPopup("<b>Detected Current Location</b>").openPopup();   
            }
            else
            {   
                currentLocationMarker.setLatLng(currentLocationCoordinates);    
            }
            
        }
        else if (destinationLocationCoordinates != null)    //destination set -> update waypoints, route, and server with new current location
        {
            //if displayed, remove manually-placed current location marker (tracked current location marker will be placed by control object based on waypoints and route)
            if (currentLocationMarker != undefined)
            {   
                mymap.removeLayer(currentLocationMarker);
                currentLocationMarker = undefined;
            }

            //update waypoints and determine new route
            routeMap(currentLocationCoordinates, destinationLocationCoordinates, "current");   //this function calls subsequent server updating functions
            
        } 
        
        //display radius circle (later removed when a destination is set)
        if (!radiusDisplayedOnce) 
        {   
            accuracyRadiusCircle = L.circle(currentLocationCoordinates, radius, {color: 'yellow', fillColor: 'yellow', fillOpacity: 0.2}).addTo(mymap); 
            radiusDisplayedOnce = true;
        }

        //set map view to be centered at current location
        mymap.setView(currentLocationCoordinates, 13);
    }

    //attach location found listener
    mymap.on('locationfound', onLocationFound);

    //---------------------------------------------
    //Geolocation - location error function
    function onLocationError(e) 
    {
        alert(e.message + "\n\nAllow the website to access your location to set your current location on the map.");
    }

    //attach location found listener
    mymap.on('locationerror', onLocationError);



    //-------------------------------------------------------------
    //onMapClick() - listener created for when user clicks on map; sets the destination location
    function onMapClick(e) 
    {
        //hide accuracy radius circle on first click
        if (accuracyRadiusCircle != undefined)
        {
            mymap.removeLayer(accuracyRadiusCircle);
            accuracyRadiusCircle = undefined;
        }

        //only display route and destination marker if current location has been read
        if (currentLocationCoordinates != undefined)
        {
            //if not yet initialized, then initialize control object for routing
            if (control == undefined)
            {   initializeControl();    }

            //pass destination coordinates to routeMap() function
            destinationLocationCoordinates = e.latlng;
            routeMap(currentLocationCoordinates, destinationLocationCoordinates, "destination");
        }
        else    //current location detection was blocked/error occurred
        {
            alert("Allow the website to access your location to be able to set a destination and determine a route.");
        }
    }
    mymap.on('click', onMapClick);      //attach function to event
};



//-------------------------------------------------------------
//routing control object
function initializeControl() 
{
    control = L.Routing.control({
        routeWhileDragging: true,
        lineOptions : {addWaypoints: false},     //avoids allowing additional waypoints by clicking line (only 2 points allowed - from-to)
        collapsible: true,                       //hides directions panel
        createMarker: function(i, wp, nWps) {    //differentiates between start/current and destination markers
            let locMarker = L.marker(wp.latLng);
            if (i == 0) //starting location marker
            {
                locMarker.setIcon(redIcon);                             //starting location marker uses red icon
                locMarker.bindPopup("Current Location");
            }
            else if (i == 1)    //destination location marker
            {
                locMarker.bindPopup("Destination Location");            //destination marker uses default blue icon
            }
            return locMarker;
        },
    }).addTo(mymap);
}


//-------------------------------------------------------------
//function sets waypoints for control object, calculating and displaying the route
function routeMap(current_latlong, dest_latlong, updatedLocation)   
{
    //update destination point and route
    console.log("routeMap() function called");

    //set the location waypoints (triggers route calculation and display)
    control.setWaypoints([current_latlong, dest_latlong]);

    //hide regenerated directions box
    $(".leaflet-routing-container").css("display", "none");
    //$(".leaflet-control-container").css("display", "none");

    //update server - POST/GET used depending on which location was updated (current = GET vs. destination = POST)
    // if (updatedLocation == "current")
    // {
    //     sendGetRequestToServer(current_latlong, dest_latlong);
    // }
    // else    //updatedLocation == "destination"
    // {
    //     postLocationsToServer(current_latlong, dest_latlong);   
    // }

    //update Moto Direction Arrow with new location changes using MQTT publishing
    message = new Paho.MQTT.Message(JSON.stringify({
        startingCoordinates: {lat: current_latlong.lat, lng: current_latlong.lng},
        destinationCoordinates: {lat: dest_latlong.lat, lng: dest_latlong.lng}
    }));
    message.destinationName = MQTT_TOPIC;
    client.send(message);
    console.log("Coordinates shared through MQTT to Arrow.");

    //update the server with ONLY the start and destination coordinates (not updated if CURRENT coordinates change; only concerned with inital route set)
    if (updatedLocation == "destination")   //new destination set (i.e. not an update of the current location when moving)
    {
        //updateStoredLocationsOnServer(current_latlong, dest_latlong);

        //publish to server topic too
        message.destinationName = MQTT_TOPIC_EXPRESS;
        client.send(message);
        console.log("Coordinates shared through MQTT to server.")
    }
}

//-------------------------------------------------------------
//updateStoredLocationsOnServer() - function sends locations' coordinates to Express Server to save the information in a MongoDB database
// to keep a record of the user's routes.
// function updateStoredLocationsOnServer(startLoc, destinationLoc)
// {
//     console.log("Called updateStoredLocationsOnServer() method.");
//     console.log("StartLoc = " + startLoc + ", DestinationLoc = " + destinationLoc);

//     //send location coordinates to the Express Server
//     $.get("/saveNewLocationCoordinates",     
//             {   startingCoordinates: {lat: startLoc.lat, lng: destinationLoc.lng},
//                 destinationCoordinates: {lat: startLoc.lat, lng: destinationLoc.lng}
//             },
        
//     ).done(function(data) {                 //success callback function
//         console.log("Server has been updated. Response:", data);

//     }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
//         alert("Error. Could not connect to server.\n" + ex);
//     });
// }

//-------------------------------------------------------------
//postLocationsToServer() - function executes POST requests to server (when new destination is set)
// function postLocationsToServer(startLoc, destinationLoc) 
// {
//     console.log("Called postLocationsToServer() method.");
//     console.log("StartLoc = " + startLoc + ", destinationLoc = " + destinationLoc);

//     $.post('http://localhost:1234',  // url of server
//         JSON.stringify({            // data sent in request
//             startingCoordinates: startLoc,
//             destinationCoordinates: destinationLoc,
//         }),
//         function(data, status, xhr) {                       // success callback function
//             //alert('status: ' + status + ', data: ' + data);
//             console.log('POST status: ' + status + ', data from server: ' + data);
//         }).fail((function(jqxhr, settings, ex) {            // failure to connect to server callback function
//             alert("Error. Could not connect to server to post current and destination locations.\n" + ex);
//         }));
// }

//-------------------------------------------------------------------------
//sendGetRequestToServer() - function executes GET requests to server to update locations (when changes occur in current postion)
// function sendGetRequestToServer(currentLoc, destinationLoc) 
// {
//     console.log("Called sendGetRequestToServer() method.");

//     $.get("http://localhost:1234",  // url of server
//         {                                               //data being sent (split lat and long to allow for encoding)
//             currentLocation_lat: currentLoc.lat, 
//             currentLocation_long: currentLoc.lng, 
//             destinationLocation_lat: destinationLoc.lat,
//             destinationLocation_long: destinationLoc.lng
//         },
//         function (data, textStatus, jqXHR) {              // success callback function
//           //alert('status: ' + textStatus + ', data: ' + data);
//           console.log('status: ' + textStatus + ', data from server: ' + data);
//     }).fail((function(jqxhr, settings, ex) {            // failure to connect to server callback function
//         alert("Error. Could not connect to server to send current and destination locations in GET request.\n" + ex);
//     }));

//     console.log("Finished GET");
// }


