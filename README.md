<h1>Rheinjug Alexa Skill Sample</h1>


<h3>Hilfreiche Links zu Alexa</h3>

1. <a href="https://developer.amazon.com/de/alexa">Amazon Alexa Seite</a> <br>
2. <a href="https://developer.amazon.com/de/docs/custom-skills/understanding-custom-skills.html">Was ist ein Custom Skill?</a> <br>
3. <a href="https://github.com/alexa/alexa-cookbook">Alexa Cookbook (Node.js Skillbeispiele)</a> <br>
4. <a href="https://aws.amazon.com/de/console/">Amazon AWS Console</a> <br>

<h3>Wichtige Hinweise</h3>

.gitignore:  <br>
.ask => Ordner enthält Skill Informationen
globals => Ordner enthält globale Konstanten, wie DB Tabellen Namen oder DB Endpoint

Die Daten aus globals müssen selber angelegt werden: 

    var globalConfig = {
        APP_ID: "amzn1.ask.skill..",
        TABLE_NAME: "Name1",
        MEMBER_TABLE: "Name2",
        AWS_DYNAMO_DB_ENDPONT: "https://dynamodb.eu-west-1.amazonaws.com",
        AWS_REGION: "eu-west-1"
    }
    
    module.exports = globalConfig

<h3>Intents</h3>

**AboutEventIntent**: <br>
Liest den Namen und Beschreibung des nächsten Meetups vor. <br>

Mittels der Methode _scan()_ wird auf die Datenbank zugegriffen. Dafür wird ein Objekt der Klasse _aws.DynamoDB.DocumentClient()_ angelegt.

    const docClient = new aws.DynamoDB.DocumentClient();

Da es sich um eine Lambda handelt, befinden wir uns immer noch im selben Scope und können die Alexa Funktionen nutzen:

     // Grundgerüst der Funktion
     docClient.scan(params, (err, data) => {
         ...
     });
            
In der Variable _db_data_ wird gepeichert was aus der Datenbank ausgelesen wurde.
    
    var db_data = getNextEventData(data);

Die Daten der Datenbank werden in _getNextEventData()_ ausgelesen.

    
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
            while (!firstResult){
                 var itemDate = new Date(JSON.stringify(dataArray[item].meetupID, null, 2)).getTime();
    
                if (itemDate > today){
                    resultArray.push(dataArray[item].Name, dataArray[item].Datum, dataArray[item].Beschreibung);
                    firstResult = true;
                }else if (itemDate === today){
                    resultArray.push(dataArray[item].Name, dataArray[item].Beschreibung);
                    firstResult = true;
                }
            }
        }
        return resultArray;
    }
    
In der Methode wird eine Liste mit Datenbankinhalten zum nächsten Vortag zurückgegeben. (_resultArray_). Dass es zwei Zuweisungne für _speechOutput_ gibt,
liegt daran, dass die Länge des _result_Array_ varriert, sobald das Datum des nächsten Vortrags am heutigen Tag ist. Näheres sehen wir im 
**NextEventsIntent**.

        docClient.scan(params, (err, data) => {
            if(err){
            ...
            }else{
                var db_data = getNextEventData(data);
                if (db_data.length == 3) speechOutput = this.t("AboutEvent").replace("%NAME%", db_data[0]).replace("%DESCR%", db_data[2]);
                else                     speechOutput = this.t("AboutEvent").replace("%NAME%", db_data[0]).replace("%DESCR%", db_data[2]);

                this.response.speak(speechOutput);
                this.emit(':responseReady');
            }
        });

Die Variable _speechOutput_ speichert den String, welcher in den _languageStrings_ angelegt wurde: 

    const languageStrings = {
        'de-DE': {
            'translation': {
                'WELCOME_LAUNCH':"Willkommen bei der Rhein Java User Group. Wie kann ich dir weiterhelfen?",
                    ...
                'AboutEvent': "Das nächste Thema lautet %NAME% und hat folgenden Inhalt: %DESCR%"
            }
        }
    };
    
Mittels der Methode _replace()_ werden die String Variablen gefüllt. **Language Strings** werden in der Alexa Skill Entwicklung genutzt, um 
hart codierte Sprachausgaben (Strings) im Code zu verhindern und, noch viel wichtiger, das Bereitstellen anderer Sprachen zu ermöglichen. 
Ein Skill kann in mehreren Sprachen erstellt werden und somit müssen auch alle Alexa Sprachausgaben an alle verwendeten Sprachen angepasst werden. 
Wir verwenden hier lediglich die Übersetzung für den deutschen Skill (de-DE), da für dieses Beispiel kein internationaler Skill erstellt wurde.

Ausgabe Alexa:

    "outputSpeech": {
          "type": "SSML",
          "ssml": "<speak> Das nächste Thema lautet Alexa Entwiklung mit Node.js und hat folgenden Inhalt: Seit Amazon im Oktober 2016 ihre virtuelle Sprachassistentin Alexa in Deutschland veröffentlicht hat, haben deutsche Drittentwickler die Möglichkeit eigene Skills zu programmieren. Dank der Nutzung von Sprachassistenten ist es möglich, alltägliche Aufgaben schnell und elegant zu lösen. In diesem Vortrag werden wir das Alexa SDK anhand eines kleinen Beispiels vorstellen. Dabei werden wir die Erstellung eines Voice User Interfaces (VUI) erläutern sowie aufzeigen, wie User-Eingaben mittels AWS Lambda weiterverarbeitet werden können. </speak>"
        }
    
**NextEventsIntent:** <br>
Hier wird diesmal das Datum und der Titel des nächsten Vortrags vorgelesen. Bis auf die Ausgabe sin diese beiden Intents identisch. 
Man kann sich jeden Intent als eigene Frage oder eigenes Gesprächsthema vorstellen. Man bekommt pro Intent 
immer eine Antwort.

_Anmerkung:_ <br>
_Wäre in diesem Intent ein Dialog Model (siehe JoinEventIntent) könnte man auch verschiedene Antworten mit if Bedingugen bekommen._

_Kleines Sahnehäubchen_: <br>
_Ist der nächste Vortrag am heutigen Tag wird dies auch so ausgegeben. Darum kann das _resultArray_ der Methode _getNextEventData_ in der Länge 
varieren, da beim heutigen Vortrag das Datum trivialerweise nicht mitgeliefert wird._
 

Ausgabe Alexa (in der Zukunft): 

    "outputSpeech": {
          "type": "SSML",
          "ssml": "<speak> Das nächste Meetup ist am 01.03.2018 und trägt den Titel Alexa Entwiklung mit Node.js </speak>"
        }

Ausgabe Alexa (heute): 

    "outputSpeech": {
          "type": "SSML",
          "ssml": "<speak> Das nächste Meetup ist am heute und trägt den Titel Alexa Entwiklung mit Node.js </speak>"
        }
        
        
**JoinEventIntent:** <br>
Dieser Intent beinhaltet das <a href="https://developer.amazon.com/de/docs/custom-skills/dialog-interface-reference.html">Dialog Model</a>
und fragt den _Namen_ der teilnehmenden Personen ab. Der Sinn ist hierbei eine Konversation zwischen Alexa und Nutzer 
aufzubauen, sodass in einzelnen Schritten Daten entgegengenommen werden können und nicht direkt im ersten Satz alle Daten vorhanden sein müssen.

Utterance ohne Dialog Model: <br>
Nutzer: "Alexa, sag java duesseldorf dass Alex am nächsten Vortrag teilnimmt"

Hat man sich hier nun einmal versprochen oder einen anderen Fehler gemacht, muss man es nochmal sagen. Besser ist es in einem Dialog: <br>
Nutzer: "Alexa, sag java duesseldorf dass ich am nächsten Vortag teilnehmen möchte." <br>
Alexa: "Sagst du mir bitte deinen Namen." <br>
Nutzer: "Alex" <br>
...

In so einem kurzen Beispiel ist es sogar noch ein einem Satz machbar, jedoch wenn wir beispielsweise eine Email schreiben wollen und Daten wie
Betreff, Empfänger, CC, Text aufsagen müssen, kann dies sehr schwer werden. 

Die **INSERT** Operation des _Namens_ und des _Datums_ (Datum des nächsten Vortrag) wird mittels _docClient.put()_ getätigt. Um hier festzulegen
welche Tabellenspalten welche Werte zugewiesen bekommen, wird ein Paramter angelegt: 

     var addedItem = {
          TableName:"MeetupMembers",
          Item:{
          "memberID": id,
          "date_meetup": dateNextEvent[1],
          "name": nameSlotRaw
          }
     };
     
Die Tabelle welche befüllt werden soll heisst "MeetupMembers" und die Spalten werden in _Item_ zugewiesen. Sind alle Spaltenwerte gefüllt, kann
die Tabelle gefüllt werden: 

     docClient.put(addedItem, () => {
          this.response.speak(this.t("JoinEvent").replace("%NAME%", nameSlotRaw));
          this.emit(':responseReady');

     });

Hier wird nur noch eine Sprachausgabe getätigt, damit der Nutzer darüber informiert wird, dass sein Name auf die Teilnehmerliste geschrieben wurde: 

    "outputSpeech": {
          "type": "SSML",
          "ssml": "<speak>Okay. Ich habe folgendes auf die Teilnehmerliste geschrieben. Name: Alex.</speak>"
        }
        
**ReadEventMembersIntent:** <br>
In diesem Intent werden einfach alle Namen der Tabelle _MeetupMembers_ vorgelesen: 

    "outputSpeech": {
          "type": "SSML",
          "ssml": "<speak> Folgende Personen kommen zum nächsten Meetup. theodor, severin, alexander, pascal. </speak>"
        }
        
        

<h3>Bilder der Tabellen</h3>

**Meetups Tabelle:** <br>

![Alt text](pics/meetupsPic.png?raw=true "Meetups Table")

**Members Tabelle:** <br>

![Alt text](pics/membersPic.png?raw=true "Meetups Table")


<h3>Alexa Skill Cheat Sheet</h3>

<a href="docs/VUI_Cheat_Sheet_final.pdf">PDF Alexa Cheat Sheet</a>