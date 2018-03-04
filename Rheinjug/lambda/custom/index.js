"use strict";

var Alexa = require('alexa-sdk');
var aws = require('aws-sdk');
var Globals = require('./globals/globals');

var APP_ID = Globals.APP_ID;

const languageStrings = {
    'de-DE': {
        'translation': {
            'WELCOME_LAUNCH':"Willkommen bei der Rhein Java User Group. Wie kann ich dir weiterhelfen?",
            'HELP_MESSAGE': "Wo liegt das Problem?",
            'CANCEL_MESSAGE': "Natürlich. Auf wiedersehen.",
            'DB_FAIL': "Leider konnte ich nicht auf die Datenbank zugreifen.",
            'NextLater': "Das nächste Meetup ist am %DATE% und trägt den Titel %NAME%",
            'NextToday': "Das nächste Meetup ist heute und trägt den Titel %NAME%",
            'AboutEvent': "Das nächste Thema lautet %NAME% und hat folgenden Inhalt: %DESCR%",
            'JoinEvent': "Okay. Ich habe folgendes auf die Teilnehmerliste geschrieben. Name: %NAME%.",
            'GetMembers': "Folgende Personen kommen zum nächsten Meetup. %NAMES%.",
            'FAIL': "Ich habe dich leider nicht richtig verstanden.",
            'BYE': "Tschüss und bis zum nächsten MAl.",
            'STOP': "Okay",
            'Deleted':'Frag mich bitte nochmal. Ich musste eben aufräumen.',
            'NoMembers':'Bis jetzt nimmt noch keiner am nächsten Meetup teil.'
        }

    }
};

aws.config.update({
    region: Globals.AWS_REGION,
    endpoint: Globals.AWS_DYNAMO_DB_ENDPONT
});

const params = {
    TableName: Globals.TABLE_NAME
};

const memberParams = {
    TableName: Globals.MEMBER_TABLE
};

const docClient = new aws.DynamoDB.DocumentClient();
const db = new aws.DynamoDB();


var handlers = {
    'LaunchRequest': function () {
        var speechOutput = this.t('WELCOME_LAUNCH');
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = this.t('HELP_MESSAGE');
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        var speechOutput = this.t('CANCEL_MESSAGE');
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        var speechOutput = this.t('STOP');
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        var speechOutput = this.t('BYE');
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
    'AboutEventIntent': function () {
        var speechOutput;

        docClient.scan(params, (err, data) => {
            if(err){
                this.response.speak(this.t("DB_FAIL"));
                this.emit(':responseReady');
            }else{
                var db_data = getNextEventData(data);
                if (db_data.length === 3)       speechOutput = this.t("AboutEvent").replace("%NAME%", db_data[0]).replace("%DESCR%", db_data[2]);
                else if (db_data.length === 2)  speechOutput = this.t("AboutEvent").replace("%NAME%", db_data[0]).replace("%DESCR%", db_data[1]);
                else                            speechOutput = this.t("Deleted");

                this.response.speak(speechOutput);
                this.emit(':responseReady');
            }
        });
    },
    "NextEventsIntent": function () {
        var speechOutput;

        docClient.scan(params, (err, data) => {
            if(err){
                this.response.speak(this.t("DB_FAIL"));
                this.emit(':responseReady');
            }else{
                var db_data = getNextEventData(data);
                if (db_data.length === 3)        speechOutput = this.t("NextLater").replace("%DATE%", db_data[1]).replace("%NAME%", db_data[0]);
                else if (db_data.length === 2)   speechOutput = this.t("NextToday").replace("%NAME%", db_data[0]);
                else                             speechOutput = this.t("Deleted");

                this.response.speak(speechOutput);
                this.emit(':responseReady');
            }
        });
    },
    'JoinEventIntent': function () {
        var filledSlots = delegateSlotCollection.call(this);
        var nameSlotRaw = this.event.request.intent.slots.name.value;

        docClient.scan(params, (err , data) => {
            var dateNextEvent = getNextEventData(data);

            docClient.scan(memberParams, (err, idData) => {
                var id = getID(idData);

                var addedItem = {
                    TableName: Globals.MEMBER_TABLE,
                    Item:{
                        "memberID": id,
                        "date_meetup": dateNextEvent[1],
                        "name": nameSlotRaw
                    }
                };
                docClient.put(addedItem, () => {
                    this.response.speak(this.t("JoinEvent").replace("%NAME%", nameSlotRaw));
                    this.emit(':responseReady');

                });
            });
        });
    },
    'ReadEventMembersIntent': function () {

        var speechOutput = "";

        docClient.scan(memberParams, (err, data) => {
            if (err){
                this.response.speak(this.t("DB_FAIL"));
                this.emit(':responseReady');
            }else{
                for (var item in data.Items){
                    speechOutput+= data.Items[item].name + ", ";

                    if(speechOutput.indexOf('undefined') > -1) {
                        speechOutput = speechOutput.replace('undefined,', '');
                    }

                }
            }
            if (speechOutput.length === 0){
                this.response.speak(this.t("NoMembers"));
                this.emit(':responseReady');
            }else{
                this.response.speak(this.t("GetMembers").replace("%NAMES%", speechOutput));
                this.emit(':responseReady');
            }

        });
    },
    'Unhandled': function () {
        this.response.speak(this.t("FAIL"));
        this.emit(':responseReady');
    }
};


function getID(idData) {
    var idList = [];
    for (var item in idData.Items){
        idList.push(idData.Items[item].memberID);
    }
    if (idList.length === 0) return 1;
    else return idList[idList.length - 1] + 1;
}

function getNextEventData(data) {
    var firstResult = false;
    var resultArray = [];
    var dataArray = [];

    for (var j in data.Items){
        dataArray.push(data.Items[j])
    }

    dataArray = dataArray.sort(function (a,b) {
        return  new Date(a.meetupID).getTime() > new Date(b.meetupID).getTime() ? 1 : -1;
    });

    var today = getDateTime().getTime();

    for (var item in dataArray) {
        while (!firstResult) {
            var itemDate = new Date(JSON.stringify(dataArray[item].meetupID, null, 2)).getTime();

            if (itemDate > today) {
                resultArray.push(dataArray[item].Name, dataArray[item].Datum, dataArray[item].Beschreibung);
                firstResult = true;
            } else if (itemDate === today) {
                resultArray.push(dataArray[item].Name, dataArray[item].Beschreibung);
                firstResult = true;
            }else if (itemDate < today){
                deleteItemFromDB(dataArray[item].meetupID);
                deleteMembersFromDB();
                resultArray.push(dataArray[item].meetupID);
                firstResult = true;
            }
        }
    }
    return resultArray;
}

function deleteItemFromDB(itemID) {

    var itemParams = {
        TableName: Globals.TABLE_NAME,
        Key: {
            meetupID: {
                S: itemID
            }
        },
    };

    db.deleteItem(itemParams, function(err) {
        if (err) console.log(err);
        else console.log("DeleteItem succeeded");
    });
}

function deleteMembersFromDB() {
    const contentParams = {
        TableName: Globals.MEMBER_TABLE
    };

    docClient.scan(contentParams, function(err, data) {
        if (err) console.log(err);
        else {
            data.Items.forEach(function(obj,i){
                console.log(i+1);
                i += 1;
                i = i.toString();
                var delParams = {
                    TableName: contentParams.TableName,
                    Key: {
                        memberID: {
                            N: i
                        }
                    },
                };

                db.deleteItem(delParams, function(err, data) {
                    if (err) console.log(err);
                    else console.log(data);
                });
            });
        }
    });
}


function getDateTime() {

    var date = new Date();

    var year = date.getFullYear();

    var month = date.getMonth();
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return new Date(year,month,day,0,0,0);

}

exports.handler = (event, context) => {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    //alexa.dynamoDBTableName = 'Meetups'; //uncomment this line to save attributes to DB
    alexa.execute();
};

//    END of Intent Handlers {} ========================================================================================
// 3. Helper Function  =================================================================================================

function delegateSlotCollection(){
    console.log("in delegateSlotCollection");
    console.log("current dialogState: "+this.event.request.dialogState);
    if (this.event.request.dialogState === "STARTED") {
        console.log("in Beginning");
        var updatedIntent= null;
        // updatedIntent=this.event.request.intent;
        //optionally pre-fill slots: update the intent object with slot values for which
        //you have defaults, then return Dialog.Delegate with this updated intent
        // in the updatedIntent property
        //this.emit(":delegate", updatedIntent); //uncomment this is using ASK SDK 1.0.9 or newer

        //this code is necessary if using ASK SDK versions prior to 1.0.9
        if(this.isOverridden()) {
            return;
        }
        this.handler.response = buildSpeechletResponse({
            sessionAttributes: this.attributes,
            directives: getDialogDirectives('Dialog.Delegate', updatedIntent, null),
            shouldEndSession: false
        });
        this.emit(':responseReady', updatedIntent);

    } else if (this.event.request.dialogState !== "COMPLETED") {
        console.log("in not completed");
        // return a Dialog.Delegate directive with no updatedIntent property.
        //this.emit(":delegate"); //uncomment this is using ASK SDK 1.0.9 or newer

        //this code necessary is using ASK SDK versions prior to 1.0.9
        if(this.isOverridden()) {
            return;
        }
        this.handler.response = buildSpeechletResponse({
            sessionAttributes: this.attributes,
            directives: getDialogDirectives('Dialog.Delegate', updatedIntent, null),
            shouldEndSession: false
        });
        this.emit(':responseReady');

    } else {
        console.log("in completed");
        console.log("returning: "+ JSON.stringify(this.event.request.intent));
        // Dialog is now complete and all required slots should be filled,
        // so call your normal intent handler.
        return this.event.request.intent;
    }
}


//These functions are here to allow dialog directives to work with SDK versions prior to 1.0.9
//will be removed once Lambda templates are updated with the latest SDK

function createSpeechObject(optionsParam) {
    if (optionsParam && optionsParam.type === 'SSML') {
        return {
            type: optionsParam.type,
            ssml: optionsParam['speech']
        };
    } else {
        return {
            type: optionsParam.type || 'PlainText',
            text: optionsParam['speech'] || optionsParam
        };
    }
}

function buildSpeechletResponse(options) {
    var alexaResponse = {
        shouldEndSession: options.shouldEndSession
    };

    if (options.output) {
        alexaResponse.outputSpeech = createSpeechObject(options.output);
    }

    if (options.reprompt) {
        alexaResponse.reprompt = {
            outputSpeech: createSpeechObject(options.reprompt)
        };
    }

    if (options.directives) {
        alexaResponse.directives = options.directives;
    }

    if (options.cardTitle && options.cardContent) {
        alexaResponse.card = {
            type: 'Simple',
            title: options.cardTitle,
            content: options.cardContent
        };

        if(options.cardImage && (options.cardImage.smallImageUrl || options.cardImage.largeImageUrl)) {
            alexaResponse.card.type = 'Standard';
            alexaResponse.card['image'] = {};

            delete alexaResponse.card.content;
            alexaResponse.card.text = options.cardContent;

            if(options.cardImage.smallImageUrl) {
                alexaResponse.card.image['smallImageUrl'] = options.cardImage.smallImageUrl;
            }

            if(options.cardImage.largeImageUrl) {
                alexaResponse.card.image['largeImageUrl'] = options.cardImage.largeImageUrl;
            }
        }
    } else if (options.cardType === 'LinkAccount') {
        alexaResponse.card = {
            type: 'LinkAccount'
        };
    } else if (options.cardType === 'AskForPermissionsConsent') {
        alexaResponse.card = {
            type: 'AskForPermissionsConsent',
            permissions: options.permissions
        };
    }

    var returnResult = {
        version: '1.0',
        response: alexaResponse
    };

    if (options.sessionAttributes) {
        returnResult.sessionAttributes = options.sessionAttributes;
    }
    return returnResult;
}

function getDialogDirectives(dialogType, updatedIntent, slotName) {
    var directive = {
        type: dialogType
    };

    if (dialogType === 'Dialog.ElicitSlot') {
        directive.slotToElicit = slotName;
    } else if (dialogType === 'Dialog.ConfirmSlot') {
        directive.slotToConfirm = slotName;
    }

    if (updatedIntent) {
        directive.updatedIntent = updatedIntent;
    }
    return [directive];
}