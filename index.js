const express = require('express');
const request = require('request');
const app = express();
const appToken = "xoxp-511220587186-512622329046-522547343265-ff438c068f5ba0c1619d1baf0d994182"; //changes after the re-install
//const userToken = "xoxp-511220587186-512622329046-522366249552-ac278479b7522e60a428cfeee38c8df2";
const botToken = "xoxb-511220587186-512889535014-Yc1UWyFXkDjzoc5LdJ6XCPuz"; //changes after the re-install
const client_id = "511220587186.511052758372";
const client_secret = "b1f35600428d73ffdcb625e3e99ec59c";
const interChannel = "CF9RR28MQ";

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

function confirmPublish(form, chnl) {
    var text = "<!channel> Interruption alert!" + 
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
                        'label': 'Impact',
                        'hint': 'Which features are affected? Is there any data loss? What is the expected experience in the system a compared to the steady state?',
                        'placeholder': 'Please write here whatever is known and be as detailed as possible. Avoid using R&D internal terminology, use feature names instead'
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

    // processess final interruption message publishing
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