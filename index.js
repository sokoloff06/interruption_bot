// This app is only tested and designed to work with a single workspace yet
// TODO: Make a post on the submitter's behalf

const express = require('express');
const request = require('request');
const Store = require('data-store');

const app = express();
const store = new Store({ path: 'auth.json' })
const client_id = "511220587186.511052758372";
const client_secret = "b1f35600428d73ffdcb625e3e99ec59c";


// Workspace credentials and params
var appToken;
var botToken;
var botUser;
var teamName;
var interChannel = ''; //ID of the interruption channel

// Accesing params from the storage file if it exists
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

// Indication app is started
app.listen(port, () => console.log(`App listening on port ${port}!`))

// Posts a message using the following params:

// text(required) - String message to post
// channel(required) - String ID of a channel to post message to
// isReplace - boolean flag indicating if we want new message to replace previous message
// response_url - String unique URL that is being used if our message is sent in response to another
// asUser - boolean flag, currently not used. For future if we add functionality to post messages as user
function postMessage(text, channel, isReplace = false, response_url, asUser = false) {
    var token = botToken;
    var body = {
        "channel": channel,
        "text": text
    }

    if (isReplace) {
        body.delete_original = true;
    }
    if (asUser) {
        body.as_user = false;
        token = userToken;
    }

    var url;
    if (response_url) {
        url = response_url;
    }
    else {
        url = "https://slack.com/api/chat.postMessage";
    }


    request.post(url, {
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        json: body
    }, (err, res, body) => {
        console.log(res);
        console.log(err);
    });
};

// Posts confirmation message so user can preview the resulting message
function confirmPublish(form, chnl) {
    var text = "<!here>" +
        "\n*Start Time:*\n" + form.start_time +
        "\n*Cause:*\n" + form.cause +
        "\n*Impact:*\n" + form.impact +
        "\n*" + form.next_steps + ":*" +
        "\n" + form.time;


    request.post('https://slack.com/api/chat.postMessage', {
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
    }, (err, res, body) => {
    })
};

// Opens up the dialog in slack
function openDialog(trigger_id) {
    request.post('https://slack.com/api/dialog.open', {
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
                        'placeholder': 'e.g. March 16 2018 15:28 UTC'
                    },
                    // {
                    //     'type': 'text',
                    //     'label': 'End Time',
                    //     'name': 'end_time',
                    //     'placeholder': 'e.g. March 16 2018 15:28 UTC'
                    // },
                    {
                        'type': 'select',
                        'label': 'Cause',
                        'name': 'cause',
                        'options': [
                            {
                                'label': 'Issue with a vendor',
                                'value': 'Issue with a vendor'
                            },
                            {
                                'label': 'Issue with a business partner',
                                'value': 'Issue with a business partner'
                            },
                            {
                                'label': 'Internal system issue',
                                'value': 'Internal system issue'
                            }
                        ]
                    },
                    {
                        'type': 'textarea',
                        'name': 'impact',
                        'label': 'Issue and impact',
                        'hint': 'Please write here whatever is known and be as detailed as possible. Avoid using R&D internal terminology, use feature names instead',
                        'placeholder': 'Which features are affected? Is there any data loss? What is the expected experience in the system a compared to the steady state?'
                    },
                    {
                        'type': 'select',
                        'label': 'Next Steps',
                        'name': 'next_steps',
                        'options': [
                            {
                                'label': 'Status update',
                                'value': 'Next Status Update Time'
                            },
                            {
                                'label': 'Resolution',
                                'value': 'Expected Resolution Time'
                            }
                        ]
                    },
                    {
                        'type': 'text',
                        'label': 'Update/Resolution time',
                        'name': 'time',
                        'placeholder': 'e.g. March 16 2018 15:28 UTC'
                    },

                ]
            },
            'trigger_id': trigger_id
        },
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + appToken
        }
    }, (error, response) => {
        if (response.statusCode != 200) {
            console.log(error);
        }
    });
}

// "report" command handler, checks if channel ID is specified and opens dialog
app.post('/', (req, res) => {
    var body = req.body;
    channel = body.channel_id;
    var trigger_id = body.trigger_id;
    if(interChannel != '' && interChannel != null) {
        openDialog(trigger_id);
    }
    else if ((interChannel == '' || interChannel == null) && (store.get('channel_id') != '' && store.get('channel_id') != null)) {
        interChannel = store.get('channel_id');
        openDialog(trigger_id);
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
        res.send();
        var form = payload.submission;
        console.log(form);
        confirmPublish(form, payload.channel.id);
    }

    // Processess final interruption message publishing
    else if (payload.callback_id = "publish") {
        res.send();
        if (payload.actions[0].value == "yes") {
            postMessage(payload.original_message.attachments[0].text, interChannel/*, false, false, false*/);
            postMessage("Thanks for sumitting service interruption details!", payload.channel.id, true, payload.response_url);
        }
        else {
            postMessage("Message discarded. To start over use /report command!", payload.channel.id, true, payload.response_url);
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
        resp.redirect('https://' + teamName + '.slack.com/messages/' + botUser);

        // Get interruption channel ID
        postMessage("Please, add ID of the service interruption channel (as channel_id) to the auth.json file and restart the app on the server", user);
    });
});