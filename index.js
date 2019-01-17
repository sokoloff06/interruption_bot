const express = require('express');
const request = require('request');
const app = express();
const appToken = "xoxp-511220587186-512622329046-522547343265-ff438c068f5ba0c1619d1baf0d994182"; //changes after the re-install
//const userToken = "xoxp-511220587186-512622329046-522366249552-ac278479b7522e60a428cfeee38c8df2";
const botToken = "xoxb-511220587186-512889535014-Yc1UWyFXkDjzoc5LdJ6XCPuz"; //changes after the re-install
const client_id = "511220587186.511052758372";
const client_secret = "b1f35600428d73ffdcb625e3e99ec59c";
const interChannel = "CF9RR28MQ";
var session = false;
var counter = 0;
var formData = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = 3000;

// Test response for the GET request from browser
app.get('/', (req, res) => res.send('<p>Hello World!</p>' + '<p>Recieved the following "Accept" header: </p><br>' + req.headers.accept));

// Indication app is started
app.listen(port, () => console.log(`App listening on port ${port}!`))

function postMessage(text, channel, isReplace = false, response_url, asUser = false) {
    var token = botToken;
    var body = {
        "channel": channel,
        "text": text
    }

    if(isReplace) {
        body.delete_original = true;
    }
    if(asUser) {
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

function askCause(chnl) {
    request.post('https://slack.com/api/chat.postMessage', {
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + botToken
        },
        json: {
            "channel": chnl,
            "text": "Cause of the interruption",
            "attachments": [
                {
                    "text": "Cause",
                    "fallback": "Seems you are using an interface that does not support Slack attachments or interactive messages",
                    "color": "#3AA3E3",
                    "callback_id": "cause",
                    "actions": [
                        {
                            "name": "causes",
                            "text": "Choose cause",
                            "type": "select",
                            "options": [
                                {
                                    "text": "Issue with a vendor",
                                    "value": "Issue with a vendor"
                                },
                                {
                                    "text": "Issue with a business partner",
                                    "value": "Issue with a business partner"
                                },
                                {
                                    "text": "Internal issue",
                                    "value": "Internal issue"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }, (err, res, body) => {
    })
};

function confirmPublish(form, chnl) {
    var text = "<!channel> Interruption alert!\n*Start Time*\n" + form.start_time +
        "\n*Next Update Time*\n" + form.update_time +
        "\n*Cause*\n" + form.cause +
        "\n*Impact*\n" + form.impact +
        "\n*Est. resolution time*\n" + form.resolution_time;


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

// "report" command handler. Opens up the dialog in slack
app.post('/', (req, res) => {
    var body = req.body;
    channel = body.channel_id;
    var trigger_id = body.trigger_id;

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
                                'value': 'vendor'
                            },
                            {
                                'label': 'Issue with a business partner',
                                'value': 'partner'
                            },
                            {
                                'label': 'Internal system issue',
                                'value': 'internal'
                            }
                        ]
                    },
                    {
                        'type': 'textarea',
                        'name': 'impact',
                        'label': 'Impact',
                        'hint': 'Which features are affected? Is there any data loss? What is the expected experience in the system a compared to the steady state?',
                        'placeholder': 'Please write here whatever is known and be as detailed as possible. Avoid using R&D internal terminology, use feature names instead'
                    },
                    {
                        'type': 'select',
                        'label': 'Next Steps',
                        'name': 'cause',
                        'options': [
                            {
                                'label': 'Issue with a vendor',
                                'value': 'vendor'
                            },
                            {
                                'label': 'Issue with a business partner',
                                'value': 'partner'
                            },
                            {
                                'label': 'Internal system issue',
                                'value': 'internal'
                            }
                        ]
                    },
                    {
                        'type': 'text',
                        'label': 'Next update time',
                        'name': 'update_time',
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
    });
    res.send();
});


// TODO: Make a post on the submitter's behalf
app.post('/postReport', (req, res) => {
    var payload = JSON.parse(req.body.payload);

    // Dialog data processor. Retrieves data from the dialog window and posts to the relevant channel
    if (payload.callback_id == "dialog-open") {
        res.send();
        var form = payload.submission;
        console.log(form);
        confirmPublish(form, payload.channel.id);
    }

    // processes "cause" multiple choice question
    else if (payload.callback_id == "cause") {
        if (counter != 2) {
            formData.cause = payload.actions[0].selected_options[0].value;
        }
        else {
            formData.cause = payload.actions[0].selected_options[0].value;
            var text = "*Impact:* Which features are affected? Is there any data loss? What is the expected experience in the system a compared to the steady state?"
            postMessage(text, payload.channel.id);
            counter++;
        }
    }
    // processess final interruption message publishing
    else if (payload.callback_id = "publish") {
        res.send(200);
        if (payload.actions[0].value == "yes") {
            postMessage(payload.original_message.attachments[0].text, interChannel/*, false, false, false*/);
            postMessage("Thanks for sumitting service interruption details!", payload.channel.id, true, payload.response_url);
        }
        else {
            postMessage("Message discarded. To start over just send me a message!", payload.channel.id, true, payload.response_url);
        }
    }

});

// Bot messages handler
app.post('/bot', (req, res) => {

    // verification
    var challenge = req.body.challenge;
    if (challenge) {
        res.send(challenge);
    }

    let payload = req.body;
    let chnl = payload.event.channel;
    res.sendStatus(200);

    // usage hint (if app mentioned outisde DM)
    if (payload.event.type == "app_mention") {
        var text = "Hey there! Please send me a direct message so I can help you to format a service interruption message for the relevant slack channel :)";
        postMessage(text, chnl);
    }

    // break process
    if (payload.event.type == "message" && payload.event.text == "stop" && payload.event.user) {
        session = false;
        counter = 0;
        postMessage("We are stopped. Send me a message if you want to try again", chnl, true);
    }

    // init dialog
    else if (payload.event.type == "message" && !session && payload.event.user) {
        session = true;
        var text = "Start Time (e.g. March 16 2018 15:28 UTC)"
        postMessage(text, chnl);
        counter++;
    }

    // get answers for the future form
    else if (payload.event.type == "message" && session && payload.event.user) {
        switch (counter) {
            case 1:
                formData.start_time = payload.event.text;
                // var text = "Cause"
                // postMessage(text, chnl);
                askCause(chnl);
                counter++;
                break;
            case 2: // being handled in /postReport endpoint
                // formData.cause = payload.event.text;
                // var text = "*Impact:* Which features are affected? Is there any data loss? What is the expected experience in the system a compared to the steady state?"
                // postMessage(text, chnl);
                // counter++;
                break;
            case 3:
                formData.impact = payload.event.text;
                var text = "Next update time (e.g. March 16 2018 15:28 UTC)"
                postMessage(text, chnl);
                counter++;
                break;
            case 4:
                formData.update_time = payload.event.text;
                var text = "Est. resolution time (e.g. March 16 2018 15:28 UTC). If not known - mention that as well"
                postMessage(text, chnl);
                counter++;
                break;
            case 5:
                formData.resolution_time = payload.event.text;
                counter = 0;
                session = false;
                confirmPublish(formData, chnl);
                break;
        }
    }

});

//OAuth
app.get('/auth', (req, res) => {
    console.log(req);
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
    });

    res.send();

});