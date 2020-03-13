// This app is only tested and designed to work with a single workspace yet
// TODO: Make a post on the submitter's behalf
// TODO: Make a notification when message is updated
// TODO: Check if we can increase maximum payload size (when message is too big and has many updates, updating will stop working)

const express = require('express');
const app = express();

// If true - running on local machine, if false - on AWS lambda
const DEBUG = true;
if (DEBUG) {
    const dotenv = require('dotenv');
    var envResult = dotenv.config();
    console.log(envResult);
} else {
    const awsServerlessExpress = require('aws-serverless-express');
    const server = awsServerlessExpress.createServer(app);
    exports.handler = (event, context) => {
        console.log('EVENT: ' + JSON.stringify(event));
        awsServerlessExpress.proxy(server, event, context);
    };
}


const request = require('request');
const {WebClient} = require('@slack/web-api');
const port = 3000;

// Workspace credentials and params
let app_token;
let bot_token;
let channel_id; //ID of the interruption channel

const store = new Map(Object.entries({
    app_token: process.env.APP_TOKEN,
    bot_token: process.env.BOT_TOKEN,
    channel_id: process.env.CHANNEL_ID,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET
}));

// Loading params from the storage file to RAM if it exists
if (store.has('app_token')) {
    app_token = store.get('app_token');
    bot_token = store.get('bot_token');
    channel_id = store.get('channel_id');
}

// JSONs
const accessoryResolve = {
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
};
const accessoryUnresolve = {
    'type': 'overflow',
    'options': [
        {
            'text': {
                'type': 'plain_text',
                'text': 'Unresolve'
            }
        }
    ],
    'action_id': 'overflow'
};
function getDialogJson(trigger_id) {
    var now = getCurrentTimeFormatted();
    return {
        'dialog': {
            'callback_id': 'issue_report',
            'title': 'Report interruption',
            'submit_label': 'Report',
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
    };
}
function getInitialBlocks(form, user_id) {
    var now = getCurrentTimeFormatted();
    return [
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
}
function getUpdateLogBlocks() {
    return [
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text":
                {
                    "type": "mrkdwn",
                    "text": "*Updates Log*"
                }
        }
    ]
}

// Opens up the dialog in slack
function openDialog(trigger_id) {
    var now = getCurrentTimeFormatted();
    return request.post('https://slack.com/api/dialog.open', {
        json: getDialogJson(trigger_id),
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'Bearer ' + app_token
        }
    });
}
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
    var blocks = getInitialBlocks(form, user_id);

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
            console.log('FAIL\nReason: ' + reason);
            res.sendStatus(500);
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
function updateBlock(payload, block) {
    var updated = false;
    var now = getCurrentTimeFormatted();
    if (block.type === "context") {
        block.elements[1].text = '*Updated:* ' + now;
    }
    if (block.type === "section" && block.text != null && block.text.text.includes("Updates Log")) {
        block.text.text += "\n*" + now + "*: " + payload.submission.update_details.trim() + " _by <@" + payload.user.id + ">_";
        updated = true;
    }
    return updated;
}

const slack = new WebClient(store.get('bot_token'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.listen(port, () => console.log(`App listening on port ${port}!`));

// Test response for the GET request from browser
app.get('/', (req, res) => res.send('<p>Hello!</p>' + '<p>Service interruption bot is running</p><br>'));
app.get('/service-interruption-slackbot/', (req, res) => res.send('<p>Hello!</p>' + '<p>Service interruption bot is running</p><br>'));


// 'report' command handler, checks if channel ID is specified and opens dialog
app.post('/', (req, res) => {
    var body = req.body;
    var channel = body.channel_id;
    var trigger_id = body.trigger_id;
    if (channel_id !== '' && channel_id != null) {
        console.log('1');
        sendAndAknowledge(res, openDialog(trigger_id));
    } else {
        res.send('Please, add ID of the service interruption channel (as channel_id) to the environment variables and restart the lamdba');
    }
});
// General endpoint, see comments inside
app.post('/postReport', (req, res) => {
    var payload = JSON.parse(req.body.payload);
    // Responding to dialogs submissions
    if (payload.type === 'dialog_submission') {
        // Issue report dialog processor
        if (payload.callback_id === 'issue_report') {
            var form = payload.submission;
            console.log(form);
            postPreview(res, payload.user.id, form);
        }
        // Issue update dialog processor
        else if (payload.callback_id === 'issue_update') {
            var originalMessageFromState = JSON.parse(payload.state);
            var blocks = originalMessageFromState.blocks;
            var now = getCurrentTimeFormatted();
            var updated = false;
            for (var i = 0; i < blocks.length; i++) {
                let block = blocks[i];
                updated = updateBlock(payload, block);
                if (updated) {
                    break;
                }
            }
            if (!updated) {
                getUpdateLogBlocks().forEach((block) => {
                    updated = updateBlock(payload, block);
                    blocks.push(block);
                });
            }
            slack.chat.update({
                'text': 'Interruption message updated!',
                'channel': payload.channel.id,
                'replace_original': true,
                'ts': originalMessageFromState.ts,
                'blocks': blocks
            })
                .then((result) => {
                    console.log('SUCEESS\nResult: ' + result);
                    res.send()
                })
                .catch((error) => {
                    console.log('FAIL\nReason: ' + error);
                    res.sendStatus(500);
                });
        }
    }
    // Processes final interruption message publishing
    else if (payload.type === 'interactive_message') {
        // User decides to publish
        if (payload.actions[0].value === 'yes') {
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
                    finalBlocks[0].accessory = accessoryResolve;
                    console.log('SUCCESS\nResult: ' + result);
                    slack.chat.postMessage({
                        'channel': channel_id,
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
                    console.log('FAIL\nReason: ' + error);
                    res.send(500);
                })
        }
    }
    // Responding to interactive button click
    else if (payload.type == 'block_actions') {
        // Resolving the issue
        if (payload.actions[0].selected_option.text.text == 'Resolve') {
            var blocks = payload.message.blocks;
            var num_of_fields = blocks[0].fields.length;
            blocks[0].fields[num_of_fields - 1].text = '*Status*\n:white_check_mark: - Resolved';
            delete blocks[0].accessory;
            blocks[0].accessory = accessoryUnresolve;
            blocks[1].elements[1].text = '*Updated:* ' + getCurrentTimeFormatted();
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
        // Unresolving (if issue re-occured or was resolved by mistake)
        else if (payload.actions[0].selected_option.text.text == 'Unresolve') {
            var blocks = payload.message.blocks;
            var num_of_fields = blocks[0].fields.length;
            blocks[0].fields[num_of_fields - 1].text = '*Status*\n:red_circle: - Ongoing';
            delete blocks[0].accessory;
            blocks[0].accessory = accessoryResolve;
            blocks[1].elements[1].text = '*Updated:* ' + getCurrentTimeFormatted();
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
                            'text': '_Unresolved by <@' + payload.user.id + '>_',
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
        // Opens  dialog to submit an update
        else if (payload.actions[0].selected_option.text.text == 'Update') {
            slack.dialog.open({
                'trigger_id': payload.trigger_id,
                'dialog': {
                    'callback_id': 'issue_update',
                    'title': 'Update issue status',
                    'submit_label': 'Update',
                    // When user will submit a dialog, original message will no longer be available.
                    // Thus we are saving it to the state property to be able to access it when processing dialog submission
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