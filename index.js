// This app is only tested and designed to work with a single workspace yet
// TODO: Make a post on the submitter's behalf
const express = require('express');
const request = require('request');
const dotenv = require('dotenv');
const awsServerlessExpress = require('aws-serverless-express');
const { WebClient } = require('@slack/web-api');


const app = express();
const port = 3000;
// Indication app is started
app.listen(port, () => console.log(`App listening on port ${port}!`))

const server = awsServerlessExpress.createServer(app);
exports.handler = (event, context) => {
    console.log('EVENT: ' + JSON.stringify(event));
    awsServerlessExpress.proxy(server, event, context);
}
dotenv.config()
//TODO: Think of other object type instead of Map
const store = new Map(Object.entries({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    app_token: process.env.APP_TOKEN,
    bot_token: process.env.BOT_TOKEN,
    bot_user: process.env.BOT_USER,
    team_name: process.env.TEAM_NAME,
    admin_user: process.env.ADMIN_USER,
    channel_id: process.env.CHANNEL_ID,
    request_url: process.env.REQUEST_URL
}));

const slack = new WebClient(store.get('bot_token'));

const accessory = {
    'type': 'overflow',
    'options': [
        {
            'text': {
                'type': 'plain_text',
                'text': 'Update'
            }
        },
        {
            'text': {
                'type': 'plain_text',
                'text': 'Resolve'
            }
        }
    ],
    'action_id': 'overflow'
}

// Workspace credentials and params
var app_token;
var bot_token
var bot_user
var team_name
var interChannel; //ID of the interruption channel

// Loading params from the storage file to RAM if it exists
if (store.has('app_token')) {
    app_token = store.get('app_token');
    bot_token = store.get('bot_token');
    bot_user = store.get('bot_user');
    team_name = store.get('team_name');
    interChannel = store.get('channel_id');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test response for the GET request from browser
app.get('/', (req, res) => res.send('<p>Hello!</p>' + '<p>Interruption helper app is running</p><br>'));
app.get('/service-interruption-slackbot/', (req, res) => res.send('<p>Hello!</p>' + '<p>Interruption helper app is running</p><br>'));

// Opens up the dialog in slack
function openDialog(trigger_id) {
    var now = getCurrentTimeFormatted();
    return request.post('https://slack.com/api/dialog.open', {
        json: {
            'dialog': {
                'callback_id': 'issue_report',
                'title': 'Report interruption',
                'submit_label': 'Report',
                'state': 'Limo',
                'elements': [
                    {
                        'type': 'text',
                        'label': 'Start Time',
                        'name': 'start_time',
                        'value': now
                    },
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
                        'placeholder': 'e.g. ' + now
                    },

                ]
            },
            'trigger_id': trigger_id
        },
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + app_token
        }
    });
}

// 'report' command handler, checks if channel ID is specified and opens dialog
app.post('/', (req, res) => {
    var body = req.body;
    var channel = body.channel_id;
    var trigger_id = body.trigger_id;
    if (interChannel != '' && interChannel != null) {
        console.log('1')
        sendAndAknowledge(res, openDialog(trigger_id));
    }
    else if ((interChannel == '' || interChannel == null) && (store.get('channel_id') != '' && store.get('channel_id') != null)) {
        console.log('2')
        interChannel = store.get('channel_id');
        sendAndAknowledge(res, openDialog(trigger_id));
    }
    else {
        res.send('Please, add ID of the service interruption channel (as channel_id) to the environment variables and restart the lamdba');
    }
});

// General endpoint, see comments inside
app.post('/postReport', (req, res) => {
    var payload = JSON.parse(req.body.payload);
    if (payload.type == 'dialog_submission') {
        // Issue report dialog processor
        if (payload.callback_id == 'issue_report') {
            var form = payload.submission;
            console.log(form);
            postPreview(res, payload.user.id, form);
        }
        // Issue update dialog processor
        else if (payload.callback_id == 'issue_update') {
            var state = JSON.parse(payload.state);
            slack.chat.postMessage(
                {
                    'text': payload.submission.update_details +
                        '\n_Updated by <@' + payload.user.id + '>_',
                    'channel': payload.channel.id,
                    'thread_ts': state.ts
                }
            )
                .then(() => {
                    console.log("SUCESS")
                    var new_blocks = state.blocks
                    new_blocks[1].elements[1].text = '*Updated:* ' + getCurrentTimeFormatted();
                    slack.chat.update({
                        'channel': payload.channel.id,
                        'ts': state.ts,
                        'blocks': new_blocks
                    })
                    .then((result) => {
                        console.log('SUCEESS\nResult: ' + result);
                        res.send()
                    })
                    .catch((error) => {
                        console.log('FAIL\nResult: ' + error);
                        res.send(500)  
                    })
                })
        }
    }
    // Processess final interruption message publishing
    else if (payload.type == 'interactive_message') {
        // User decides to publish
        if (payload.actions[0].value == 'yes') {
            // Send aknowledgment and remove preview.
            request.post(payload.response_url, {
                json: {
                    'text': 'Thank you for submitting service interruption report!',
                    'channel': payload.channel.id,
                    'replace_original': true
                }
            })
                // Send message to the interruption channel
                .on('response', (result) => {
                    payload.original_message.blocks.shift();
                    var finalBlocks = payload.original_message.blocks;
                    finalBlocks[0].accessory = accessory;
                    console.log('SUCCESS\nResult: ' + result);
                    slack.chat.postMessage({
                        'channel': interChannel,
                        'text': 'There is a new interruption!',
                        'blocks': finalBlocks
                    })
                    .then((result) => {
                        console.log('SUCEESS\nResult: ' + result);
                        res.send()
                    })
                    .catch((error) => {
                        console.log('FAIL\nReason: ' + error);
                        res.sendStatus(500);
                    })
                })
                .on('error', (error) => {
                    console.log('FAIL\nReason: ' + error);
                    res.sendStatus(500);
                })
        }
        // User cancels publishing the message
        else if (payload.actions[0].value == 'cancel') {
            // Send info message that message was discarded
            request.post(payload.response_url, {
                json: {
                    'text': 'Message discarded. To start over use /service-interruption-report command!',
                    'channel': payload.channel.id,
                    'url': payload.response_url,
                    'replace_original': true
                }
            })
                .on('response', (result) => {
                    console.log('SUCCESS\nResult: ' + result);
                    res.send();
                })
                .on('error', (error) => {
                    console.log('FAIL\nReason: ' + error)
                    res.send(500);
                })
        }
    }

    else if (payload.type == 'block_actions') {
        // Resolving the issue
        if (payload.actions[0].selected_option.text.text == 'Resolve') {
            var blocks = payload.message.blocks;
            var num_of_fields = blocks[0].fields.length;
            blocks[0].fields[num_of_fields - 1].text = '*Status*\n:white_check_mark: - Resolved';
            delete blocks[0].accessory;
            blocks[1].elements[1].text = '*Resolved:* ' + getCurrentTimeFormatted();
            request.post(payload.response_url, {
                json: {
                    'text': 'Interruption message updated!',
                    'channel': payload.channel.id,
                    'replace_original': true,
                    'blocks': blocks
                }
            })
                .on('response', (result) => {
                    console.log('SUCCESS\nResult: ' + result);
                    slack.chat.postMessage(
                        {
                            'text': '_Resolved by <@' + payload.user.id + '>_',
                            'channel': payload.channel.id,
                            'thread_ts': payload.message.ts
                        }
                    ).then((result) => {
                        console.log('SUCCESS\nResult: ' + result);
                        res.send();
                    })
                    .catch((error) => {
                        console.log('FAIL\nReason: ' + error);
                        res.sendStatus(500);
                    })
                })
                .on('error', (error) => {
                    console.error(error);
                    res.send(500);
                })
        }
        // Updating issue status
        else if (payload.actions[0].selected_option.text.text == 'Update') {
            slack.dialog.open({
                'trigger_id': payload.trigger_id,
                'dialog': {
                    'callback_id': 'issue_update',
                    'title': 'Update issue status',
                    'submit_label': 'Update',
                    'state': JSON.stringify(payload.message),
                    'elements': [
                        {
                            'type': 'textarea',
                            'label': 'Update details',
                            'name': 'update_details',
                        }
                    ]
                }
            })
            .then((result) => {
                console.log('SUCCESS\nResult: ' + result);
                res.send();
            })
            .catch((error) => {
                console.log('FAIL\nReason: ' + error);
                res.sendStatus(500);
            })
        }
    }
});

// Execute new request and give a response on completion
function sendAndAknowledge(res, req) {
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

// Posts confirmation message so user can preview the resulting message
function postPreview(res, user_id, form) {
    var now = getCurrentTimeFormatted();
    var blocks = [
        {
            'type': 'section',
            'text':
            {
                "type": "mrkdwn",
                "text": "Here is how your message will look like"
            }
        },
        {
            'type': 'section',
            'fields': [
                {
                    'type': 'mrkdwn',
                    'text': '*Issue and cause*\n' + form.issue
                },
                {
                    'type': 'mrkdwn',
                    'text': '*Impact*\n' + form.impact
                },
                {
                    'type': 'mrkdwn',
                    'text': '*Start Time*\n' + form.start_time
                },
                {
                    'type': 'mrkdwn',
                    'text': '*Expected resolution/update time*\n' + form.time
                },
                {
                    'type': 'mrkdwn',
                    'text': '*Status*\n:red_circle: - Ongoing'
                }
            ]
        },
        {
            'type': 'context',
            'elements': [
                {
                    'type': 'mrkdwn',
                    'text': '*Published by:* ' + '<@' + user_id + '>'
                },
                {
                    'type': 'mrkdwn',
                    'text': '*Last updated:* ' + now
                },
                {
                    'type': 'mrkdwn',
                    'text': '<!here>'
                }
            ]
        }
    ];

    slack.chat.postMessage({
        'channel': user_id,
        'text': 'Here is how your message will look like',
        'blocks': blocks,
        'delete_original': true,
        'attachments': [
            {
                'text': 'Do you want to publish?',
                'fallback': 'You are unable to publish a message',
                'callback_id': 'publish',
                'color': '#3AA3E3',
                'attachment_type': 'default',
                'actions': [
                    {
                        'name': 'publish',
                        'text': 'Yes',
                        'type': 'button',
                        'value': 'yes',
                        'style': 'primary'
                    },
                    {
                        'name': 'cancel',
                        'text': 'Cancel',
                        'type': 'button',
                        'value': 'cancel',
                        'style': 'danger'
                    }
                ]
            }
        ]
    })
        .then((result) => {
            console.log('SUCCESS\nResult: ' + result);
            res.send();
        })
        .catch((reason) => {
            console.log('FAIL\nReason: ' + reason)
            res.send(500);
        })
}

function getCurrentTimeFormatted() {
    var today = new Date();
    return today.toLocaleString('en-us', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jerusalem',
        timeZoneName: 'short'
    });
}