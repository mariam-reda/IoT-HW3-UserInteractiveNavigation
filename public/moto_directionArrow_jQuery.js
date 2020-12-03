const MQTT_TOPIC = "moto/location-coordinates";
var subscribed_status = false;

//-------------------------------------------------------------------
//SESSION COOKIE HANDLING (USER LOGIN/LOGOUT)

//check session details to see if there is already a user currently logged in (- should not be accessing this page if they are not)
function checkSessionDetails() {
    console.log("Getting session details..");

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

            //initialize MQTT connection (to subscribe to topic and receive location coordinates from Moto Map)
            setUpMQTTClient();
        }
        
    }).fail(function(jqxhr, settings, ex) {   //failure to connect to server callback function
        alert("Error. Could not connect to server.\n" + ex);
    });
}

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
    subscribed_status = false;
    $("#messageDisplayed").text("MQTT Connection has been lost. Client is no longer subscribed to receive updates.");
}

//set up client's onMessageArrived callback function
client.onMessageArrived = function(message) {
    console.log("\nMessage Arrived:\n\t", message.destinationName, ' -- ', message.payloadString);

    if (message.destinationName == MQTT_TOPIC)
    {
        //update direction arrow
        calculateDirectionAngle(message.payloadString);
    }
}

//set options for MQTT connection
var options = {
    timeout: 3,
    onSuccess: function() {         //connection to MQTT broker was successful
        console.log("\nMQTT Connected!\n");

        //subscribe to selected topic
        client.subscribe(MQTT_TOPIC, {qos: 1});
        subscribed_status = true;

        $("#messageDisplayed").text("MQTT Connection has been successful. Client is now subscribed and waiting for new location updates.");

    },
    onFailure: function(message) {  //connection to MQTT broker was unsuccessful
        console.log("\nMQTT Connection failed:", message.errorMessage, "\n");
        $("#messageDisplayed").text("MQTT Connection failed. Client is not subscribed to receive any updates.");
    }
}

//extra: set up client's disconnect function
client.end = function(response) {
    console.log("MQTT client has been disconnected.");
    subscribed_status = false;
    $("#messageDisplayed").text("MQTT Client has been disconnected. Client is no longer subscribed to receive updates.");
}

//---------------------------------
function setUpMQTTClient()  //called on load of HTML page
{
    //connect client
    client.connect(options);   
}

//-------------------------------------------------------------------
//-------------------------------------------------------------------------
// var timer_toUpdate;     //timer used to generate 'automated' GET requests to server

// function startTimer() {
//     timer_toUpdate = setInterval(getLocationsFromServer, 5000);  //call the function every 5 second
//     console.log("Timer has been started - getting locations from server every 5 seconds.");
//     //alert("Automated Updates are being received from server.");
//     $("#messageDisplayed").text("Automatic Updates are being received from server.");
// }

// function stopTimer() {
//     clearInterval(timer_toUpdate);
//     timer_toUpdate = null;
//     console.log("Timer has been stopped. No longer getting updates from server automatically.");
//     //alert("Automated Updates from server have been stopped.");
//     $("#messageDisplayed").text("Automated Updates from server have been stopped.");
// }

//----------------------------------

// function restartAutomaticTracking() //triggered by clicking the 'Start Automatic Updates' button
// {
//     if (!subscribed_status)     //previously: timer_toUpdate == null -> startTimer()
//     {   client.connect(options);   }
//     else
//     {   $("#messageDisplayed").text("Automated Updates are already being received."); }
//     console.log("Restart Automatic Updates button clicked.");
// }

// function stopAutomaticTracking()    //triggered by clicking the 'Start Automatic Updates' button 
// {
//     if (subscribed_status)     //previously: timer_toUpdate != null -> stopTimer()
//     {   client.end();    }
//     else 
//     {   $("#messageDisplayed").text("Automated Updates are already stopped."); }
//     console.log("Stop Automatic Updates button clicked.");
// }

//-------------------------------------------------------------------------
//getLocationsFromServer() - function executes GET requests to server
// function getLocationsFromServer() 
// {
//     console.log("Called getLocationsFromServer() method.");
//     $("#messageDisplayed").text("");

//     $.get("http://localhost:1234",  // url of server
//       function (data, textStatus, jqXHR) {              // success callback
//           //alert('status: ' + textStatus + ', data: ' + data);
//           console.log('status: ' + textStatus + ', data from server: ' + data);
//           calculateDirectionAngle(data);                //call function to calculate direction angle using received JSON coordinates
//     }).fail((function(jqxhr, settings, ex) {            // failure to connect to server callback function
//         alert("Error. Could not connect to server to retrieve current and destination locations.\n" + ex);
//         stopTimer();
//     }));

//     console.log("Finished GET");
// }

//-------------------------------------------------------------------------
//calculateDirectionAngle() - calculates the angle between the current and destination locations using bearings calculation
function calculateDirectionAngle(startEndCoordinatesJSON)
{
    //Convert JSON-formatted coordinates to JS object
    var startEndCoordinates = JSON.parse(startEndCoordinatesJSON);
    console.log("startEndCoordinates variable = ", startEndCoordinates); 

    //store coordinates lat and long in separate variables (for easier reference in calculations)
    currentLat = startEndCoordinates.startingCoordinates.lat;
    currentLong = startEndCoordinates.startingCoordinates.lng;
    destinationLat = startEndCoordinates.destinationCoordinates.lat;
    destinationLong = startEndCoordinates.destinationCoordinates.lng;

    console.log("CurrentLat = ", currentLat, ", CurrentLong = ", currentLong, ", DestinationLat = ", destinationLat, ", DestinationLong = ", destinationLong);

    /*
    * Bearing from Point 'a' to Point 'b' = β = atan2(X,Y)
    *   where X = cos(θb) * sin(∆L) 
    *   and Y = cos(θa) * sin(θb) – sin(θa) * cos(θb) * cos(∆L)
    *       with 'L' = longitude and 'θ' = latitude
    */

    //calculate bearing   [a = current, b = destination]
    x = Math.cos(destinationLat) * Math.sin(destinationLong - currentLong);
    y = ( Math.cos(currentLat) * Math.sin(destinationLat) ) - ( Math.sin(currentLat) * Math.cos(destinationLat) * Math.cos(destinationLong - currentLong) );
    bearingResult = Math.atan2(x, y);

    console.log("Bearing result =", bearingResult); //bearing result is in radians

    //convert bearing from radians to degrees
    bearingResult_deg = radians_to_degrees(bearingResult);
    console.log("Bearing result in degrees =", bearingResult_deg);

    //update the displayed arrow angle to convey the new direction angle
    updateDisplayedArrowAngle(bearingResult_deg);
}

//----------------------------------------
function radians_to_degrees(radiansValue)
{
    return radiansValue * (180/Math.PI);
}
//----------------------------------------
//updateDisplayedArrowAngle() - rotates arrow based on new angle between current and destination locations
function updateDisplayedArrowAngle(newAngle)
{
    $('#directionArrow').css('transform', 'rotate(' + (newAngle % 360) + 'deg)');
    console.log("directionArrow angle has been updated.");
    $("#messageDisplayed").text("Direction update has been received and displayed.");
}
