// This app is only tested and designed to work with a single workspace yet
// TODO: Make a post on the submitter's behalf
const express = require('express');
const request = require('request');
const awsServerlessExpress = require('aws-serverless-express');

const app = express();
const server = awsServerlessExpress.createServer(app);

exports.handler = (event, context) => {
    console.log("EVENT: " + JSON.stringify(event));
    awsServerlessExpress.proxy(server, event, context);
}
//TODO: Think of other object type instead of Map
const store = new Map(Object.entries({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    appToken: process.env.APP_TOKEN,
    botToken: process.env.BOT_TOKEN,
    botUser: process.env.BOT_USER,
    teamName: process.env.TEAM_NAME,
    admin_user: process.env.ADMIN_USER,
    channel_id: process.env.CHANNEL_ID
}));

const update_string = "Next Status Update Time";
const resolution_string = "Expected Resolution Time:";
// Workspace credentials and params
var appToken;
var botToken;
var botUser;
var teamName;
var interChannel = ''; //ID of the interruption channel

// Loading params from the storage file to RAM if it exists
if (store.has('appToken')) {
    appToken = store.get('appToken');
    botToken = store.get('botToken');
    botUser = store.get('botUser');
    teamName = store.get('teamName');
    interChannel = store.get('channel_id');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = 3000;

// Test response for the GET request from browser
app.get('/', (req, res) => res.send('<p>Hello!</p>' + '<p>Interruption helper app is running</p><br>'));
app.get('/service-interruption-slackbot/', (req, res) => res.send('<p>Hello!</p>' + '<p>Interruption helper app is running</p><br>'));

// Indication app is started
app.listen(port, () => console.log(`App listening on port ${port}!`))

// Posts a message using the following params:

// text(required) - String message to post
// channel(required) - String ID of a channel to post message to
// username
// isReplace - boolean flag indicating if we want new message to replace previous message
// response_url - String unique URL that is being used if our message is sent in response to another
// asUser - boolean flag, currently used to refer to a person submitted the message.
function postMessage(text, channel, isReplace = false, response_url, asUser = false, user) {
    var token = botToken;

    if (asUser) {
        text = text + '\n_Submitted by <@' + user + '>_';
    }

    var body = {
        "channel": channel,
        "text": text
    }

    if (isReplace) {
        body.delete_original = true;
    }

    var url;
    if (response_url) {
        url = response_url;
    }
    else {
        url = "https://slack.com/api/chat.postMessage";
    }

    return request.post(url, {
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        json: body
    });
};

// Posts confirmation message so user can preview the resulting message
function confirmPublish(form, chnl) {
    var today = new Date();
    var now = today.toLocaleString("en-us", {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: "Asia/Jerusalem"
    });
    var text = "_" + now + "_" + "\n" +
        "<!here>" +
        "\n*Start Time:*\n" + form.start_time +
        "\n*Issue and cause:*\n" + form.issue +
        "\n*Impact:*\n" + form.impact +
        "\n*" + form.next_steps + ":*" +
        "\n" + form.time +
        "\n*For any further questions please contact Support.*";


    return request.post('https://slack.com/api/chat.postMessage', {
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + botToken
        },
        json: {
            "channel": chnl,
            "text": "Here is how your message will look like",
            "delete_original": true,
            "attachments": [
                {
                    "text": text,
                    "color": "#f49842"
                },
                {
                    "text": "Do you want to publish?",
                    "fallback": "You are unable to publish a message",
                    "callback_id": "publish",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            "name": "publish",
                            "text": "Yes",
                            "type": "button",
                            "value": "yes",
                            "style": "primary"
                        },
                        {
                            "name": "cancel",
                            "text": "Cancel",
                            "type": "button",
                            "value": "cancel",
                            "style": "danger"
                        }
                    ]
                }
            ]
        }
    });
};

// Opens up the dialog in slack
function openDialog(trigger_id) {
    var today = new Date();
    var time = today.toLocaleString("en-us", {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Jerusalem",
        timeZoneName: "short"
    });
    return request.post('https://slack.com/api/dialog.open', {
        json: {
            'dialog': {
                'callback_id': 'dialog-open',
                'title': 'Report interruption',
                'submit_label': 'Report',
                'state': 'Limo',
                'elements': [
                    {
                        'type': 'text',
                        'label': 'Start Time',
                        'name': 'start_time',
                        'value': time
                    },
                    // {
                    //     'type': 'text',
                    //     'label': 'End Time',
                    //     'name': 'end_time',
                    //     'placeholder': 'e.g. March 16 2018 15:28 UTC'
                    // },
                    {
                        'type': 'textarea',
                        'label': 'Issue description',
                        'name': 'issue',
                        'hint': 'Please specify what happened and what caused it'
                    },
                    {
                        'type': 'textarea',
                        'name': 'impact',
                        'label': 'Impact on customers',
                        'hint': 'Please write here whatever is known and be as detailed as possible. Avoid using R&D internal terminology, use feature names instead',
                        'placeholder': '• Which features are affected?\n• Is there any data loss?\n• What is the expected experience in the system a compared to the steady state?'
                    },
                    {
                        'type': 'select',
                        'label': 'Next Steps',
                        'name': 'next_steps',
                        'options': [
                            {
                                'label': 'Status update',
                                'value': update_string
                            },
                            {
                                'label': 'Resolution',
                                'value': resolution_string
                            }
                        ]
                    },
                    {
                        'type': 'text',
                        'label': 'Update/Resolution time',
                        'name': 'time',
                        'placeholder': "e.g. " + time
                    },

                ]
            },
            'trigger_id': trigger_id
        },
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + appToken
        }
    });
    //, (error, response) => {
    //     console.log("Trigger ID: " + trigger_id);
    //     console.log("APP TOKEN: " + appToken);
    //     console.log(response.body);
    //     if (response.statusCode != 200) {
    //         console.log(error);
    //     }
    // });
}

// "report" command handler, checks if channel ID is specified and opens dialog
app.post('/', (req, res) => {
    var body = req.body;
    channel = body.channel_id;
    var trigger_id = body.trigger_id;
    if (interChannel != '' && interChannel != null) {
        console.log("1")
        setRequestCallbacks(res, openDialog(trigger_id));
    }
    else if ((interChannel == '' || interChannel == null) && (store.get('channel_id') != '' && store.get('channel_id') != null)) {
        console.log("2")
        interChannel = store.get('channel_id');
        setRequestCallbacks(res, openDialog(trigger_id));
    }
    else {
        res.send("Please, add ID of the service interruption channel (as channel_id) to the auth.json file and restart the app on the server");
    }
});

// General endpoint, see comments inside
app.post('/postReport', (req, res) => {
    var payload = JSON.parse(req.body.payload);

    // Dialog data processor. Retrieves data from the dialog window and posts to the relevant channel
    if (payload.callback_id == "dialog-open") {
        // res.send();
        var form = payload.submission;
        console.log(form);
        setRequestCallbacks(res, confirmPublish(form, payload.user.id));
    }

    // Processess final interruption message publishing
    else if (payload.callback_id = "publish") {
        // res.send();
        if (payload.actions[0].value == "yes") {
            var user = payload.user.id;
            postMessage(payload.original_message.attachments[0].text, interChannel, false, false, true, user)
                .on('response', () => setRequestCallbacks(res, postMessage("Thanks for sumitting service interruption details!", payload.channel.id, true, payload.response_url)));
        }
        else {
            setRequestCallbacks(res, postMessage("Message discarded. To start over use /service-interruption-report command!", payload.channel.id, true, payload.response_url));
        }
    }
});

// OAuth and initial setup
app.get('/auth', (req, resp) => {
    //console.log(req);
    var code = req.query.code;
    var url = "https://slack.com/api/oauth.access";
    var body = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code
    }
    request.post(url, {
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        form: body
    }, (err, res, body) => {
        console.log(res);
        console.log(err);
        var response = JSON.parse(res.body);
        appToken = response.access_token;
        store.set('appToken', appToken);
        botToken = response.bot.bot_access_token;
        store.set('botToken', botToken);
        botUser = response.bot.bot_user_id;
        store.set('botUser', botUser);
        teamName = response.team_name;
        store.set('teamName', teamName);
        user = response.user_id;
        store.set('admin_user', user);
        store.set('channel_id', '');

        // Redirect to slack
        //resp.redirect('https://' + teamName + '.slack.com/messages/' + botUser);

        // Get interruption channel ID
        postMessage("Please, add ID of the service interruption channel (as channel_id) to the environment variables and restart the lamdba", user);
    });
});

function setRequestCallbacks(res, req) {
    req
        .on('error', (error) => {
            console.error(error);
            res.send(500, 'Opps, something went wrong :O');
        })
        .on('response', (response) => {
            console.log('SUCCESS');
            res.send();
        });
}