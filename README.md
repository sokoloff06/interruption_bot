# interruption_bot
Slack bot to help posting pretty-formatted messages about service interruption

When deploying, make sure to fill in the following constants in index.js:

const client_id = "";
const client_secret = "";

# Slack Service Interruption Submission Bot
* Simple Node.js app which when given a slack command (e.g., `/report`) displays a [slack dialog](https://api.slack.com/dialogs) to collect a description of the service interruption incident and creates a post describing the incident with data collected from the dialog.

# Set up

* Put relevant *host URL* under the bot slack application in the following sections (see screenshots attached)
    * Interactive Components -> Request URL
    * Slash Commands -> /report -> Request URL
    * OAuth & Permissions -> Redirect URLS

* Make sure to fill in the following constants in index.js:

    * const client_id = "";
    * const client_secret = "";